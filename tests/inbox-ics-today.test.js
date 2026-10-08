import test from "node:test";
import assert from "node:assert/strict";
import { cleanMessageText, previewText, topicOf, groupRepeats } from "../js/domain/inbox.js";
import { buildIcs } from "../js/domain/ics.js";
import { todaysClasses, attentionItems } from "../js/domain/today.js";
import { getDeadlineGroup } from "../js/domain/deadlines.js";
import { timeAgo } from "../js/utils/dates.js";

const msg = (id, title, over = {}) => ({ id, title, category: "Placement", importance: "Normal", content: "", ...over });

test("cleanMessageText: invisible chars, tabs, ragged spaces, bullets, blank runs", () => {
  const out = cleanMessageText("Dear\u00A0students,\r\n\r\n\r\n\r\n•   Report\tat  9 AM\u200B\n   \n");
  assert.equal(out, "Dear students,\n\n- Report at 9 AM");
});
test("previewText flattens and truncates", () => {
  assert.equal(previewText("a\n\nb", 50), "a b");
  assert.ok(previewText("x".repeat(300), 20).endsWith("…"));
});
test("topicOf finds the company before the 'what happened' words", () => {
  assert.equal(topicOf(msg(1, "Google drive: registrations open")).key, "google");
  assert.equal(topicOf(msg(2, "Google – shortlist released")).key, "google");
  assert.equal(topicOf(msg(3, "TCS NQT Drive reminder")).key, "tcs nqt");
  assert.equal(topicOf(msg(4, "Library timings changed", { category: "General" })), null, "non-placement notices are never grouped");
});
test("groupRepeats collapses repeats, keeps Critical separate and order stable", () => {
  const items = [
    msg("a", "Google drive: shortlist out", { importance: "Important" }),
    msg("b", "Datesheet released", { importance: "Critical", category: "Examination" }),
    msg("c", "Google drive: registrations open"),
    msg("d", "Infosys drive: registrations open"),
    msg("e", "Google drive reminder")
  ];
  const out = groupRepeats(items);
  const g = out.find(e => e.type === "group");
  assert.equal(g.label, "Google");
  assert.equal(g.lead.id, "a");
  assert.deepEqual(g.rest.map(i => i.id), ["c", "e"]);
  assert.equal(out.filter(e => e.type === "single").length, 2, "Critical + lone Infosys stay single");
  assert.equal(out.length, 3);
});
test("Critical messages are never collapsed even when topics match", () => {
  const out = groupRepeats([msg("1", "Google drive: urgent", { importance: "Critical" }), msg("2", "Google drive: update", { importance: "Critical" })]);
  assert.equal(out.every(e => e.type === "single"), true);
});

test("ICS: timed + all-day events, escaping, reminder, CRLF", () => {
  const ics = buildIcs([
    { id: "d1", title: "OS Lab; part 1, final", type: "Lab", courseName: "OS", dueDate: "2026-10-06", dueTime: "23:59", notes: "Upload\nPDF" },
    { id: "d2", title: "Quiz", type: "Quiz", dueDate: "2026-10-31" },
    { id: "bad", title: "No date" }
  ], new Date("2026-10-05T10:00:00Z"));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTSTART:20261006T235900/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261101/);
  assert.match(ics, /SUMMARY:\[Lab\] OS Lab\\; part 1\\, final/);
  assert.match(ics, /DESCRIPTION:OS\\nUpload\\nPDF/);
  assert.match(ics, /TRIGGER:-P1D/);
  assert.ok(ics.split("\r\n").every(l => l.length <= 75));
});

test("todaysClasses honours weekday, holidays and last date", () => {
  const monday = new Date("2026-10-05T09:00:00");   // Monday
  const c = { id: "c", name: "DSA", schedule: { 1: 2 }, lastDate: "2026-12-01", holidays: [] };
  assert.equal(todaysClasses([c], monday, [])[0].count, 2);
  assert.equal(todaysClasses([c], monday, ["2026-10-05"]).length, 0, "global holiday");
  assert.equal(todaysClasses([{ ...c, holidays: ["2026-10-05"] }], monday, []).length, 0, "course holiday");
  assert.equal(todaysClasses([{ ...c, lastDate: "2026-10-01" }], monday, []).length, 0, "after last date");
  assert.equal(todaysClasses([c], new Date("2026-10-06T09:00:00"), []).length, 0, "Tuesday has none");
});
test("getDeadlineGroup splits upcoming into week and later", () => {
  const now = new Date("2026-10-05T10:00:00");
  assert.equal(getDeadlineGroup({ dueDate: "2026-10-09" }, now), "week");
  assert.equal(getDeadlineGroup({ dueDate: "2026-10-30" }, now), "later");
  assert.equal(getDeadlineGroup({ dueDate: "2026-10-04" }, now), "overdue");
  assert.equal(getDeadlineGroup({ dueDate: "2026-10-30", completed: true }, now), "completed");
});
test("attentionItems ranks overdue before attendance before due-soon, capped", () => {
  const now = new Date("2026-10-05T10:00:00");
  const course = { id: "c1", name: "DSA", target: 75, conducted: 20, attended: 10, dl: 0, countedThrough: "2026-10-04", lastDate: "2026-12-01", schedule: { 1: 1 } };
  const items = attentionItems({
    courses: [course], now,
    deadlines: [{ id: "a", title: "Tomorrow thing", type: "Lab", dueDate: "2026-10-06", dueTime: "10:00" }, { id: "b", title: "Late thing", type: "Quiz", dueDate: "2026-10-01" }],
    placements: []
  });
  assert.deepEqual(items.map(i => i.title), ["Late thing", "DSA is below target", "Tomorrow thing"]);
});
test("timeAgo", () => {
  const now = new Date("2026-10-05T12:00:00");
  assert.equal(timeAgo("2026-10-05T11:30:00", now), "30 min ago");
  assert.equal(timeAgo("2026-10-05T09:00:00", now), "3 h ago");
  assert.equal(timeAgo("2026-10-04T09:00:00", now), "Yesterday");
  assert.equal(timeAgo("2026-10-01T09:00:00", now), "4 days ago");
});
