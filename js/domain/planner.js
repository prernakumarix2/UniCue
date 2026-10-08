import { holidayDates } from "./holidays.js";

const EPS = 1e-9;
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// schedule = { weekday(0=Sun..6=Sat): classes that day }. Older saved courses used weekdays[] + perDay.
export function normalizeSchedule(course = {}) {
  if (course.schedule) {
    return Object.fromEntries(Object.entries(course.schedule).map(([d, n]) => [Number(d), Math.max(0, parseInt(n, 10) || 0)]).filter(([, n]) => n > 0));
  }
  return Object.fromEntries((course.weekdays || []).map(d => [d, Math.max(1, Number(course.perDay) || 1)]));
}
export const bonusClasses = schedule => Object.values(schedule).reduce((a, b) => a + b, 0);

// Classes from `start` through `end` (both inclusive), on scheduled weekdays, skipping holidays.
export function countInRange({ start, end, schedule = {}, holidays = [] }) {
  if (!start || !end) return 0;
  const skip = new Set(holidays);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let total = 0;
  for (; day <= last; day.setDate(day.getDate() + 1)) if (!skip.has(iso(day))) total += schedule[day.getDay()] || 0;
  return total;
}

// Remaining classes: from the day AFTER `from` through lastDate.
export function countRemaining({ from = new Date(), lastDate, schedule, weekdays, perDay, holidays = [] }) {
  if (!lastDate) return 0;
  const sched = schedule || normalizeSchedule({ weekdays, perDay });
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  return countInRange({ start, end: new Date(`${lastDate}T00:00:00`), schedule: sched, holidays });
}

const parseISO = value => new Date(`${value}T00:00:00`);
const DAY = 86400000;

// The last date whose classes are already inside conducted/present/DL.
// Older saved courses have no such date, so assume the numbers were entered yesterday-inclusive.
export function countedThrough(course = {}, now = new Date()) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(course.countedThrough || "")) return course.countedThrough;
  const base = course.updatedAt ? new Date(course.updatedAt) : now;
  return iso(new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1));
}

export function courseInput(course, now = new Date()) {
  const schedule = normalizeSchedule(course);
  const dl = course.dl || 0;
  return {
    conducted: course.conducted, present: course.attended, dl,
    bonus: course.bonus ? bonusClasses(schedule) : 0,
    remaining: countRemaining({ from: parseISO(countedThrough(course, now)), lastDate: course.lastDate, schedule, holidays: [...holidayDates(), ...(course.holidays || [])] }),
    target: course.target, schedule
  };
}

export function plan({ conducted, present, dl = 0, bonus = 0, remaining = 0, target }) {
  const credited = present + dl + bonus;
  const total = conducted + remaining;
  const needed = Math.ceil((target / 100) * total - EPS);
  const mustAttend = Math.max(0, needed - credited);
  return {
    total, needed, credited, mustAttend,
    absent: Math.max(0, conducted - present - dl),
    allowedAbsences: Math.max(0, total - needed),
    current: conducted > 0 ? (credited / conducted) * 100 : null,
    best: total > 0 ? ((credited + remaining) / total) * 100 : null,
    feasible: credited + remaining >= needed,
    canMiss: Math.max(0, remaining - mustAttend)
  };
}

// Result of skipping `skip` of the remaining classes.
export function project(input, skip) {
  const p = plan(input);
  const credited = p.credited + Math.max(0, input.remaining - skip);
  return { percent: p.total > 0 ? (credited / p.total) * 100 : null, safe: credited >= p.needed };
}

export function guidance(p, hasRemaining) {
  if (p.current === null) return "Add your classes so far to see guidance.";
  if (!hasRemaining) return "Set a last date and class days to plan ahead.";
  if (!p.feasible) return `Target out of reach. Best possible is ${p.best.toFixed(1)}%.`;
  if (p.mustAttend > 0) return `Attend ${p.mustAttend} more class${p.mustAttend === 1 ? "" : "es"} to reach your target.`;
  return p.canMiss > 0 ? `You can miss ${p.canMiss} more class${p.canMiss === 1 ? "" : "es"}.` : "Attend every class to stay on target.";
}

