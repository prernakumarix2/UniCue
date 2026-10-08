import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildBackup, parseBackup } from "../js/domain/backup.js";
import { setHolidays, loadHolidays, holidayDates } from "../js/domain/holidays.js";
import { countRemaining, courseInput } from "../js/domain/planner.js";

const course = { id: "c1", name: "NoSQL", conducted: 10, attended: 8, target: 85, schedule: { 5: 2 } };
const deadline = { id: "d1", title: "CA1", dueDate: "2026-10-21", notes: "Unit 1, 2, 3" };

test("backup round-trips attendance, deadlines, target and theme", () => {
  const text = JSON.stringify(buildBackup({ attendance: [course], deadlines: [deadline], semesterTarget: 90, theme: "dark" }));
  const r = parseBackup(text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { attendance: [course], deadlines: [deadline], semesterTarget: 90, theme: "dark", preferences: { placementProfile: null, savedDrives: [] } });
});

test("backup rejects bad files with a clear message", () => {
  assert.match(parseBackup("not json").error, /valid JSON/);
  assert.match(parseBackup(JSON.stringify({ app: "other" })).error, /not a UniCue/);
  assert.match(parseBackup(JSON.stringify({ app: "unicue", version: 99, attendance: [], deadlines: [] })).error, /newer/);
  const bad = buildBackup({ attendance: [{ ...course, attended: 99 }], deadlines: [] });
  assert.match(parseBackup(JSON.stringify(bad)).error, /courses/);
});

test("shipped holiday list is valid and sorted", () => {
  const file = JSON.parse(fs.readFileSync(new URL("../data/holidays.json", import.meta.url), "utf8"));
  assert.equal(file.holidays.length, 8);
  const dates = file.holidays.map(h => h.date);
  assert.deepEqual(dates, [...dates].sort());
  assert.ok(dates.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)));
});

test("university holidays reduce remaining classes (2 NoSQL classes lost on a Friday holiday)", async () => {
  await loadHolidays(async () => ({ ok: true, json: async () => ({ holidays: [{ date: "2026-10-09", name: "Test" }] }) }));
  assert.deepEqual(holidayDates(), ["2026-10-09"]);
  const from = new Date(2026, 9, 5); // Mon; Fridays after: 9 Oct, 16 Oct
  const base = { lastDate: "2026-10-18", schedule: { 5: 2 } };
  assert.equal(countRemaining({ from, ...base }), 4);
  assert.equal(courseInput({ ...course, lastDate: "2026-10-18" }, from).remaining, 2);
  setHolidays([]);
  assert.equal(courseInput({ ...course, lastDate: "2026-10-18" }, from).remaining, 4);
});

test("a failed holiday fetch keeps the app working", async () => {
  setHolidays([{ date: "2026-10-09", name: "Kept" }]);
  await loadHolidays(async () => { throw new Error("offline"); });
  assert.equal(holidayDates().length, 1);
  setHolidays([]);
});
