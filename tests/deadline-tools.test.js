import test from "node:test";
import assert from "node:assert/strict";
import { quickDates, upcomingExams, examCountdown, encodeShare, decodeShare, shareUrl, isDuplicateDeadline, shareMessage } from "../js/domain/deadline-tools.js";

const NOW = new Date(2026, 9, 5, 10); // Mon 5 Oct 2026

test("quickDates: Today, Tomorrow, then named days", () => {
  const q = quickDates(NOW);
  assert.deepEqual(q.slice(0, 4).map(x => x.label), ["Today", "Tomorrow", "Wed 7", "Thu 8"]);
  assert.equal(q[0].value, "2026-10-05"); assert.equal(q.length, 7);
});
test("upcomingExams: only student Exam entries ahead, today included, done/past/others excluded, sorted", () => {
  const items = [
    { id: "a", type: "Exam", title: "Maths", dueDate: "2026-10-20" },
    { id: "b", type: "Exam", title: "Today exam", dueDate: "2026-10-05" },
    { id: "c", type: "Exam", title: "Past", dueDate: "2026-10-01" },
    { id: "d", type: "Exam", title: "Done", dueDate: "2026-10-09", completed: true },
    { id: "e", type: "Quiz", title: "Quiz", dueDate: "2026-10-06" },
    { id: "f", type: "Exam", title: "Timed today earlier", dueDate: "2026-10-05", dueTime: "08:00" }
  ];
  const out = upcomingExams(items, NOW);
  assert.deepEqual(out.map(x => x.item.id), ["b", "f", "a"]);
  assert.equal(out[2].days, 15);
});
test("examCountdown wording", () => {
  assert.deepEqual([0, 1, 12].map(examCountdown), ["Today", "Tomorrow", "12 days"]);
});
test("share link round-trips, including unicode, time and notes", () => {
  const item = { title: "Maths CA-2 – अंक", courseName: "MTH101", type: "Assignment", dueDate: "2026-10-21", dueTime: "17:00", notes: "Submit on UMS" };
  const { value, error } = decodeShare(encodeShare(item));
  assert.equal(error, undefined);
  assert.deepEqual(value, { title: item.title, courseName: "MTH101", type: "Assignment", dueDate: "2026-10-21", dueTime: "17:00", notes: "Submit on UMS" });
  assert.match(shareUrl(item, "https://x.github.io/UniCue/#/deadlines"), /^https:\/\/x\.github\.io\/UniCue\/#\/shared\/[A-Za-z0-9_-]+$/);
});
test("decodeShare rejects garbage, oversize, wrong version, bad date; unknown type becomes Other; never throws", () => {
  for (const bad of ["", "!!!", "abc", null, undefined, "A".repeat(2500)]) assert.ok(decodeShare(bad).error, String(bad).slice(0, 10));
  const enc = o => { const raw = JSON.stringify(o); return Buffer.from(raw).toString("base64url"); };
  assert.ok(decodeShare(enc({ v: 2, t: "x", d: "2026-10-21" })).error);
  assert.ok(decodeShare(enc({ v: 1, t: "x", d: "21/10/2026" })).error);
  assert.ok(decodeShare(enc({ v: 1, t: "", d: "2026-10-21" })).error);
  assert.equal(decodeShare(enc({ v: 1, t: "x", y: "<script>", d: "2026-10-21" })).value.type, "Other");
  assert.equal(decodeShare(enc({ v: 1, t: "x".repeat(500), d: "2026-10-21" })).value.title.length, 150);
});
test("duplicate check ignores case; share message reads naturally", () => {
  assert.equal(isDuplicateDeadline({ title: "maths ca", dueDate: "2026-10-21" }, [{ title: "Maths CA", dueDate: "2026-10-21" }]), true);
  assert.equal(isDuplicateDeadline({ title: "maths ca", dueDate: "2026-10-22" }, [{ title: "Maths CA", dueDate: "2026-10-21" }]), false);
  assert.match(shareMessage({ type: "Quiz", title: "Unit 3", courseName: "PHY", dueDate: "2026-10-21" }), /^Quiz: Unit 3 \(PHY\), due 21 Oct/);
});
