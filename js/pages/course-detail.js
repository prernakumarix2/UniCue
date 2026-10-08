import { courseReport } from "../domain/planner.js";
import { attendanceRepository } from "../repositories/attendance-repository.js";
import { router } from "../router.js";
import { escapeHtml } from "../utils/escape.js";
import { ring, asOfLine, outlookPill, openUpdateSheet } from "./attendance.js";

const row = (label, value, note = "") => `<div class="info-row"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</div>`;

export function renderCourseDetail({ courseId }) {
  const course = attendanceRepository.getById(courseId);
  if (!course) {
    return `<div class="route-not-found"><h1>Course not found</h1><p class="muted">This course may have been deleted.</p><a class="button button-primary" href="#/attendance">Back to Attendance</a></div>`;
  }
  const r = courseReport(course);
  const id = encodeURIComponent(course.id);
  const below = r.current !== null && r.current < course.target;
  const plan = r.hasPlan ? `
    <section class="card">
      <h2 class="section-title">To the end of the semester</h2>
      <div class="info-rows">
        ${row("Weeks left", r.weeksLeft)}
        ${row("Classes left", r.remaining, "after holidays")}
        ${row("Total classes", r.total, `${r.conducted} done + ${r.remaining} to come`)}
        ${r.bonus ? row("Bonus (as DL)", `+${r.bonus}`, "one week of classes") : ""}
        ${row(`Allowed absences at ${course.target}%`, r.allowedAbsences, `${r.total} total, you need ${r.needed}`)}
        ${row("Absent so far", r.absent)}
        ${row("Must attend", r.feasible ? `${r.mustAttend} of ${r.remaining}` : "Out of reach")}
        ${row("Can still miss", r.feasible ? r.canMiss : 0)}
      </div>
    </section>` : "";

  return `
    <div class="page-header">
      <a class="back-link" href="#/attendance">← Attendance</a>
      <div class="card-row">
        <div>
          <h1 class="page-title">${escapeHtml(course.name)}</h1>
          ${course.code ? `<p class="page-subtitle">${escapeHtml(course.code)}</p>` : ""}
        </div>
        <span class="badge ${below ? "badge-Critical" : "badge-status-published"}">${r.current === null ? "Not started" : below ? "Below target" : "On track"}</span>
      </div>
    </div>

    <section class="card detail-hero">
      ${ring(r.current, course.target, "ring-lg")}
      <div class="detail-numbers">
        <div><strong>${r.conducted}</strong><span>Conducted</span></div>
        <div><strong>${r.present}</strong><span>Present</span></div>
        <div><strong>${r.dl}</strong><span>DL</span></div>
        <div><strong>${r.absent}</strong><span>Absent</span></div>
      </div>
      <p class="muted detail-target">Target ${course.target}% · now ${r.current === null ? "—" : r.current.toFixed(2) + "%"}</p>
    </section>

    ${outlookPill(r, `#/attendance/course/${id}/edit`)}
    <div class="card-foot">${asOfLine(r)}</div>

    <section class="section stack">
      ${plan}
      <button class="button button-primary" type="button" id="update-numbers">Update numbers</button>
      <div class="form-actions">
        <a class="button" href="#/attendance/course/${id}/edit">Edit course</a>
        <button class="button danger-button" type="button" id="delete-course">Delete</button>
      </div>
    </section>`;
}

export function bindCourseDetail(root, { courseId, rerender }) {
  root?.querySelector("#update-numbers")?.addEventListener("click", () => openUpdateSheet(courseId, rerender));
  root?.querySelector("#delete-course")?.addEventListener("click", () => {
    if (!window.confirm("Delete this course? This will remove its attendance data from this device.")) return;
    attendanceRepository.delete(courseId);
    router.go("/attendance");
  });
}
