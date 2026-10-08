import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readXlsxRows } from "../js/utils/xlsx-lite.js";
import { parseDelimited } from "../js/utils/csv.js";
import { parseTimetableGrid, buildPlan, applyPlan, importDefaults, todaySlots, weeklyTimetable, scheduleFromSlots, slotsMatchSchedule, codeOf } from "../js/domain/timetable.js";
import { leaveImpact } from "../js/domain/planner.js";

const ab = path => { const b = readFileSync(new URL(path, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

test("reads the real UMS export (inline strings) and the shared-strings variant to the same grid", async () => {
  const a = await readXlsxRows(ab("./fixtures/schedule-anon.xlsx"));
  const b = await readXlsxRows(ab("./fixtures/schedule-sharedstrings.xlsx"));
  assert.equal(a[2][0], "Monday");
  assert.match(a[3][0], /12:50 - 13:40/);
  const trim = g => g.map(r => { const x = r.map(c => c.replace(/\s+/g, " ")); while (x.length && x[x.length - 1] === "") x.pop(); return x; });
  assert.deepEqual(trim(a), trim(b));
  assert.ok(!JSON.stringify(a).includes("12308423"), "fixture holds no real student ID");
});
test("xlsx reader rejects junk without throwing past its own Error", async () => {
  await assert.rejects(() => readXlsxRows(new TextEncoder().encode("not a zip at all").buffer), /zip|large|unreadable/i);
  await assert.rejects(() => readXlsxRows("nope"), /unreadable|large/i);
});
test("parses the real timetable: 13 classes, 4 courses, correct days/times/rooms/types", async () => {
  const r = parseTimetableGrid(await readXlsxRows(ab("./fixtures/schedule-anon.xlsx")));
  assert.equal(r.error, undefined);
  assert.equal(r.entries.length, 13);
  assert.deepEqual([...new Set(r.entries.map(e => e.code))].sort(), ["CSE339", "CSE494", "IXD803", "INT315"].sort());
  const mon = r.entries.filter(e => e.day === 1);
  assert.deepEqual(mon.map(e => `${e.start}-${e.end} ${e.type} ${e.room} ${e.code}`), ["12:50-13:40 L 33-509 INT315", "13:40-14:30 L 33-509 INT315", "16:10-17:00 P 38-814 IXD803"]);
  assert.equal(r.entries.find(e => e.room === "38-906A").day, 3, "alphanumeric room, Wednesday");
  assert.equal(r.entries.find(e => e.code === "INT315").section, "K2P23PD");
});
test("same data via CSV and tab-pasted text parses identically", async () => {
  const grid = await readXlsxRows(ab("./fixtures/schedule-anon.xlsx"));
  const want = parseTimetableGrid(grid).entries;
  const q = c => `"${c.replace(/"/g, '""')}"`;
  const csv = grid.map(r => r.map(q).join(",")).join("\r\n");
  const tsv = grid.map(r => r.map(c => c.replace(/\n/g, " ")).join("\t")).join("\n");
  assert.deepEqual(parseTimetableGrid(parseDelimited(csv)).entries, want);
  assert.deepEqual(parseTimetableGrid(parseDelimited(tsv)).entries, want);
});
test("friendly errors: no weekday header, no classes; Sunday ignored and counted", () => {
  assert.match(parseTimetableGrid([["a", "b"]]).error, /weekday/);
  assert.match(parseTimetableGrid([["Monday", "Tuesday", "Wednesday"], ["", "", ""]]).error, /no classes/);
  const r = parseTimetableGrid([["Monday", "Tuesday", "Sunday"], ["10:00 - 10:50: 1-1 - L - ABC123X", "", "11:00 - 11:50: 1-1 - L - ABC123X"]]);
  assert.equal(r.entries.length, 1); assert.equal(r.ignoredSunday, 1);
});
test("plan groups per course, matches existing courses by code, keeps their numbers on apply", async () => {
  const entries = parseTimetableGrid(await readXlsxRows(ab("./fixtures/schedule-anon.xlsx"))).entries;
  const existing = [{ id: "c1", name: "Operating Systems", code: "cse494", conducted: 30, attended: 27, target: 75, lastDate: "2026-11-30" }];
  const plan = buildPlan(entries, existing);
  assert.equal(plan.length, 4);
  const cse494 = plan.find(p => p.code === "CSE494");
  assert.equal(cse494.match.id, "c1");
  assert.deepEqual(cse494.schedule, { 2: 1, 4: 2, 5: 2 });
  assert.match(cse494.summary, /Tue.*Thu ×2.*Fri ×2/);
  const calls = { create: [], update: [] };
  const repo = { create: x => calls.create.push(x), update: (id, x) => calls.update.push([id, x]) };
  const res = applyPlan(plan, repo, importDefaults(existing, "", new Date(2026, 9, 6)));
  assert.deepEqual(res, { created: 3, updated: 1 });
  assert.deepEqual(Object.keys(calls.update[0][1]).sort(), ["schedule", "section", "slots"], "numbers untouched");
  assert.equal(calls.create[0].target, 75); assert.equal(calls.create[0].lastDate, "2026-11-30"); assert.equal(calls.create[0].conducted, 0);
  assert.equal(calls.create[0].countedThrough, "2026-10-05");
});
test("a freshly imported course (0 conducted) does not break the planner", () => {
  const c = { id: "n", name: "X", code: "ABC123", conducted: 0, attended: 0, dl: 0, target: 75, lastDate: "2026-11-30", countedThrough: "2026-10-05", schedule: { 1: 2, 3: 2 }, slots: [] };
  const r = leaveImpact(c, new Date(2026, 9, 12), new Date(2026, 9, 12), new Date(2026, 9, 6));
  assert.ok(Number.isFinite(r.remaining) && r.remaining > 0);
  assert.ok(r.margin === null || Number.isFinite(r.margin));
});
test("todaySlots: sorted, states done/now/next/later, skips holiday and after last date", async () => {
  const entries = parseTimetableGrid(await readXlsxRows(ab("./fixtures/schedule-anon.xlsx"))).entries;
  const courses = buildPlan(entries).map((p, i) => ({ id: `c${i}`, name: p.code, code: p.code, slots: p.slots, lastDate: "2026-11-30" }));
  const mon = (h, m) => new Date(2026, 9, 5, h, m); // Mon 5 Oct 2026
  const at1300 = todaySlots(courses, mon(13, 0), []);
  assert.deepEqual(at1300.map(r => r.state), ["now", "next", "later"]);
  assert.deepEqual(todaySlots(courses, mon(18, 0), []).map(r => r.state), ["done", "done", "done"]);
  assert.equal(todaySlots(courses, mon(9, 0), ["2026-10-05"]).length, 0);
  assert.equal(todaySlots(courses, new Date(2026, 11, 7, 9), []).length, 0, "after last date");
  assert.equal(todaySlots(courses, new Date(2026, 9, 10, 9), []).length, 0, "Saturday has none");
});
test("weekly view, schedule/slot consistency, codeOf", async () => {
  const entries = parseTimetableGrid(await readXlsxRows(ab("./fixtures/schedule-anon.xlsx"))).entries;
  const p = buildPlan(entries)[0];
  const week = weeklyTimetable([{ id: "x", name: "x", slots: p.slots }]);
  assert.equal(week.length, 6);
  assert.equal(slotsMatchSchedule(p.slots, p.schedule), true);
  assert.equal(slotsMatchSchedule(p.slots, { ...p.schedule, 1: 9 }), false);
  assert.deepEqual(scheduleFromSlots([{ day: 1 }, { day: 1 }, { day: 3 }]), { 1: 2, 3: 1 });
  assert.equal(codeOf("cse494 - Operating Systems"), "CSE494");
});
