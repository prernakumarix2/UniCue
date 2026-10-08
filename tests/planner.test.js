import test from "node:test";
import assert from "node:assert/strict";
import { countRemaining, countInRange, normalizeSchedule, courseInput, semesterInput, plan, project } from "../js/domain/planner.js";

const from = new Date(2026, 9, 5); // Mon 5 Oct 2026

test("remaining counts chosen weekdays after today, minus holidays, times classes per day", () => {
  assert.equal(countRemaining({ from, lastDate: "2026-10-18", schedule: { 1: 1, 3: 1 } }), 3);
  assert.equal(countRemaining({ from, lastDate: "2026-10-18", schedule: { 1: 1, 3: 1 }, holidays: ["2026-10-12"] }), 2);
  assert.equal(countRemaining({ from, lastDate: "2026-10-18", schedule: { 1: 2, 3: 2 } }), 6);
  assert.equal(countRemaining({ from, lastDate: "2026-10-18", schedule: {} }), 0);
});

test("plan: needed, must attend and can miss", () => {
  const p = plan({ conducted: 40, present: 37, remaining: 20, target: 85 });
  assert.deepEqual([p.total, p.needed, p.mustAttend, p.canMiss, p.feasible], [60, 51, 14, 6, true]);
});

test("plan: DL and bonus count toward attendance; unreachable targets are flagged", () => {
  const p = plan({ conducted: 40, present: 30, dl: 4, bonus: 4, remaining: 20, target: 85 });
  assert.equal(p.credited, 38);
  const bad = plan({ conducted: 40, present: 10, remaining: 5, target: 85 });
  assert.equal(bad.feasible, false);
});

test("project: skipping within the allowance stays safe, beyond it does not", () => {
  const i = { conducted: 40, present: 37, remaining: 20, target: 85 };
  assert.equal(project(i, 6).safe, true);
  assert.equal(project(i, 7).safe, false);
});

test("uneven class counts per weekday (SQL: Tue 1, Thu 2, Fri 2)", () => {
  const schedule = { 2: 1, 4: 2, 5: 2 };
  assert.equal(countRemaining({ from, lastDate: "2026-10-11", schedule }), 5); // Tue6 Thu8 Fri9
  assert.equal(countInRange({ start: new Date(2026, 9, 8), end: new Date(2026, 9, 9), schedule }), 4);
});

test("legacy weekdays+perDay still work, and bonus is one week of classes", () => {
  assert.deepEqual(normalizeSchedule({ weekdays: [1, 3], perDay: 2 }), { 1: 2, 3: 2 });
  const i = courseInput({ conducted: 10, attended: 8, target: 85, bonus: true, schedule: { 2: 1, 4: 2, 5: 2 } }, from);
  assert.equal(i.bonus, 5);
});

test("semester input sums courses", () => {
  const s = semesterInput([{ conducted: 10, attended: 8, target: 75 }, { conducted: 20, attended: 15, target: 75, dl: 2 }], 90, from);
  assert.deepEqual([s.conducted, s.present, s.dl, s.target], [30, 23, 2, 90]);
});

// ---- Owner's spreadsheet: INT315 on Mon 5 Oct 2026, semester ends 13 Dec ----
import { courseReport, outlook } from "../js/domain/planner.js";
const int315 = { conducted: 35, attended: 19, dl: 13, target: 85, lastDate: "2026-12-13", countedThrough: "2026-10-04", schedule: { 1: 2, 3: 1, 5: 1 }, bonus: false, holidays: ["2026-10-26", "2026-11-09"] };

test("spreadsheet check: 35 done, 19 present, 13 DL, 10 weeks left, 2 Monday holidays", () => {
  const r = courseReport(int315, from);
  assert.equal(r.absent, 3);
  assert.equal(r.weeksLeft, 10);
  assert.ok(Math.abs(r.current - 91.4286) < 0.001);
  assert.equal(r.remaining, 36);      // 10 weeks x 4 classes - 4 on the two holiday Mondays
  assert.equal(r.total, 71);
  assert.equal(r.allowedAbsences, 10); // 71 - ceil(85% of 71 = 60.35 -> 61)
  assert.equal(r.canMiss, 7);          // 10 allowed - 3 already absent
  assert.equal(r.mustAttend, 29);
});

test("bonus week adds to what you can miss", () => {
  const r = courseReport({ ...int315, bonus: true }, from);
  assert.equal(r.bonus, 4);
  assert.equal(r.canMiss, 11);
});

test("outlook copy", () => {
  assert.equal(outlook(courseReport(int315, from)).title, "Can miss 7 more classes");
  assert.equal(outlook(courseReport({ ...int315, lastDate: "" }, from)).title, "Add last date and class days");
});

import { leaveImpact, semesterLeave } from "../js/domain/planner.js";
test("leave planner: INT315 away Mon 12 - Fri 16 Oct costs 4 classes and stays safe", () => {
  const l = leaveImpact(int315, new Date(2026, 9, 12), new Date(2026, 9, 16), from);
  assert.equal(l.skip, 4);            // Mon 2 + Wed 1 + Fri 1
  assert.equal(l.margin, 3);          // can miss 7, leave uses 4
  assert.equal(l.after.safe, true);
});
test("leave planner: holidays and past dates cost nothing; too long a leave fails", () => {
  assert.equal(leaveImpact(int315, new Date(2026, 9, 26), new Date(2026, 9, 26), from).skip, 0);
  assert.equal(leaveImpact(int315, new Date(2026, 9, 1), new Date(2026, 9, 3), from).skip, 0);
  const l = leaveImpact(int315, new Date(2026, 9, 12), new Date(2026, 10, 6), from);
  assert.ok(l.margin < 0 && l.after.safe === false);
  const s = semesterLeave([int315], 85, new Date(2026, 9, 12), new Date(2026, 9, 16), from);
  assert.equal(s.skip, 4);
});
