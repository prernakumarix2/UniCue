import test from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), key: i => [...mem.keys()][i], get length() { return mem.size; } };
const { getSyncedList, resetContentCache } = await import("../js/repositories/content-sync.js");
const { buildBackup, parseBackup, sanitizePreferences } = await import("../js/domain/backup.js");
const { sanitizeSlots } = await import("../js/domain/timetable.js");
const { backupDue } = await import("../js/domain/backup-reminder.js");
const { errorState } = await import("../js/components/error-state.js");

const wait = ms => new Promise(r => setTimeout(r, ms));
const setOnline = value => Object.defineProperty(globalThis, "navigator", { value: { onLine: value }, configurable: true });
test.beforeEach(() => { mem.clear(); resetContentCache(); setOnline(true); });

test("slow network with a saved copy: the saved list shows after the soft timeout, not after the full wait", async () => {
  await getSyncedList("information", { fetchVersion: async () => 1, fetchList: async () => [{ id: "old" }] });
  resetContentCache.keepStorage = true; // memory reset below, storage kept
  const stored = mem.get("unicue_cache_information");
  resetContentCache(); mem.set("unicue_cache_information", stored);
  const t0 = Date.now();
  const items = await getSyncedList("information", { softTimeoutMs: 40, fetchVersion: () => new Promise(() => {}), fetchList: async () => [{ id: "never" }] });
  assert.deepEqual(items, [{ id: "old" }]);
  assert.ok(Date.now() - t0 < 500, "did not hang");
});
test("slow network and NO saved copy: still waits for the real answer", async () => {
  const items = await getSyncedList("information", { softTimeoutMs: 10, fetchVersion: async () => { await wait(60); return 7; }, fetchList: async () => [{ id: "fresh" }] });
  assert.deepEqual(items, [{ id: "fresh" }]);
});
test("browser reports offline: saved copy is served immediately without calling the network", async () => {
  await getSyncedList("information", { fetchVersion: async () => 1, fetchList: async () => [{ id: "old" }] });
  const stored = mem.get("unicue_cache_information"); resetContentCache(); mem.set("unicue_cache_information", stored);
  setOnline(false);
  let called = false;
  const items = await getSyncedList("information", { fetchVersion: async () => { called = true; return 2; }, fetchList: async () => [] });
  assert.deepEqual(items, [{ id: "old" }]); assert.equal(called, false);
});
test("offline with nothing saved throws instead of showing a blank list", async () => {
  setOnline(false);
  await assert.rejects(() => getSyncedList("information", { fetchVersion: async () => 1, fetchList: async () => [] }), /Offline/);
});

test("sanitizeSlots keeps good slots, drops malformed ones, never throws", () => {
  const good = { day: 2, start: "10:00", end: "10:50", room: "33-509", type: "L", extra: "x" };
  assert.deepEqual(sanitizeSlots([good, null, { day: 9 }, { ...good, start: "25:00" }, { ...good, end: "09:00" }, { ...good, room: "<b>" }, { ...good, type: "Z" }, "str"]), [{ day: 2, start: "10:00", end: "10:50", room: "33-509", type: "L" }]);
  assert.deepEqual(sanitizeSlots("nope"), []); assert.deepEqual(sanitizeSlots(undefined), []);
});
test("backup round-trips timetable slots and placement preferences; old backups still load", () => {
  const course = { id: "c1", name: "OS", code: "CSE494", conducted: 10, attended: 9, dl: 0, target: 75, slots: [{ day: 1, start: "10:00", end: "10:50", room: "1-1", type: "L" }], section: "K1" };
  const text = JSON.stringify(buildBackup({ attendance: [course], deadlines: [], preferences: { placementProfile: { cgpa: 7.5, backlogs: 0 }, savedDrives: ["d1", "d2"] } }));
  const r = parseBackup(text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.attendance[0].slots, course.slots); assert.equal(r.data.attendance[0].section, "K1");
  assert.deepEqual(r.data.preferences, { placementProfile: { cgpa: 7.5, backlogs: 0 }, savedDrives: ["d1", "d2"] });
  const old = parseBackup(JSON.stringify({ app: "unicue", version: 1, attendance: [], deadlines: [] }));
  assert.equal(old.ok, true); assert.deepEqual(old.data.preferences, { placementProfile: null, savedDrives: [] });
});
test("a tampered backup cannot smuggle bad slots or preferences into the app", () => {
  const course = { id: "c1", name: "OS", conducted: 1, attended: 1, dl: 0, target: 75, slots: [{ day: 1, start: "bad", end: "x", room: "<img>", type: "L" }, { day: 2, start: "09:00", end: "09:50", room: "A-1", type: "P" }] };
  const r = parseBackup(JSON.stringify({ app: "unicue", version: 1, attendance: [course], deadlines: [], preferences: { placementProfile: { cgpa: 999, backlogs: -4 }, savedDrives: [1, "ok", "x".repeat(300), null] } }));
  assert.equal(r.data.attendance[0].slots.length, 1);
  assert.equal(r.data.preferences.placementProfile.cgpa, 10); assert.equal(r.data.preferences.placementProfile.backlogs, 0);
  assert.deepEqual(r.data.preferences.savedDrives, ["ok"]);
  assert.deepEqual(sanitizePreferences(null), { placementProfile: null, savedDrives: [] });
});
test("backupDue: never without data; first reminder at 14 days; then every 30; snooze respected", () => {
  const DAY = 86400000, now = Date.now();
  assert.equal(backupDue({ hasData: false, firstSeen: now - 99 * DAY, now }), false);
  assert.equal(backupDue({ hasData: true, firstSeen: now - 5 * DAY, now }), false);
  assert.equal(backupDue({ hasData: true, firstSeen: now - 15 * DAY, now }), true);
  assert.equal(backupDue({ hasData: true, firstSeen: now - 90 * DAY, lastBackup: now - 10 * DAY, now }), false);
  assert.equal(backupDue({ hasData: true, firstSeen: now - 90 * DAY, lastBackup: now - 31 * DAY, now }), true);
  assert.equal(backupDue({ hasData: true, firstSeen: now - 90 * DAY, lastBackup: now - 31 * DAY, snoozedUntil: now + DAY, now }), false);
  assert.equal(backupDue({ hasData: true, now }), false, "unknown first-seen never nags");
});
test("error screens: temporary failures get Try again, not-found does not; message is escaped", () => {
  assert.match(errorState("Information unavailable", "x"), /data-retry/);
  assert.match(errorState("Unable to load this screen", "x"), /data-retry/);
  assert.doesNotMatch(errorState("Opportunity not found", "gone"), /data-retry/);
  assert.doesNotMatch(errorState("Oops", "<script>x</script>"), /<script>/);
});
