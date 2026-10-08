import test from "node:test";
import assert from "node:assert/strict";
import { setupProgress } from "../js/domain/setup.js";
import { encodeCourseSetup, decodeCourseSetup, courseSetupUrl } from "../js/domain/course-share.js";
import { attentionItems } from "../js/domain/today.js";
import { buildPlan, matchCourse, applyPlan, importDefaults, describeSchedule } from "../js/domain/timetable.js";

const NOW = new Date(2026, 9, 12, 9);
const course = over => ({ id: "c1", name: "Operating Systems", code: "CSE494", conducted: 30, attended: 27, dl: 0, target: 75, lastDate: "2026-11-30", countedThrough: "2026-10-11", schedule: { 2: 1, 4: 2 },
  slots: [{ day: 2, start: "12:50", end: "13:40", room: "33-501", type: "P" }, { day: 4, start: "12:50", end: "13:40", room: "33-510", type: "L" }, { day: 4, start: "13:40", end: "14:30", room: "33-510", type: "L" }], section: "K2P23PD", ...over });

test("setupProgress: empty -> 0/3; courses without numbers/date; complete", () => {
  assert.equal(setupProgress([]).doneCount, 0);
  const p = setupProgress([course({ conducted: 0, attended: 0, lastDate: "" })]);
  assert.deepEqual(p.steps.map(s => s.done), [true, false, false]);
  assert.match(p.steps[1].href, /course\/c1\/edit/);
  assert.equal(setupProgress([course()]).complete, true);
  assert.equal(setupProgress([course(), course({ id: "c2", conducted: 0 })]).steps[1].sub, "1 of 2 courses have numbers");
});
test("course setup link round-trips and never carries attendance numbers", () => {
  const payload = encodeCourseSetup([course()]);
  const raw = Buffer.from(payload, "base64url").toString();
  assert.ok(!/conducted|attended|"dl"|target/.test(raw), "no personal numbers in the link");
  const { value, error } = decodeCourseSetup(payload);
  assert.equal(error, undefined);
  assert.equal(value[0].code, "CSE494"); assert.equal(value[0].section, "K2P23PD"); assert.equal(value[0].lastDate, "2026-11-30");
  assert.deepEqual(value[0].schedule, { 2: 1, 4: 2 });
  assert.deepEqual(value[0].slots[2], { day: 4, start: "13:40", end: "14:30", room: "33-510", type: "L" });
  assert.match(courseSetupUrl([course()], "https://x.github.io/UniCue/#/attendance"), /^https:\/\/x\.github\.io\/UniCue\/#\/setup\/[A-Za-z0-9_-]+$/);
});
test("hand-entered course (no slots) shares its schedule counts", () => {
  const { value } = decodeCourseSetup(encodeCourseSetup([course({ slots: [], schedule: { 1: 2, 3: 1 } })]));
  assert.deepEqual(value[0].schedule, { 1: 2, 3: 1 }); assert.deepEqual(value[0].slots, []);
});
test("untrusted links: garbage, wrong version, oversize, bad fields dropped, never throws", () => {
  for (const bad of ["", "!!", "abc", null, "A".repeat(9500)]) assert.ok(decodeCourseSetup(bad).error);
  const enc = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  assert.ok(decodeCourseSetup(enc({ v: 2, k: [] })).error);
  assert.ok(decodeCourseSetup(enc({ v: 1, k: [{ c: "<script>", t: [[1, "1000", "1050", "A-1", "L"]] }] })).error, "bad code dropped");
  const r = decodeCourseSetup(enc({ v: 1, k: [{ c: "abc123", n: "N".repeat(300), l: "tomorrow", x: "bad section!", t: [[1, "1000", "1050", "A-1", "L"], [9, "1000", "1050", "A-1", "L"], [2, "2500", "2600", "A", "L"], [2, "1100", "1050", "A", "L"], [2, "1100", "1150", "<b>", "L"], [2, "1100", "1150", "A", "Z"]] }] }));
  assert.equal(r.value.length, 1);
  assert.equal(r.value[0].slots.length, 1, "only the valid slot survives");
  assert.equal(r.value[0].name.length, 80); assert.equal(r.value[0].lastDate, ""); assert.equal(r.value[0].section, ""); assert.equal(r.value[0].code, "ABC123");
});
test("applying a shared setup: new course gets name + last date, existing keeps its numbers", () => {
  const { value } = decodeCourseSetup(encodeCourseSetup([course(), course({ id: "z", name: "Maths", code: "MTH101", schedule: { 1: 1 }, slots: [{ day: 1, start: "10:00", end: "10:50", room: "1-1", type: "L" }] })]));
  const existing = [{ id: "mine", name: "OS", code: "cse494", conducted: 12, attended: 10, target: 80, lastDate: "2026-12-01" }];
  const calls = { create: [], update: [] };
  const repo = { create: x => calls.create.push(x), update: (id, x) => calls.update.push([id, x]) };
  const chosen = value.map(c => ({ ...c, match: matchCourse(existing, c.code) }));
  const res = applyPlan(chosen, repo, importDefaults(existing, "", NOW));
  assert.deepEqual(res, { created: 1, updated: 1 });
  assert.equal(calls.update[0][0], "mine"); assert.ok(!("conducted" in calls.update[0][1]));
  assert.equal(calls.create[0].name, "Maths"); assert.equal(calls.create[0].target, 80); assert.equal(calls.create[0].lastDate, "2026-11-30");
  assert.equal(describeSchedule({ 1: 2, 3: 1 }), "Mon ×2, Wed");
});
test("stale nudge: shows after 4 days, names the course, hidden for fresh data and zero-number courses", () => {
  const stale = course({ countedThrough: "2026-10-05" }); // 7 days old
  const items = attentionItems({ courses: [stale], now: NOW });
  const n = items.find(i => i.title === "Update your attendance numbers");
  assert.ok(n); assert.match(n.sub, /Operating Systems/); assert.match(n.href, /edit/);
  assert.equal(attentionItems({ courses: [course()], now: NOW }).some(i => i.title === "Update your attendance numbers"), false);
  assert.equal(attentionItems({ courses: [course({ conducted: 0, attended: 0, countedThrough: "2026-10-01" })], now: NOW }).some(i => i.title === "Update your attendance numbers"), false);
});
