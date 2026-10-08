import test from "node:test";
import assert from "node:assert/strict";
import {
  parseInformationForm, normalizeInformation, filterInformation, isActiveInformation, isExpiredInformation,
  sortInformation, parseImportantDates, parseAttachments, parseContacts, informationStatusPatch, formatImportantDatesText
} from "../js/domain/information.js";

// Exactly the field names the admin editor form submits.
const formData = (over = {}) => ({
  title: "Mid-term datesheet", category: "Examination", importance: "Critical", content: "Details here",
  sourceName: "LPU UMS", sourceUrl: "https://ums.lpu.in/x", actionLabel: "Open UMS", actionUrl: "https://ums.lpu.in/y",
  importantDatesText: "Registration closes | 2026-10-21 | 17:00\nExam starts | 2026-11-02",
  attachmentsText: "Datesheet PDF | https://example.com/d.pdf", contactsText: "Exam cell | exam@lpu.in",
  publishedAt: "2026-10-04T10:00", expiresAt: "2026-12-01T10:00", status: "published", ...over
});

test("PUBLISH: status=published from the editor is saved as published (was always draft)", () => {
  const { value, errors } = parseInformationForm({ ...formData(), verified: true });
  assert.deepEqual(errors, []);
  assert.equal(value.status, "published");
  assert.equal(value.verified, true);
});
test("draft stays draft and has no forced publishedAt", () => {
  const { value } = parseInformationForm(formData({ status: "draft", publishedAt: "" }));
  assert.equal(value.status, "draft");
  assert.equal(value.publishedAt, "");
});
test("publishing with blank publishedAt stamps it", () => {
  const { value } = parseInformationForm(formData({ publishedAt: "" }));
  assert.ok(Date.parse(value.publishedAt) > 0);
});
test("ACTION link from actionLabel/actionUrl is kept (was always dropped)", () => {
  const { value } = parseInformationForm(formData());
  assert.deepEqual(value.action, { label: "Open UMS", url: "https://ums.lpu.in/y" });
  assert.equal(parseInformationForm(formData({ actionLabel: "", actionUrl: "" })).value.action, null);
});
test("IMPORTANT DATES, attachments and contacts round-trip (were wiped on every save)", () => {
  const { value } = parseInformationForm(formData());
  assert.deepEqual(value.importantDates, [
    { label: "Registration closes", date: "2026-10-21", time: "17:00" },
    { label: "Exam starts", date: "2026-11-02" }
  ]);
  assert.deepEqual(value.attachments, [{ name: "Datesheet PDF", url: "https://example.com/d.pdf" }]);
  assert.deepEqual(value.contacts, [{ label: "Exam cell", value: "exam@lpu.in" }]);
  assert.equal(parseImportantDates(formatImportantDatesText(value.importantDates)).items.length, 2);
});
test("validation messages", () => {
  const bad = parseInformationForm(formData({
    title: " ", content: "", sourceUrl: "ftp://x", actionLabel: "Go", actionUrl: "",
    importantDatesText: "No date here", attachmentsText: "File | javascript:alert(1)", contactsText: "onlylabel",
    expiresAt: "2026-01-01T00:00"
  }));
  assert.ok(bad.errors.length >= 7, bad.errors.join("\n"));
  assert.equal(parseImportantDates("X | 2026-02-30").errors.length, 1); // impossible date
  assert.equal(parseImportantDates("X | 2026-02-10 | 9am").errors.length, 1);
  assert.equal(parseAttachments("A | javascript:alert(1)").errors.length, 1);
  assert.equal(parseContacts("a | b | c").items[0].value, "b | c");
});
test("expiry: default list hides expired, draft and manually-expired; direct link can tell", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const mk = (over) => ({ id: over.id, title: "t", category: "Academic", importance: "Normal", content: "c", status: "published", ...over });
  const items = [
    mk({ id: "ok" }),
    mk({ id: "future", expiresAt: "2026-11-01T00:00:00Z" }),
    mk({ id: "past", expiresAt: "2026-10-01T00:00:00Z" }),
    mk({ id: "draft", status: "draft" }),
    mk({ id: "manual", status: "expired" })
  ];
  assert.deepEqual(filterInformation(items, {}, now).map(i => i.id).sort(), ["future", "ok"]);
  assert.equal(isExpiredInformation(items[2], now), true);
  assert.equal(isExpiredInformation(items[4], now), true);
  assert.equal(isActiveInformation(items[3], now), false);
});
test("Critical is never buried under newer Normal items", () => {
  const sorted = sortInformation([
    { id: "n", importance: "Normal", updatedAt: "2026-10-09T00:00:00Z" },
    { id: "c", importance: "Critical", updatedAt: "2026-09-01T00:00:00Z" },
    { id: "i", importance: "Important", updatedAt: "2026-10-01T00:00:00Z" }
  ]);
  assert.deepEqual(sorted.map(x => x.id), ["c", "i", "n"]);
});
test("search and category filter", () => {
  const items = [
    { id: "1", status: "published", title: "Hostel notice", category: "University", importance: "Normal", content: "" },
    { id: "2", status: "published", title: "Exam", category: "Examination", importance: "Normal", content: "datesheet" }
  ];
  assert.deepEqual(filterInformation(items, { query: "datesheet" }).map(i => i.id), ["2"]);
  assert.deepEqual(filterInformation(items, { category: "University" }).map(i => i.id), ["1"]);
});
test("manager one-click publish sets publishedAt only if missing", () => {
  const now = new Date("2026-10-04T00:00:00Z");
  assert.equal(informationStatusPatch({}, "published", now).publishedAt, now.toISOString());
  assert.equal(informationStatusPatch({ publishedAt: "x" }, "published", now).publishedAt, undefined);
  assert.deepEqual(informationStatusPatch({}, "draft"), { status: "draft" });
});
test("legacy callers: normalize keeps existing arrays when none given", () => {
  const out = normalizeInformation({ title: "t", category: "Other", importance: "Normal", content: "c" }, { importantDates: [{ label: "a", date: "2026-01-01" }] });
  assert.equal(out.importantDates.length, 1);
});
