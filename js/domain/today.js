// "What do I need to do today?" — pure logic behind the Home dashboard.
import { normalizeSchedule, iso, courseReport, outlook } from "./planner.js";
import { getDeadlineGroup, getDueDateTime, sortDeadlines } from "./deadlines.js";
import { getPlacementStatus } from "./placements.js";

/** Classes scheduled for `now`'s weekday, skipping holidays and days after the course's last date. */
export function todaysClasses(courses, now = new Date(), holidayDates = []) {
  const day = iso(now);
  return courses.flatMap(course => {
    const count = normalizeSchedule(course)[now.getDay()] || 0;
    if (!count) return [];
    if (course.lastDate && day > course.lastDate) return [];
    if ([...holidayDates, ...(course.holidays || [])].includes(day)) return [];
    return [{ course, count }];
  });
}

/** Ranked, de-duplicated list of things that need attention (max `limit`). */
export function attentionItems({ courses = [], deadlines = [], placements = [], now = new Date(), limit = 4 } = {}) {
  const items = [];
  const open = sortDeadlines(deadlines.filter(d => !d.completed));
  for (const d of open) {
    const group = getDeadlineGroup(d, now);
    if (group === "overdue") items.push({ rank: 0, tone: "bad", icon: "deadlines", title: d.title, sub: "Overdue · " + (d.courseName || d.type), href: `#/deadlines/${encodeURIComponent(d.id)}/edit` });
  }
  for (const course of courses) {
    const r = courseReport(course, now);
    if (r.current !== null && r.current < course.target) {
      items.push({ rank: 1, tone: "bad", icon: "attendance", title: `${course.name} is below target`, sub: outlook(r).sub || outlook(r).title, href: `#/attendance/course/${encodeURIComponent(course.id)}` });
    }
  }
  for (const d of open) {
    const group = getDeadlineGroup(d, now);
    if (group === "today" || group === "tomorrow") items.push({ rank: 2, tone: "warn", icon: "deadlines", title: d.title, sub: `${group === "today" ? "Due today" : "Due tomorrow"} · ${d.courseName || d.type}`, href: `#/deadlines/${encodeURIComponent(d.id)}/edit` });
  }
  const stale = courses.map(c => ({ c, r: courseReport(c, now) })).filter(x => Number(x.c.conducted) > 0 && x.r.staleDays >= 4).sort((a, b) => b.r.staleDays - a.r.staleDays);
  if (stale.length) {
    items.push({ rank: 2.5, tone: "warn", icon: "attendance", title: "Update your attendance numbers", sub: `${stale.length === 1 ? stale[0].c.name : `${stale.length} courses`} · ${stale[0].r.staleDays} days old, so answers may be off`, href: stale.length === 1 ? `#/attendance/course/${encodeURIComponent(stale[0].c.id)}/edit` : "#/attendance" });
  }
  for (const p of placements) {
    if (getPlacementStatus(p, now) === "Closing Soon") items.push({ rank: 3, tone: "warn", icon: "placement", title: `${p.company}: register soon`, sub: p.role, href: `#/placement/${encodeURIComponent(p.id)}` });
  }
  return items.sort((a, b) => a.rank - b.rank).slice(0, limit);
}
