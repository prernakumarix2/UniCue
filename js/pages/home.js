import { attendanceRepository } from "../repositories/attendance-repository.js";
import { deadlineRepository } from "../repositories/deadline-repository.js";
import { getDeadlineBucket, sortDeadlines, getDueDateTime } from "../domain/deadlines.js";
import { escapeHtml } from "../utils/escape.js";
import { placementRepository } from "../repositories/placement-repository.js";
import { informationRepository } from "../repositories/information-repository.js";
import { filterPlacements, getPlacementStatus } from "../domain/placements.js";
import { filterInformation } from "../domain/information.js";
import { timeAgo, formatDeadlineDue, relativeDue, formatDateTime } from "../utils/dates.js";
import { shortPackage } from "../utils/formatting.js";
import { renderSemesterCard } from "./attendance.js";
import { holidayDates } from "../domain/holidays.js";
import { todaysClasses, attentionItems } from "../domain/today.js";
import { isRead } from "../utils/read-state.js";
import { icon } from "../components/icons.js";
import { getSession, firstName } from "../auth/student-auth.js";
import { skipCheck } from "../domain/trip.js";
import { todaySlots } from "../domain/timetable.js";
import { setupProgress } from "../domain/setup.js";
import { backupDue } from "../domain/backup-reminder.js";
import { getBackupState } from "../utils/backup-state.js";
import { upcomingExams, examCountdown } from "../domain/deadline-tools.js";

const hello = () => { const n = firstName(getSession()); return n ? `, ${escapeHtml(n)}` : ""; };
const greeting = d => (d.getHours() < 12 ? "Good morning" : d.getHours() < 17 ? "Good afternoon" : "Good evening");

function todayCard(courses, attention, now) {
  const date = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
  const classes = todaysClasses(courses, now, holidayDates());
  const total = classes.reduce((n, c) => n + c.count, 0);
  const chipLine = courses.length
    ? (total ? `<div class="today-classes">${classes.map(c => `<a class="chip chip-class" href="#/attendance/course/${encodeURIComponent(c.course.id)}">${escapeHtml(c.course.code || c.course.name)}${c.count > 1 ? ` ×${c.count}` : ""}</a>`).join("")}</div>` : `<p class="muted today-none">No classes today.</p>`)
    : "";
  const slots = todaySlots(courses, now);
  const classLine = slots.length ? `<div class="today-timeline">${slots.map(({ course, slot, state }) => `<a class="tl-row tl-${state}" href="#/attendance/course/${encodeURIComponent(course.id)}"><span class="tl-time">${escapeHtml(slot.start)}</span><span class="tl-main"><strong>${escapeHtml(course.code || course.name)}</strong><span>${escapeHtml(slot.type === "L" ? "Lecture" : slot.type === "P" ? "Practical" : "Tutorial")} · ${escapeHtml(slot.room)}</span></span>${state === "next" ? '<span class="badge">Next</span>' : state === "now" ? '<span class="badge badge-live">Now</span>' : ""}</a>`).join("")}</div>` : chipLine;
  const rows = attention.map(a => `<a class="attn attn-${a.tone}" href="${a.href}"><span class="attn-ico">${icon(a.icon, 20)}</span><span class="attn-text"><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.sub)}</span></span>${icon("chevron", 18)}</a>`).join("");
  const clear = `<div class="attn attn-ok"><span class="attn-ico">${icon("check", 20)}</span><span class="attn-text"><strong>You're on track</strong><span>Nothing urgent right now.</span></span></div>`;
  return `<section class="card today-card"><div class="today-head"><div><p class="eyebrow">${escapeHtml(date)}</p><h1>${greeting(now)}${hello()}</h1></div>${total ? `<span class="today-count"><strong>${total}</strong> ${total === 1 ? "class" : "classes"}</span>` : ""}</div>${classLine}<div class="attn-list">${rows || clear}</div></section>`;
}

