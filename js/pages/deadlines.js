import { deadlineRepository } from "../repositories/deadline-repository.js";
import { getDeadlineGroup, sortDeadlines, getDueDateTime } from "../domain/deadlines.js";
import { buildIcs } from "../domain/ics.js";
import { formatDeadlineDue, relativeDue } from "../utils/dates.js";
import { escapeHtml } from "../utils/escape.js";
import { icon } from "../components/icons.js";
import { downloadText } from "../utils/download.js";
import { showToast } from "../components/toast.js";
import { upcomingExams, examCountdown, shareUrl, shareMessage } from "../domain/deadline-tools.js";
import { shareOrWhatsApp } from "../utils/share.js";

const GROUPS = [["overdue", "Overdue"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This week"], ["later", "Later"]];

export function renderDeadlines() {
  const items = sortDeadlines(deadlineRepository.getAll());
  const by = Object.fromEntries([...GROUPS.map(([k]) => [k, []]), ["completed", []]]);
  items.forEach(item => by[getDeadlineGroup(item)]?.push(item));
  const open = items.length - by.completed.length;
  const summary = open ? `${open} open${by.overdue.length ? ` · <span class="danger-text">${by.overdue.length} overdue</span>` : ""}` : "Nothing pending";
  return `<div class="page-header page-header-row"><div><h1 class="page-title">Deadlines</h1><p class="page-subtitle">${summary}</p></div>${items.length ? `<a class="button button-primary button-add" href="#/deadlines/new" aria-label="Add deadline"><span aria-hidden="true">+</span> Add</a>` : ""}</div>
    ${examStrip(items)}
    ${open ? `<button type="button" class="button button-tonal button-sm dl-export" data-cal-all>${icon("deadlines", 16)} Add all to calendar</button>` : ""}
    ${GROUPS.map(([key, title]) => group(title, by[key], key)).join("")}
    ${by.completed.length ? `<details class="dl-done"><summary><span>Completed</span><span class="admin-row-count">${by.completed.length}</span></summary>${rows(by.completed, "completed")}</details>` : ""}
    ${!items.length ? `<section class="empty-state card"><h2>No deadlines yet</h2><p class="muted">Add an academic deadline to start tracking your work.</p><a class="button button-primary" href="#/deadlines/new">Add Deadline</a></section>` : ""}`;
}

function examStrip(items) {
  const exams = upcomingExams(items).slice(0, 6);
  if (!exams.length) return "";
  return `<section class="exam-strip" aria-label="Upcoming exams"><h2 class="group-title">Exams</h2><div class="closing-row">${exams.map(({ item, days }) => `<a class="exam-card${days <= 3 ? " exam-soon" : ""}" href="#/deadlines/${encodeURIComponent(item.id)}/edit"><strong class="exam-days">${escapeHtml(examCountdown(days))}</strong><span class="exam-title">${escapeHtml(item.title)}</span><span class="exam-when">${escapeHtml(item.courseName ? `${item.courseName} · ` : "")}${escapeHtml(formatDeadlineDue(item))}</span></a>`).join("")}</div></section>`;
}

function group(title, items, key) {
  if (!items.length) return "";
  return `<section class="section dl-section"><h2 class="group-title${key === "overdue" ? " group-critical" : ""}">${title} <span class="dl-count">${items.length}</span></h2>${rows(items, key)}</section>`;
}

function rows(items, key) {
  return `<div class="card dl-group">${items.map(item => row(item, key)).join("")}</div>`;
}

function row(item, key) {
  const r = item.completed ? null : relativeDue(getDueDateTime(item));
  return `<div class="dl-row bucket-${key}${item.completed ? " done" : ""}">
    <button type="button" class="dl-check" data-deadline-toggle="${escapeHtml(item.id)}" aria-label="${item.completed ? "Mark not done" : "Mark done"}: ${escapeHtml(item.title)}" aria-pressed="${Boolean(item.completed)}">${item.completed ? icon("check", 16) : ""}</button>
    <a class="dl-main" href="#/deadlines/${encodeURIComponent(item.id)}/edit">
      <strong>${escapeHtml(item.title)}</strong>
      <span class="dl-meta"><span class="badge type-badge type-${escapeHtml(item.type)}">${escapeHtml(item.type)}</span>${r ? `<span class="chip chip-${r.tone}">${escapeHtml(r.label)}</span>` : ""}</span>
      <span class="dl-when">${item.courseName ? `${escapeHtml(item.courseName)} · ` : ""}${escapeHtml(formatDeadlineDue(item))}</span>
      ${item.notes ? `<span class="dl-notes">${escapeHtml(item.notes)}</span>` : ""}
    </a>
    <button type="button" class="icon-btn dl-cal" data-share="${escapeHtml(item.id)}" aria-label="Share with classmates: ${escapeHtml(item.title)}">${icon("share", 18)}</button>
    <button type="button" class="icon-btn dl-cal" data-cal="${escapeHtml(item.id)}" aria-label="Add to calendar: ${escapeHtml(item.title)}">${icon("deadlines", 18)}</button>
  </div>`;
}

export function bindDeadlines(root, rerender) {
  root.querySelectorAll("[data-deadline-toggle]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.deadlineToggle;
    const wasDone = button.getAttribute("aria-pressed") === "true";
    deadlineRepository.toggleComplete(id);
    rerender();
    if (!wasDone) showToast("Marked done", { actionLabel: "Undo", onAction: () => { deadlineRepository.toggleComplete(id); rerender(); } });
  }));
  root.querySelectorAll("[data-share]").forEach(button => button.addEventListener("click", () => {
    const item = deadlineRepository.getAll().find(d => d.id === button.dataset.share);
    if (item) shareOrWhatsApp({ text: shareMessage(item), url: shareUrl(item, location.href) });
  }));
  root.querySelectorAll("[data-cal]").forEach(button => button.addEventListener("click", () => {
    const item = deadlineRepository.getAll().find(d => d.id === button.dataset.cal);
    if (item) { downloadText("unicue-deadline.ics", buildIcs([item]), "text/calendar"); showToast("Calendar file ready. Open it to add the event."); }
  }));
  root.querySelector("[data-cal-all]")?.addEventListener("click", () => {
    const open = deadlineRepository.getAll().filter(d => !d.completed);
    downloadText("unicue-deadlines.ics", buildIcs(open), "text/calendar");
    showToast(`${open.length} deadline${open.length === 1 ? "" : "s"} exported. Open the file to add them.`);
  });
}
