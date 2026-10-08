import test from "node:test";
import assert from "node:assert/strict";
import { skipCheck, longestSafeTrip, courseVerdict, tripShareText } from "../js/domain/trip.js";
import { leaveImpact } from "../js/domain/planner.js";

const NOW = new Date(2026, 9, 5, 9); // Mon 5 Oct 2026
const course = (over = {}) => ({ id: "c1", name: "Maths", code: "MTH101", target: 75, conducted: 40, attended: 36, dl: 0,
  schedule: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, lastDate: "2026-11-30", countedThrough: "2026-10-04", ...over });
const day = (y, m, d) => new Date(y, m - 1, d);

test("skipCheck: plenty of buffer is safe with spare, tight is warn/bad", () => {
  const safe = skipCheck([course()], day(2026, 10, 6), NOW);
  assert.equal(safe.rows.length, 1);
  assert.equal(safe.overall, "ok");
  assert.ok(safe.rows[0].verdict.spare >= 1);
  const tight = skipCheck([course({ conducted: 40, attended: 20 })], day(2026, 10, 6), NOW);
  assert.ok(["warn", "bad"].includes(tight.overall));
});
test("skipCheck: weekend has no classes; already-counted day is idle, not 'safe'", () => {
  assert.equal(skipCheck([course()], day(2026, 10, 10), NOW).rows.length, 0);
  const counted = skipCheck([course({ countedThrough: "2026-10-06" })], day(2026, 10, 6), NOW);
  assert.equal(counted.rows[0].alreadyCounted, true);
  assert.equal(counted.overall, "idle");
});
test("courseVerdict tones follow margin", () => {
  assert.equal(courseVerdict({ hasPlan: false }).tone, "idle");
  assert.equal(courseVerdict({ hasPlan: true, feasible: false }).tone, "bad");
  assert.equal(courseVerdict({ hasPlan: true, feasible: true, margin: -1 }).tone, "bad");
  assert.equal(courseVerdict({ hasPlan: true, feasible: true, margin: 0 }).tone, "warn");
  assert.equal(courseVerdict({ hasPlan: true, feasible: true, margin: 3 }).spare, 3);
});
test("longestSafeTrip: the returned end date is safe and the next day is not", () => {
  const courses = [course({ conducted: 40, attended: 33 })];
  const t = longestSafeTrip(courses, 75, day(2026, 10, 12), NOW);
  assert.ok(t.lastSafe, "some trip is possible");
  const ok = leaveImpact(courses[0], day(2026, 10, 12), t.lastSafe, NOW);
  assert.ok(ok.margin >= 0);
  const next = new Date(t.lastSafe); next.setDate(next.getDate() + 1);
  assert.ok(leaveImpact(courses[0], day(2026, 10, 12), next, NOW).margin < 0, "one more day breaks the target");
  assert.deepEqual(t.blockedBy, ["Maths"]);
  assert.equal(t.days, Math.round((t.lastSafe - day(2026, 10, 12)) / 86400000) + 1);
});
test("longestSafeTrip: no plan -> unknown; already out of reach -> 0 days", () => {
  assert.equal(longestSafeTrip([course({ lastDate: "" })], 75, day(2026, 10, 12), NOW).unknown, true);
  const bad = longestSafeTrip([course({ conducted: 40, attended: 10 })], 75, day(2026, 10, 12), NOW);
  assert.equal(bad.days, 0); assert.equal(bad.lastSafe, null);
});
test("tripShareText states result without course numbers", () => {
  const txt = tripShareText({ from: day(2026, 10, 12), to: day(2026, 10, 15), skip: 4, atRiskNames: [], safeTarget: 75 });
  assert.match(txt, /12 Oct to 15 Oct/); assert.match(txt, /Safe/);
  assert.match(tripShareText({ from: day(2026, 10, 12), to: day(2026, 10, 12), skip: 1, atRiskNames: ["Maths"], safeTarget: 75 }), /Not safe: Maths/);
});
