// Read-saving sync layer for the student-facing Firestore collections.
//
// Problem: Spark allows ~50k document reads/day. Re-fetching whole collections on
// every screen would burn that with ~100 daily users.
// Strategy:
//   1. The admin bumps ONE tiny doc (meta/content.version) on every content change.
//   2. A student opening the app reads only that doc (1 read), at most once a minute.
//   3. Lists are re-downloaded ONLY when the version differs from the cached copy.
//   4. Lists live in localStorage, so Messages/Placements also work offline.
//   5. Concurrent callers share one in-flight request (Home + bell + page = one fetch).
// If the meta doc doesn't exist yet (or rules aren't deployed) we fall back to a
// 10-minute time-based cache, so the quota is protected either way.

const STORE_PREFIX = "unicue_cache_";
const VERSION_RECHECK_MS = 60 * 1000;
const FALLBACK_TTL_MS = 10 * 60 * 1000;
const SOFT_TIMEOUT_MS = 4000; // with a saved copy on the phone, never make the student wait longer than this for the network

const memory = { version: undefined, checkedAt: 0, versionPromise: null, lists: new Map(), inflight: new Map() };

const now = () => Date.now();
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };

function readStored(name) {
  try { return JSON.parse(store()?.getItem(STORE_PREFIX + name) || "null"); } catch { return null; }
}
function writeStored(name, entry) {
  try { store()?.setItem(STORE_PREFIX + name, JSON.stringify(entry)); } catch { /* quota or private mode: memory cache still works */ }
}

/** Latest cached list without touching the network (or null). For instant paint. */
export function peekCached(name) {
  return memory.lists.get(name)?.items || readStored(name)?.items || null;
}

/** Forget everything (admin edits, tests). */
export function resetContentCache() {
  memory.version = undefined; memory.checkedAt = 0; memory.versionPromise = null;
  memory.lists.clear(); memory.inflight.clear();
  const s = store();
  if (s) for (const key of Object.keys(s)) if (key.startsWith(STORE_PREFIX)) s.removeItem(key);
}

/** Called after an admin write so the admin's own device refetches immediately. */
export function invalidateContentCache() {
  memory.checkedAt = 0; memory.versionPromise = null; memory.lists.clear(); memory.inflight.clear();
  const s = store();
  if (s) for (const key of Object.keys(s)) if (key.startsWith(STORE_PREFIX)) s.removeItem(key);
}

/**
 * Resolves { version, offline }. version === null means "no meta doc, use TTL mode".
 * Memoised for a minute; concurrent calls share one request.
 */
async function resolveVersion(fetchVersion, softMs = 0) {
  if (memory.version !== undefined && now() - memory.checkedAt < VERSION_RECHECK_MS) return { version: memory.version, offline: false };
  // The browser knows it has no connection: skip the wait entirely and serve the saved copy.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { version: undefined, offline: true, error: new Error("Offline") };
  if (!memory.versionPromise) {
    memory.versionPromise = (async () => {
      try {
        const v = await (softMs > 0
          ? Promise.race([fetchVersion(), new Promise((_, reject) => setTimeout(() => reject(new Error("slow network")), softMs))])
          : fetchVersion());
        memory.version = v === undefined ? null : v;
        memory.checkedAt = now();
        return { version: memory.version, offline: false };
      } catch (error) {
        if (error?.code === "permission-denied" || /permission/i.test(error?.message || "")) {
          memory.version = null; memory.checkedAt = now();   // rules not deployed yet: TTL mode
          return { version: null, offline: false };
        }
        return { version: undefined, offline: true, error };
      } finally { memory.versionPromise = null; }
    })();
  }
  return memory.versionPromise;
}

/**
 * name: cache bucket ("information" | "placements")
 * fetchers: { fetchVersion(): Promise<string|number|null>, fetchList(): Promise<object[]> }
 */
export async function getSyncedList(name, { fetchVersion, fetchList, softTimeoutMs = SOFT_TIMEOUT_MS }) {
  const stored = memory.lists.get(name) || readStored(name);
  const { version, offline, error } = await resolveVersion(fetchVersion, stored ? softTimeoutMs : 0);

  if (offline) {                       // no network: serve whatever we have
    if (stored) return stored.items;
    throw error || new Error("Offline");
  }
  if (stored) {
    const fresh = version !== null
      ? stored.version === version
      : now() - (stored.savedAt || 0) < FALLBACK_TTL_MS;
    if (fresh) { memory.lists.set(name, stored); return stored.items; }
  }
  if (memory.inflight.has(name)) return memory.inflight.get(name);

  const request = (async () => {
    try {
      const items = await fetchList();
      const entry = { version, savedAt: now(), items };
      memory.lists.set(name, entry);
      writeStored(name, entry);
      return items;
    } catch (fetchError) {
      if (stored) return stored.items; // server hiccup: stale beats blank
      throw fetchError;
    } finally { memory.inflight.delete(name); }
  })();
  memory.inflight.set(name, request);
  return request;
}

/** Find one item inside the synced list (no network). */
export function findCached(name, id) {
  return peekCached(name)?.find(item => item.id === id) || null;
}

/** True when the last version check failed because the device is offline. */
export async function isOffline(fetchVersion) {
  return (await resolveVersion(fetchVersion)).offline;
}
