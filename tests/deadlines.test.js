import test from "node:test";
import assert from "node:assert/strict";
import { getDueDateTime, isOverdue, getDeadlineBucket, sortDeadlines, validateDeadline } from "../js/domain/deadlines.js";
import { formatDeadlineDue, toDate } from "../js/utils/dates.js";

test("date-only deadline is due at end of that local day", () => {
  const due = getDueDateTime({ dueDate: "2026-10-21" });
  assert.equal(due.getDate(), 21);
  assert.equal(due.getHours(), 23);
  assert.equal(isOverdue({ dueDate: "2026-10-21" }, new Date(2026, 9, 21, 20, 0)), false);
  assert.equal(isOverdue({ dueDate: "2026-10-21" }, new Date(2026, 9, 22, 0, 1)), true);
});
test("date-only label shows no fake time", () => {
  const label = formatDeadlineDue({ dueDate: "2026-10-21" });
  assert.match(label, /21/);
  assert.doesNotMatch(label, /:/);
});
test("explicit time is shown", () => {
  assert.match(formatDeadlineDue({ dueDate: "2026-10-21", dueTime: "17:00" }), /5:00/);
});
test("date-only strings parse as local, not UTC", () => {
  assert.equal(toDate("2026-10-21").getDate(), 21);
});
test("completed is never overdue; buckets", () => {
  assert.equal(isOverdue({ dueDate: "2020-01-01", completed: true }), false);
  assert.equal(getDeadlineBucket({ dueDate: "2020-01-01" }), "overdue");
  assert.equal(getDeadlineBucket({ dueDate: "2020-01-01", completed: true }), "completed");
});
test("sorting and validation", () => {
  const sorted = sortDeadlines([{ id: 2, dueDate: "2026-12-01" }, { id: 1, dueDate: "2026-11-01" }]);
  assert.deepEqual(sorted.map(x => x.id), [1, 2]);
  assert.ok(validateDeadline({ title: "", type: "Quiz", dueDate: "2026-10-21" }).title);
  assert.ok(validateDeadline({ title: "x", type: "Nope", dueDate: "2026-10-21" }).type);
  assert.ok(validateDeadline({ title: "x", type: "Quiz", dueDate: "2026-10-21", dueTime: "25:00" }).dueTime);
  assert.deepEqual(validateDeadline({ title: "x", type: "Quiz", dueDate: "2026-10-21" }), {});
});
