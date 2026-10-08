// Read-quota behaviour of the version-gated cache (pure logic, no Firebase).
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k), get length() { return mem.size; }, key: i => [...mem.keys()][i]
};
const { getSyncedList, resetContentCache, peekCached, findCached } = await import("../js/repositories/content-sync.js");

let calls;
const make = (version, items) => ({
  fetchVersion: async () => { calls.version++; if (version.fail) throw version.fail; return version.v; },
  fetchList: async () => { calls.list++; return items.slice(); }
});
beforeEach(() => { mem.clear(); resetContentCache(); calls = { version: 0, list: 0 }; });

test("many callers in one session cost 1 version read + 1 list fetch", async () => {
  const f = make({ v: 5 }, [{ id: "a" }, { id: "b" }]);
  await Promise.all([getSyncedList("information", f), getSyncedList("information", f), getSyncedList("information", f)]);
  await getSyncedList("information", f);
  assert.deepEqual(calls, { version: 1, list: 1 });
});

test("a new app open with an unchanged version does NOT refetch the list", async () => {
  await getSyncedList("information", make({ v: 5 }, [{ id: "a" }]));
  resetMemoryOnly();
  calls = { version: 0, list: 0 };
  const items = await getSyncedList("information", make({ v: 5 }, [{ id: "a" }]));
  assert.deepEqual(items, [{ id: "a" }]);
  assert.deepEqual(calls, { version: 1, list: 0 });
});

test("a bumped version triggers exactly one refetch", async () => {
  await getSyncedList("information", make({ v: 5 }, [{ id: "a" }]));
  resetMemoryOnly();
  calls = { version: 0, list: 0 };
  const items = await getSyncedList("information", make({ v: 6 }, [{ id: "a" }, { id: "new" }]));
  assert.equal(items.length, 2);
  assert.deepEqual(calls, { version: 1, list: 1 });
});

test("offline: cached list is served; with no cache the error surfaces", async () => {
  await getSyncedList("placements", make({ v: 1 }, [{ id: "p" }]));
  resetMemoryOnly();
  const offline = make({ fail: Object.assign(new Error("net"), { code: "unavailable" }) }, []);
  assert.deepEqual(await getSyncedList("placements", offline), [{ id: "p" }]);
  mem.clear(); resetMemoryOnly();
  await assert.rejects(getSyncedList("placements", offline));
});

test("no meta doc / rules not deployed: falls back to a time-based cache (still saves reads)", async () => {
  const denied = Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
  await getSyncedList("information", make({ fail: denied }, [{ id: "a" }]));
  resetMemoryOnly();
  calls = { version: 0, list: 0 };
  await getSyncedList("information", make({ v: null }, [{ id: "a" }]));
  assert.equal(calls.list, 0, "second open within 10 minutes must not refetch");
});

test("list fetch failure serves stale data instead of a blank screen", async () => {
  await getSyncedList("information", make({ v: 1 }, [{ id: "a" }]));
  resetMemoryOnly();
  const f = { fetchVersion: async () => 2, fetchList: async () => { throw new Error("boom"); } };
  assert.deepEqual(await getSyncedList("information", f), [{ id: "a" }]);
});

test("peekCached / findCached read without network", async () => {
  await getSyncedList("information", make({ v: 1 }, [{ id: "a", title: "T" }]));
  assert.equal(peekCached("information").length, 1);
  assert.equal(findCached("information", "a").title, "T");
  assert.equal(findCached("information", "zzz"), null);
});

// Simulates closing and reopening the app: memory is gone, localStorage survives.
import { resetContentCache as _r } from "../js/repositories/content-sync.js";
function resetMemoryOnly() {
  const saved = new Map(mem);
  _r();
  for (const [k, v] of saved) mem.set(k, v);
}