// First-run checklist, computed from real data. Hides itself when complete or when the student taps Hide.
function setupChecklist(courses, { welcome = false } = {}) {
  let hidden = false; try { hidden = localStorage.getItem("unicue_setup_hidden") === "1"; } catch { /* ignore */ }
  const p = setupProgress(courses);
  if (p.complete || (hidden && !welcome)) return "";
  const next = p.steps.find(s => !s.done);
  return `<section class="card setup-card"><div class="skip-head"><div><p class="eyebrow">${welcome ? "Welcome to UniCue" : "Finish setting up"}</p><h2 class="skip-title">${p.doneCount} of ${p.steps.length} done</h2></div>${welcome ? "" : '<button type="button" class="chip-button" data-hide-setup>Hide</button>'}</div>
    <ol class="setup-steps">${p.steps.map(s => `<li class="setup-step${s.done ? " done" : ""}${s === next ? " current" : ""}"><span class="setup-mark">${s.done ? icon("check", 16) : ""}</span><span class="setup-text"><strong>${escapeHtml(s.title)}</strong><span>${escapeHtml(s.sub)}</span></span>${s === next ? `<a class="chip-button" href="${s.href}">${escapeHtml(s.cta)}</a>` : ""}</li>`).join("")}</ol>
    ${welcome ? `<a class="muted setup-manual" href="#/attendance/course/new">Or add a course by hand</a>` : ""}</section>`;
}

// Gentle backup nudge: their data lives only on this phone.
function backupCard(courses, deadlines) {
  if (!backupDue({ hasData: courses.length > 0 || deadlines.length > 0, ...getBackupState() })) return "";
  return `<section class="card backup-card"><p class="eyebrow">Back up your data</p><p class="backup-text">Your attendance and deadlines live only on this phone. A backup file saves them if you change phones or clear your browser.</p><div class="form-actions"><a class="button button-secondary" href="#/settings">Back up now</a><button type="button" class="button button-ghost" data-snooze-backup>Later</button></div></section>`;
}

// "Can I skip today?" Shows today's classes, or tomorrow's when today has none. One row per course.
function skipCard(courses, now) {
  let check = skipCheck(courses, now, now); let label = "today";
  if (!check.rows.length) {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    check = skipCheck(courses, tomorrow, now); label = "tomorrow";
  }
  if (!check.rows.length) return "";
  const head = { ok: "Yes, you can skip", warn: "Careful: it uses your last spare", bad: "Don't skip", idle: "Nothing to check" }[check.overall];
  const rows = check.rows.map(r => `<a class="skip-row skip-${r.verdict.tone}" href="#/attendance/course/${encodeURIComponent(r.course.id)}"><span class="skip-name">${escapeHtml(r.course.code || r.course.name)}${r.count > 1 ? ` ×${r.count}` : ""}</span><span class="skip-verdict">${escapeHtml(r.verdict.title)}</span></a>`).join("");
  return `<section class="card skip-card"><div class="skip-head"><div><p class="eyebrow">Can I skip ${label}?</p><h2 class="skip-title skip-${check.overall}">${head}</h2></div><a class="chip-button" href="#/attendance/planner">Plan a trip</a></div><div class="skip-rows">${rows}</div></section>`;
}

// Next exam(s) within 30 days, added by the student themselves.
function examCard(deadlines) {
  const exams = upcomingExams(deadlines).filter(x => x.days <= 30).slice(0, 2);
  if (!exams.length) return "";
  return `<section class="card exam-home"><p class="eyebrow">Next exam</p>${exams.map(({ item, days }) => `<a class="exam-home-row${days <= 3 ? " exam-soon" : ""}" href="#/deadlines/${encodeURIComponent(item.id)}/edit"><span class="exam-home-name"><strong>${escapeHtml(item.title)}</strong>${item.courseName ? `<span class="muted">${escapeHtml(item.courseName)}</span>` : ""}</span><strong class="exam-days">${escapeHtml(examCountdown(days))}</strong></a>`).join("")}</section>`;
}

