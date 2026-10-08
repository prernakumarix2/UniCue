// Timetable import: read the UMS weekly grid, turn it into per-course class days + time slots.
// A cell looks like "12:50 - 13:40: 33-509 - L - INT315K2P23PD" (time, room, L/P/T, course code + section).
// Student ID in the sheet is never read into the result.
import { holidayDates } from "./holidays.js";

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TYPE_NAME = { L: "Lecture", P: "Practical", T: "Tutorial" };
const pad = n => String(n).padStart(2, "0");
const CELL_RE = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*:?\s*([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\s*-\s*([A-Za-z])\s*-\s*([A-Za-z]{2,4}\d{3})([A-Za-z0-9]*)/g;

const dayOfHeader = text => {
  const i = DAY_LONG.findIndex(d => String(text).trim().toLowerCase().startsWith(d.slice(0, 3).toLowerCase()) && String(text).trim().length <= 12);
  return i;
};

/** Pull the course code (e.g. INT315) out of any text. */
export const codeOf = text => (String(text || "").toUpperCase().match(/[A-Z]{2,4}\d{3}/) || [""])[0];

/**
 * rows: string[][] from xlsx/csv/pasted table.
 * Returns { entries, ignoredSunday } or { error }.
 */
export function parseTimetableGrid(rows) {
  const grid = Array.isArray(rows) ? rows : [];
  let headerAt = -1, dayByCol = {};
  for (let r = 0; r < Math.min(grid.length, 30) && headerAt < 0; r += 1) {
    const map = {};
    (grid[r] || []).forEach((cell, c) => { const d = dayOfHeader(cell); if (d >= 0) map[c] = d; });
    if (Object.keys(map).length >= 3) { headerAt = r; dayByCol = map; }
  }
  if (headerAt < 0) return { error: "Couldn't find the weekday headings (Monday, Tuesday, ...). Export the timetable as Excel from UMS and try again." };

  const entries = []; const seen = new Set(); let ignoredSunday = 0;
  for (const row of grid.slice(headerAt + 1)) {
    for (const [col, day] of Object.entries(dayByCol)) {
      const cell = String((row || [])[col] ?? "");
      for (const m of cell.matchAll(CELL_RE)) {
        const start = +m[1] * 60 + +m[2], end = +m[3] * 60 + +m[4];
        if (m[1] > 23 || m[3] > 23 || +m[2] > 59 || +m[4] > 59 || end <= start) continue;
        const entry = { day, start: `${pad(+m[1])}:${m[2]}`, end: `${pad(+m[3])}:${m[4]}`, room: m[5], type: m[6].toUpperCase(), code: m[7].toUpperCase(), section: m[8].toUpperCase() };
        const key = `${entry.day}|${entry.start}|${entry.code}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (day === 0) ignoredSunday += 1; else entries.push(entry);
      }
    }
  }
  if (!entries.length) return { error: "Found the weekdays but no classes. Is this the right timetable file?" };
  return { entries, ignoredSunday };
}

/** Drops malformed slots (corrupt backup, hand-edited storage). Always returns a clean array. */
export function sanitizeSlots(slots) {
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!Array.isArray(slots)) return [];
  return slots.filter(s => s && Number.isInteger(s.day) && s.day >= 1 && s.day <= 6 && TIME.test(s.start || "") && TIME.test(s.end || "") && s.end > s.start
    && /^[A-Za-z0-9-]{1,12}$/.test(s.room || "") && /^[LPT]$/.test(s.type || "")).slice(0, 40).map(s => ({ day: s.day, start: s.start, end: s.end, room: s.room, type: s.type }));
}

export const scheduleFromSlots = slots => {
  const out = {};
  for (const s of slots || []) out[s.day] = (out[s.day] || 0) + 1;
  return out;
};
export const slotsMatchSchedule = (slots, schedule) => {
  const a = scheduleFromSlots(slots), b = schedule || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b).filter(k => b[k] > 0)]);
  return [...keys].every(k => (a[k] || 0) === (b[k] || 0));
};

function describe(slots) {
  const days = DAY_SHORT.slice(1).concat(DAY_SHORT[0]).filter(d => slots.some(s => DAY_SHORT[s.day] === d))
    .map(d => { const n = slots.filter(s => DAY_SHORT[s.day] === d).length; return n > 1 ? `${d} ×${n}` : d; });
  const kinds = Object.entries(slots.reduce((acc, s) => ({ ...acc, [s.type]: (acc[s.type] || 0) + 1 }), {}))
    .map(([t, n]) => `${n} ${(TYPE_NAME[t] || t).toLowerCase()}${n === 1 ? "" : "s"}`);
  return `${days.join(", ")} · ${kinds.join(", ")} a week`;
}

export function describeSchedule(schedule = {}) {
  return [1, 2, 3, 4, 5, 6].filter(d => schedule[d] > 0).map(d => (schedule[d] > 1 ? `${DAY_SHORT[d]} ×${schedule[d]}` : DAY_SHORT[d])).join(", ");
}

/** The student's existing course for a timetable code, or null. */
export function matchCourse(existing, code) {
  const same = v => String(v || "").trim().toLowerCase() === String(code).toLowerCase();
  return (existing || []).find(c => codeOf(c.code) === code || codeOf(c.name) === code || same(c.code) || same(c.name)) || null;
}

/** One plan item per course code, matched to the student's existing course (by code) when there is one. */
export function buildPlan(entries, existingCourses = []) {
  const byCode = new Map();
  for (const e of entries) {
    if (!byCode.has(e.code)) byCode.set(e.code, { code: e.code, section: e.section, slots: [] });
    byCode.get(e.code).slots.push({ day: e.day, start: e.start, end: e.end, room: e.room, type: e.type });
  }
  return [...byCode.values()].map(item => {
    item.slots.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
    const match = matchCourse(existingCourses, item.code);
    return { ...item, schedule: scheduleFromSlots(item.slots), summary: describe(item.slots), match };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

/** Defaults for brand-new courses, copied from what the student already uses. */
export function importDefaults(existing = [], semesterEnd = "", now = new Date()) {
  const counts = {};
  existing.forEach(c => { counts[c.target] = (counts[c.target] || 0) + 1; });
  const target = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) || 75;
  const lastDate = existing.map(c => c.lastDate).find(Boolean) || semesterEnd || "";
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return { target, lastDate, countedThrough: `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}` };
}

/** Apply selected plan items. Existing courses keep their attendance numbers: only schedule/slots/section change. */
export function applyPlan(items, repo, defaults) {
  let created = 0, updated = 0;
  for (const it of items) {
    const timetable = { schedule: it.schedule, slots: it.slots, section: it.section };
    if (it.match) { repo.update(it.match.id, timetable); updated += 1; }
    else {
      repo.create({ name: it.name || it.code, code: it.code, conducted: 0, attended: 0, dl: 0, target: defaults.target, lastDate: it.lastDate || defaults.lastDate, countedThrough: defaults.countedThrough, bonus: false, holidays: [], ...timetable });
      created += 1;
    }
  }
  return { created, updated };
}

const minutes = hhmm => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

/** Today's timed classes, sorted. state: done | now | next | later. Skips holidays and days after the course's last date. */
export function todaySlots(courses, now = new Date(), holidays = holidayDates()) {
  const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (holidays.includes(iso)) return [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const rows = [];
  for (const course of courses) {
    if ((course.holidays || []).includes(iso) || (course.lastDate && iso > course.lastDate)) continue;
    for (const slot of course.slots || []) if (slot.day === now.getDay()) rows.push({ course, slot });
  }
  rows.sort((a, b) => a.slot.start.localeCompare(b.slot.start));
  let nextSet = false;
  return rows.map(r => {
    const s = minutes(r.slot.start), e = minutes(r.slot.end);
    let state = e <= nowMin ? "done" : s <= nowMin ? "now" : "later";
    if (state === "later" && !nextSet) { state = "next"; nextSet = true; }
    return { ...r, state };
  });
}

/** Mon..Sat lists of { course, slot } for the weekly view. */
export function weeklyTimetable(courses) {
  return [1, 2, 3, 4, 5, 6].map(day => ({
    day,
    rows: courses.flatMap(course => (course.slots || []).filter(s => s.day === day).map(slot => ({ course, slot }))).sort((a, b) => a.slot.start.localeCompare(b.slot.start))
  }));
}
