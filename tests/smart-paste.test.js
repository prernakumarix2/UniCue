import test from "node:test";
import assert from "node:assert/strict";
import { smartPaste, findSimilar, findDates } from "../js/domain/smart-paste.js";
import { nextDateOf, topicOf } from "../js/domain/inbox.js";
import { parseInformationForm } from "../js/domain/information.js";

const NOW = new Date(2026, 9, 5); // 5 Oct 2026

const RAW = `Announcement\u00A0
Reporting

Google Campus Drive: Registration open
Dear Students,
All eligible students must register on UMS before 21 Oct 2026 at 5:00 PM.
Online test on 25/10/2026.
Contact: tpc@lpu.in or 9876543210
Apply: https://ums.lpu.in/drive/123.`;

test("smartPaste skips header junk and fills title, category, company", () => {
  const r = smartPaste(RAW, NOW);
  assert.equal(r.title, "Google Campus Drive: Registration open");
  assert.equal(r.category, "Placement");
  assert.equal(r.company, "Google Campus");
  assert.ok(!r.content.startsWith("Google Campus Drive"), "title line is not repeated in content");
});
test("smartPaste finds dates with time, links and contacts", () => {
  const r = smartPaste(RAW, NOW);
  assert.deepEqual(r.importantDates.map(d => d.date), ["2026-10-21", "2026-10-25"]);
  assert.equal(r.importantDates[0].time, "17:00");
  assert.equal(r.actionUrl, "https://ums.lpu.in/drive/123");
  assert.deepEqual(r.contacts.map(c => c.value), ["tpc@lpu.in", "9876543210"]);
  assert.match(r.summary, /must register/i);
  assert.equal(r.importance, "Important");
});
test("Critical keywords raise importance and explain why", () => {
  const r = smartPaste("Classes suspended\nRegular classes are suspended for 10 days.", NOW);
  assert.equal(r.importance, "Critical");
  assert.ok(r.notes.some(n => /suspended/.test(n)));
});
test("findDates: day-first, month names, no-year rolls forward, invalid ignored", () => {
  assert.equal(findDates("on 03/04/2026", NOW)[0].date, "2026-04-03");
  assert.equal(findDates("21st October", NOW)[0].date, "2026-10-21");
  assert.equal(findDates("by 2 Jan", NOW)[0].date, "2027-01-02");
  assert.equal(findDates("31/02/2026", NOW).length, 0);
});
test("empty paste never throws", () => {
  assert.equal(smartPaste("", NOW).content, "");
  assert.deepEqual(smartPaste("   ", NOW).importantDates, []);
});
test("findSimilar flags near-duplicate titles and same-company posts, ignores unrelated and self", () => {
  const items = [
    { id: "1", title: "Google campus drive registration open", status: "published", updatedAt: "2026-10-04T10:00:00Z" },
    { id: "2", title: "Library timings changed", status: "published", updatedAt: "2026-10-04T10:00:00Z" },
    { id: "3", title: "Google shortlist released", category: "Placement", status: "published", updatedAt: "2026-10-03T10:00:00Z" },
    { id: "4", title: "Old Google drive", category: "Placement", status: "expired", updatedAt: "2026-10-03T10:00:00Z" }
  ];
  const out = findSimilar({ title: "Google campus drive registration is open", company: "Google" }, items, { now: NOW });
  assert.deepEqual(out.map(m => m.item.id), ["1", "3"]);
  assert.equal(findSimilar({ title: "Google campus drive registration open" }, items, { excludeId: "1", now: NOW }).some(m => m.item.id === "1"), false);
});
test("explicit company groups exactly and summary/company are saved", () => {
  assert.equal(topicOf({ title: "Anything", company: " IBM " }).key, "ibm");
  const { value, errors } = parseInformationForm({ title: "T", category: "Placement", importance: "Normal", content: "c", summary: " Do X ", company: "IBM", status: "draft" });
  assert.deepEqual(errors, []);
  assert.equal(value.summary, "Do X");
  assert.equal(value.company, "IBM");
});
test("nextDateOf returns the soonest upcoming date only", () => {
  const item = { importantDates: [{ label: "Old", date: "2026-10-01" }, { label: "Later", date: "2026-10-25" }, { label: "Soon", date: "2026-10-07" }] };
  const n = nextDateOf(item, NOW);
  assert.equal(n.label, "Soon"); assert.equal(n.days, 2);
  assert.equal(nextDateOf({ importantDates: [{ label: "x", date: "2026-09-01" }] }, NOW), null);
});
