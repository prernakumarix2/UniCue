import test from "node:test";
import assert from "node:assert/strict";

// Minimal localStorage so the repository and semester cache can run in Node.
const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), key: i => [...mem.keys()][i], get length() { return mem.size; } };

const { parseHolidayLines, formatHolidayLines, validateSemester, sanitizeSemester, applySemester, applySemesterFromMeta, resetSemester, getSemester } = await import("../js/domain/semester.js");
const { holidayDates, setHolidays } = await import("../js/domain/holidays.js");
const { attendanceRepository } = await import("../js/repositories/attendance-repository.js");

const NOW = new Date(2026, 9, 6);
test.beforeEach(() => { mem.clear(); resetSemester(); setHolidays([]); });

test("parseHolidayLines: ISO, day-first, names, ranges, dedupe, sorted", () => {
  const { holidays, errors } = parseHolidayLines("2026-11-07 to 2026-11-09 Diwali\n20/10/2026, Dussehra\n2026-10-20 duplicate ignored\n\n", NOW);
  assert.deepEqual(errors, []);
  assert.deepEqual(holidays, [{ date: "2026-10-20", name: "Dussehra" }, { date: "2026-11-07", name: "Diwali" }, { date: "2026-11-08", name: "Diwali" }, { date: "2026-11-09", name: "Diwali" }]);
});
test("parseHolidayLines: friendly errors for bad lines, reversed and huge ranges", () => {
  const e = parseHolidayLines("Diwali\n2026-11-09 to 2026-11-07 X\n2026-01-01 to 2026-12-31 Year", NOW).errors;
  assert.equal(e.length, 3);
  assert.match(e[0], /Line 1/); assert.match(e[1], /before the start/); assert.match(e[2], /at most 31/);
});
test("format -> parse round-trips and joins consecutive same-name days into a range", () => {
  const list = [{ date: "2026-11-07", name: "Diwali" }, { date: "2026-11-08", name: "Diwali" }, { date: "2026-11-09", name: "Diwali" }, { date: "2026-10-20", name: "Dussehra" }];
  const text = formatHolidayLines(list);
  assert.equal(text, "2026-10-20 Dussehra\n2026-11-07 to 2026-11-09 Diwali");
  assert.deepEqual(parseHolidayLines(text, NOW).holidays, [...list].sort((a, b) => a.date.localeCompare(b.date)));
});
test("validateSemester: valid, bad last day, bad holiday line", () => {
  assert.deepEqual(validateSemester({ lastDate: "2026-11-30", holidaysText: "2026-10-20 Dussehra" }, NOW).errors, []);
  assert.equal(validateSemester({ lastDate: "2026-02-30", holidaysText: "" }, NOW).errors.length, 1);
  assert.equal(validateSemester({ lastDate: "", holidaysText: "oops" }, NOW).errors.length, 1);
});
test("sanitizeSemester drops junk from an untrusted document", () => {
  const s = sanitizeSemester({ lastDate: "tomorrow", holidays: [{ date: "2026-10-20", name: "A".repeat(200) }, { date: "bad" }, null, { date: "2026-10-20" }, { date: "2026-02-31" }] });
  assert.equal(s.lastDate, ""); assert.equal(s.holidays.length, 1); assert.equal(s.holidays[0].name.length, 60);
  assert.equal(sanitizeSemester({}).holidays, null, "absent holidays stay null so the file list is kept");
  assert.equal(sanitizeSemester(null).lastDate, "");
});
test("applySemester: overrides the holiday list, reports change once, persists, ignores meta without semester", () => {
  setHolidays([{ date: "2026-12-25", name: "Christmas" }]);
  assert.equal(applySemesterFromMeta({ version: 1 }), false);
  assert.equal(applySemesterFromMeta({ semester: { lastDate: "2026-11-30", holidays: [{ date: "2026-10-20", name: "Dussehra" }] } }), true);
  assert.deepEqual(holidayDates(), ["2026-10-20"]);
  assert.equal(applySemesterFromMeta({ semester: { lastDate: "2026-11-30", holidays: [{ date: "2026-10-20", name: "Dussehra" }] } }), false, "same data: no re-render");
  assert.ok(mem.get("unicue_semester_cfg"));
});
test("a semester with no holidays field keeps the built-in list", () => {
  setHolidays([{ date: "2026-12-25", name: "Christmas" }]);
  applySemester({ lastDate: "2026-11-30" });
  assert.deepEqual(holidayDates(), ["2026-12-25"]);
});
test("attendance repository: courses inherit the semester last day at read time, never stored", () => {
  const own = attendanceRepository.create({ name: "Own", conducted: 1, attended: 1, dl: 0, target: 75, lastDate: "2026-12-15", schedule: { 1: 1 } });
  const bare = attendanceRepository.create({ name: "Bare", conducted: 1, attended: 1, dl: 0, target: 75, lastDate: "", schedule: { 1: 1 } });
  assert.equal(attendanceRepository.getById(bare.id).lastDate, "");
  applySemester({ lastDate: "2026-11-30" });
  assert.equal(attendanceRepository.getById(bare.id).lastDate, "2026-11-30");
  assert.equal(attendanceRepository.getById(own.id).lastDate, "2026-12-15", "own date wins");
  const raw = JSON.parse(mem.get([...mem.keys()].find(k => /attendance/i.test(k))));
  assert.equal(raw.find(c => c.id === bare.id).lastDate, "", "stored course untouched");
  applySemester({ lastDate: "2026-12-05" });
  assert.equal(attendanceRepository.getById(bare.id).lastDate, "2026-12-05", "later admin change reaches the course");
  attendanceRepository.update(bare.id, { conducted: 5 });
  assert.equal(JSON.parse(mem.get([...mem.keys()].find(k => /attendance/i.test(k)))).find(c => c.id === bare.id).lastDate, "", "update does not freeze the inherited date");
  attendanceRepository.delete(own.id);
  assert.equal(attendanceRepository.getAll().length, 1);
});
