// Semester settings the admin controls for every student: the last class day and the holiday list.
// Stored inside meta/content (the doc students already read for the version), so it costs no extra reads.
import { setHolidays } from "./holidays.js";
import { findDates } from "./smart-paste.js";

const KEY = "unicue_semester_cfg";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_HOLIDAYS = 250, MAX_RANGE_DAYS = 31;
const pad = n => String(n).padStart(2, "0");
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const realDate = s => { const [y, m, d] = s.split("-").map(Number); const x = new Date(y, m - 1, d); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d; };

let cfg = { lastDate: "", holidays: null }; // holidays: null = keep the built-in file list

export const getSemester = () => cfg;

/** Clean untrusted data (from Firestore or storage). holidays stays null when absent. */
export function sanitizeSemester(raw) {
  const lastDate = typeof raw?.lastDate === "string" && ISO.test(raw.lastDate) && realDate(raw.lastDate) ? raw.lastDate : "";
  let holidays = null;
  if (Array.isArray(raw?.holidays)) {
    const seen = new Set();
    holidays = raw.holidays.filter(h => h && typeof h.date === "string" && ISO.test(h.date) && realDate(h.date) && !seen.has(h.date) && seen.add(h.date))
      .slice(0, MAX_HOLIDAYS).map(h => ({ date: h.date, name: String(h.name ?? "").slice(0, 60) })).sort((a, b) => a.date.localeCompare(b.date));
  }
  return { lastDate, holidays };
}

/** Apply settings; returns true if anything changed. Holidays only override the file list when explicitly set. */
export function applySemester(raw, { persist = true } = {}) {
  const next = sanitizeSemester(raw);
  if (JSON.stringify(next) === JSON.stringify(cfg)) return false;
  cfg = next;
  if (cfg.holidays) setHolidays(cfg.holidays);
  if (persist) { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* private mode */ } }
  return true;
}
export const applySemesterFromMeta = meta => (meta && typeof meta.semester === "object" && meta.semester ? applySemester(meta.semester) : false);
export function loadStoredSemester() {
  try { const raw = JSON.parse(localStorage.getItem(KEY) || "null"); if (raw) applySemester(raw, { persist: false }); } catch { /* ignore */ }
}
export const resetSemester = () => { cfg = { lastDate: "", holidays: null }; };

/** "2026-11-07 to 2026-11-10 Diwali" / "07/11/2026 Diwali" lines -> { holidays, errors }. */
export function parseHolidayLines(text, now = new Date()) {
  const holidays = new Map(); const errors = [];
  String(text ?? "").split("\n").forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;
    const found = findDates(line, now);
    if (!found.length) { errors.push(`Line ${i + 1}: no date found in "${line.slice(0, 40)}".`); return; }
    const between = found.length >= 2 ? line.slice(found[0].index + found[0].length, found[1].index) : "";
    const isRange = found.length >= 2 && /^\s*(to|until|till|-|–|—)\s*$/i.test(between);
    let name = line;
    for (const d of [...found].sort((a, b) => b.index - a.index)) name = name.slice(0, d.index) + " " + name.slice(d.index + d.length);
    name = name.replace(/\b(to|until|till)\b/gi, " ").replace(/^[\s,:;\-–—]+|[\s,:;\-–—]+$/g, "").replace(/\s{2,}/g, " ").slice(0, 60);
    const add = date => { if (!holidays.has(date)) holidays.set(date, name); };
    if (isRange) {
      const [a, b] = [found[0].date, found[1].date];
      const days = (new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000;
      if (days < 0) { errors.push(`Line ${i + 1}: the end date is before the start date.`); return; }
      if (days >= MAX_RANGE_DAYS) { errors.push(`Line ${i + 1}: a holiday range can be at most ${MAX_RANGE_DAYS} days.`); return; }
      for (let k = 0; k <= days; k += 1) { const d = new Date(`${a}T00:00:00`); d.setDate(d.getDate() + k); add(isoOf(d)); }
    } else found.forEach(d => add(d.date));
  });
  if (holidays.size > MAX_HOLIDAYS) errors.push(`Too many holiday days (max ${MAX_HOLIDAYS}).`);
  return { holidays: [...holidays].map(([date, name]) => ({ date, name })).sort((a, b) => a.date.localeCompare(b.date)), errors };
}

/** Holiday list -> editable lines, joining consecutive days with the same name into a range. */
export function formatHolidayLines(list = []) {
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
  const lines = []; let i = 0;
  while (i < sorted.length) {
    let j = i;
    const next = d => { const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() + 1); return isoOf(x); };
    while (j + 1 < sorted.length && sorted[j + 1].date === next(sorted[j].date) && (sorted[j + 1].name || "") === (sorted[i].name || "")) j += 1;
    lines.push(`${sorted[i].date}${j > i ? ` to ${sorted[j].date}` : ""}${sorted[i].name ? ` ${sorted[i].name}` : ""}`);
    i = j + 1;
  }
  return lines.join("\n");
}

/** Admin form -> { value: { lastDate, holidays }, errors }. */
export function validateSemester({ lastDate = "", holidaysText = "" }, now = new Date()) {
  const errors = [];
  const last = String(lastDate).trim();
  if (last && !(ISO.test(last) && realDate(last))) errors.push("Last class day is not a valid date.");
  const parsed = parseHolidayLines(holidaysText, now);
  errors.push(...parsed.errors);
  return { value: { lastDate: last, holidays: parsed.holidays }, errors };
}