// Whole semester: sums every course's numbers.
export function semesterInput(courses, target, now = new Date()) {
  const rows = courses.map(c => courseInput(c, now));
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  return { conducted: sum("conducted"), present: sum("present"), dl: sum("dl"), bonus: sum("bonus"), remaining: sum("remaining"), target };
}

// One report per course: everything any screen needs, so pages can never disagree.
export function courseReport(course, now = new Date()) {
  const input = courseInput(course, now);
  const p = plan(input);
  const through = countedThrough(course, now);
  const hasPlan = Boolean(course.lastDate) && Object.keys(input.schedule).length > 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weeksLeft = hasPlan ? Math.max(0, Math.ceil((parseISO(course.lastDate) - parseISO(through)) / DAY / 7)) : 0;
  const staleDays = Math.max(0, Math.round((today - parseISO(through)) / DAY) - 1);
  return { ...p, ...input, hasPlan, weeksLeft, countedThrough: through, staleDays };
}

// Whole semester: sums every course, with its own target.
export function semesterReport(courses, target, now = new Date()) {
  const input = semesterInput(courses, target, now);
  const reports = courses.map(c => courseReport(c, now));
  return { ...plan(input), ...input, hasPlan: reports.some(r => r.hasPlan), weeksLeft: Math.max(0, ...reports.map(r => r.weeksLeft)), staleDays: Math.max(0, ...reports.map(r => r.staleDays)) };
}

// Short copy for the pill under each card.
export function outlook(r) {
  if (r.current === null) return { tone: "idle", title: "Add your classes so far", sub: "Then UniCue can plan the rest." };
  if (!r.hasPlan) return { tone: "idle", title: "Add last date and class days", sub: "Needed to plan the rest of the semester." };
  if (r.remaining === 0) return { tone: r.current >= r.target ? "ok" : "bad", title: "No classes left", sub: `Final ${r.current.toFixed(1)}% against a ${r.target}% target.` };
  if (!r.feasible) return { tone: "bad", title: "Target out of reach", sub: `Best possible is ${r.best.toFixed(1)}%. Attend all ${r.remaining} remaining.` };
  const sub = `Attend ${r.mustAttend} of the ${r.remaining} classes left · target ${r.target}%`;
  if (r.canMiss === 0) return { tone: "warn", title: "Can't miss any class", sub };
  return { tone: "ok", title: `Can miss ${r.canMiss} more ${r.canMiss === 1 ? "class" : "classes"}`, sub: r.mustAttend === 0 ? `Target ${r.target}% already safe.` : sub };
}

// ---- Leave planner ----
// Classes you'd miss in [from, to] for one course, and what that does to the end-of-semester result.
export function leaveImpact(course, from, to, now = new Date()) {
  const r = courseReport(course, now);
  let skip = 0;
  if (from && to && course.lastDate) {
    const first = parseISO(r.countedThrough); first.setDate(first.getDate() + 1);
    const last = parseISO(course.lastDate);
    const start = from > first ? from : first;
    const end = to < last ? to : last;
    skip = Math.min(r.remaining, countInRange({ start, end, schedule: r.schedule, holidays: [...holidayDates(), ...(course.holidays || [])] }));
  }
  return { ...r, skip, after: project(r, skip), margin: r.hasPlan ? (r.remaining - r.mustAttend) - skip : null };
}

export function semesterLeave(courses, target, from, to, now = new Date()) {
  const rows = courses.map(c => ({ course: c, ...leaveImpact(c, from, to, now) }));
  const all = semesterReport(courses, target, now);
  const skip = rows.reduce((a, r) => a + r.skip, 0);
  return { rows, skip, all, after: project(all, skip), margin: all.hasPlan ? (all.remaining - all.mustAttend) - skip : null, atRisk: rows.filter(r => r.hasPlan && r.margin < 0) };
}