export async function renderHome() {
  const now = new Date();
  const courses = attendanceRepository.getAll();
  const allDeadlines = deadlineRepository.getAll();
  const deadlines = sortDeadlines(allDeadlines).filter(item => !item.completed && getDeadlineBucket(item) !== "overdue").slice(0, 3);

  // Remote sections load in parallel and fail independently, so local sections always render.
  const [infoResult, placementResult] = await Promise.allSettled([informationRepository.getPublished(), placementRepository.getPublished()]);
  const informationAvailable = infoResult.status === "fulfilled";
  const placementAvailable = placementResult.status === "fulfilled";
  const unavailable = result => result.reason?.message || "Could not load. Check your connection.";
  const active = informationAvailable ? filterInformation(infoResult.value, {}) : [];
  const information = active.filter(item => item.importance === "Critical" || item.importance === "Important").slice(0, 3);
  const critical = active.find(item => item.importance === "Critical" && !isRead(item.id)) || active.find(item => item.importance === "Critical");
  const placements = placementAvailable ? filterPlacements(placementResult.value, {}).filter(item => getPlacementStatus(item) !== "Closed").slice(0, 2) : [];
  const attention = attentionItems({ courses, deadlines: allDeadlines, placements, now });

  const addCourse = `<section class="card today-card"><div class="today-head"><div><p class="eyebrow">${escapeHtml(now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }))}</p><h1>${greeting(now)}${hello()}</h1></div></div><p class="muted">Set up once and UniCue tells you every day how many classes you can miss.</p>${attention.length ? `<div class="attn-list">${attention.map(a => `<a class="attn attn-${a.tone}" href="${a.href}"><span class="attn-ico">${icon(a.icon, 20)}</span><span class="attn-text"><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.sub)}</span></span>${icon("chevron", 18)}</a>`).join("")}</div>` : ""}</section>${setupChecklist(courses, { welcome: true })}`;

  return `
    ${critical ? `<a class="card critical-banner" href="#/information/${encodeURIComponent(critical.id)}"><span class="badge badge-Critical">Critical</span><strong>${escapeHtml(critical.title)}</strong></a>` : ""}
    ${courses.length ? todayCard(courses, attention, now) : addCourse}
    ${courses.length ? setupChecklist(courses) : ""}
    ${courses.length ? skipCard(courses, now) : ""}
    ${examCard(allDeadlines)}
    ${backupCard(courses, allDeadlines)}
    ${courses.length ? renderSemesterCard(courses) : ""}

    <section class="section">
      <div class="section-header"><h2 class="section-title">Upcoming deadlines</h2><a class="text-link" href="#/deadlines">View all</a></div>
      <div class="stack">
        ${deadlines.map(item => `<a class="card" href="#/deadlines/${encodeURIComponent(item.id)}/edit"><strong>${escapeHtml(item.title)}</strong><p class="muted">${escapeHtml(item.type)} · Due ${escapeHtml(formatDeadlineDue(item))}${(r => r ? ` <span class="chip chip-${r.tone}">${escapeHtml(r.label)}</span>` : "")(relativeDue(getDueDateTime(item)))}</p></a>`).join("")
          || `<div class="card"><p class="muted">No upcoming academic deadlines.</p><a class="button button-secondary" href="#/deadlines/new">Add deadline</a></div>`}
      </div>
    </section>

    <section class="section">
      <div class="section-header"><h2 class="section-title">Important messages</h2><a class="text-link" href="#/information">View all</a></div>
      <div class="stack">
        ${information.map(item => `<a class="card" href="#/information/${encodeURIComponent(item.id)}"><div class="card-row"><strong>${!isRead(item.id) ? '<span class="unread-dot"></span>' : ""}${escapeHtml(item.title)}</strong><span class="badge badge-${escapeHtml(item.importance)}">${escapeHtml(item.importance)}</span></div><p class="muted">${escapeHtml(item.category)} · ${escapeHtml(timeAgo(item.updatedAt || item.publishedAt))}</p></a>`).join("")
          || `<div class="card"><p class="muted">${informationAvailable ? "No critical or important notices are currently published." : escapeHtml("Notices are unavailable right now. " + unavailable(infoResult))}</p></div>`}
      </div>
    </section>

    <section class="section">
      <div class="section-header"><h2 class="section-title">Placement</h2><a class="text-link" href="#/placement">View opportunities</a></div>
      <div class="stack">
        ${placements.map(item => `<a class="card" href="#/placement/${encodeURIComponent(item.id)}"><div class="card-row"><strong>${escapeHtml(item.company)}</strong><span class="p-status p-status-${getPlacementStatus(item) === "Closing Soon" ? "soon" : "open"}">${escapeHtml(getPlacementStatus(item))}</span></div><p class="muted">${escapeHtml(item.role)}${shortPackage(item.salary) ? ` · ${escapeHtml(shortPackage(item.salary))}` : ""}</p>${item.applicationDeadline ? `<p class="muted">Apply by ${escapeHtml(formatDateTime(item.applicationDeadline))}</p>` : ""}</a>`).join("")
          || `<div class="card"><p class="muted">${placementAvailable ? "No current placement opportunities are available." : escapeHtml("Placement opportunities are unavailable right now. " + unavailable(placementResult))}</p></div>`}
      </div>
    </section>
  `;
}
