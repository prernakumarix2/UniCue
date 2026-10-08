import { firebaseConfig } from "../firebase/config.js";
import { getFirestoreClient, collectionDocs, getDocument, createDocument, updateDocument, deleteDocument, readContentVersion, bumpContentVersion } from "../firebase/firestore.js";
import { getSyncedList, findCached, invalidateContentCache } from "./content-sync.js";

const NAME = "placements";

function requireFirebase() {
  if (!firebaseConfig.enabled) throw new Error("Firebase is not configured yet.");
}

// Every admin write bumps meta/content.version so students refetch exactly once.
async function afterWrite(db) {
  invalidateContentCache();
  try { await bumpContentVersion(db); } catch { /* content saved; students fall back to the 10-minute cache */ }
}

export const placementRepository = {
  /** Student list: cached, version-gated, de-duplicated. */
  async getPublished() {
    if (!firebaseConfig.enabled) return [];
    const db = await getFirestoreClient();
    return getSyncedList(NAME, {
      fetchVersion: () => readContentVersion(db),
      fetchList: () => collectionDocs(db, NAME, { statuses: ["published", "closed"] })
    });
  },
  /** Admin list: always live. */
  async getAll() {
    requireFirebase();
    const db = await getFirestoreClient();
    return collectionDocs(db, NAME);
  },
  /** Student detail reads the synced list first (0 reads); { fresh: true } for the admin editor. */
  async getById(id, { fresh = false } = {}) {
    if (!firebaseConfig.enabled) return null;
    if (!fresh) {
      try { await this.getPublished(); } catch { /* fall through to a direct read */ }
      const cached = findCached(NAME, id);
      if (cached) return cached;
    }
    const db = await getFirestoreClient();
    return getDocument(db, NAME, id);
  },
  async create(data) {
    requireFirebase();
    const db = await getFirestoreClient();
    const result = await createDocument(db, NAME, data);
    await afterWrite(db);
    return result;
  },
  async update(id, data) {
    requireFirebase();
    const db = await getFirestoreClient();
    const result = await updateDocument(db, NAME, id, data);
    await afterWrite(db);
    return result;
  },
  async remove(id) {
    requireFirebase();
    const db = await getFirestoreClient();
    await deleteDocument(db, NAME, id);
    await afterWrite(db);
  }
};
