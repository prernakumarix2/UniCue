// Trip / skip helpers built on the tested planner engine. No new attendance maths lives here:
// every number comes from planner.js (leaveImpact / semesterLeave), so screens can never disagree.
import { leaveImpact, semesterLeave, iso } from "./planner.js";
import { todaysClasses } from "./today.js";
import { holidayDates } from "./holidays.js";

const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Verdict for ONE course if the whole span is skipped. tone: ok | warn | bad | idle. */
export function courseVerdict(r) {
  if (!r.hasPlan) return { tone: "idle", title: "Set last date and class days", spare: null };
  if (!r.feasible) return { tone: "bad", title: "Already out of reach", spare: null };
  if (r.margin < 0) return { tone: "bad", title: "Don't skip", spare: r.margin };
  if (r.margin === 0) return { tone: "warn", title: "Safe, but your last spare", spare: 0 };
  return { tone: "ok", title: `Safe · ${r.margin} to spare`, spare: r.margin };
}

/**
 * "Can I skip this day?" for every course that has class that day.
 * Returns { date, rows: [{ course, count, skip, alreadyCounted, verdict }], overall: ok|warn|bad|idle }.
 * alreadyCounted = the numbers the student entered already include that day, so skipping changes nothing.
 */
export function skipCheck(courses, day, now = new Date()) {
  const date = startOfDay(day);
  const rows = todaysClasses(courses, date, holidayDates()).map(({ course, count }) => {
    const r = leaveImpact(course, date, date, now);
    const alreadyCounted = r.hasPlan && r.skip < count;
    return { course, count, skip: r.skip, alreadyCounted, verdict: alreadyCounted ? { tone: "idle", title: "Already counted in your numbers", spare: null } : courseVerdict(r) };
  });
  const live = rows.filter(r => !r.alreadyCounted && r.verdict.tone !== "idle");
  const overall = !live.length ? "idle" : live.some(r => r.verdict.tone === "bad") ? "bad" : live.some(r => r.verdict.tone === "warn") ? "warn" : "ok";
  return { date, rows, overall };
}

/**
 * Starting on `from`, how long can the student stay away before ANY course (or the overall target) drops below target?
 * Returns { unknown } (nothing to plan), { limitless } (never a problem), or
 * { lastSafe: Date | null, days, blockedBy: [course names] } where days counts calendar days from `from`.
 */
export function longestSafeTrip(courses, target, from, now = new Date()) {
  const planned = courses.filter(c => c.lastDate && Object.keys(c.schedule || {}).length || c.lastDate && (c.weekdays || []).length);
  if (!planned.length) return { unknown: true };
  const start = startOfDay(from);
  const horizon = new Date(`${planned.map(c => c.lastDate).sort().pop()}T00:00:00`);
  const limit = Math.min(400, Math.max(0, Math.round((horizon - start) / 86400000)));
  const ok = end => { const s = semesterLeave(courses, target, start, end, now); return s.atRisk.length === 0 && (s.after.safe || !s.all.hasPlan); };
  let lastSafe = null;
  for (let i = 0; i <= limit; i += 1) {
    const end = addDays(start, i);
    if (ok(end)) lastSafe = end;
    else {
      const s = semesterLeave(courses, target, start, end, now);
      return { lastSafe, days: lastSafe ? Math.round((lastSafe - start) / 86400000) + 1 : 0, blockedBy: s.atRisk.map(r => r.course.name) };
    }
  }
  return { limitless: true, lastSafe, days: limit + 1 };
}

/** Plain text for WhatsApp / share sheet. Contains no personal numbers beyond the result. */
export function tripShareText({ from, to, skip, atRiskNames = [], safeTarget }) {
  const fmt = d => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const span = +from === +to ? fmt(from) : `${fmt(from)} to ${fmt(to)}`;
  const result = atRiskNames.length ? `Not safe: ${atRiskNames.join(", ")} would drop below ${safeTarget}%.` : `Safe: every course stays above ${safeTarget}%.`;
  return `Trip check (${span}, ${skip} ${skip === 1 ? "class" : "classes"} missed)\n${result}\nChecked with UniCue.`;
}

export { iso };
