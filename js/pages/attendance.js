import { courseReport, semesterReport, outlook } from "../domain/planner.js";
import { attendanceRepository } from "../repositories/attendance-repository.js";
import { escapeHtml } from "../utils/escape.js";

export function renderAttendance() {
  const courses = attendanceRepository.getAll();
  return `
    <div class="page-header page-header-row">
      <div>
        <h1 class="page-title">Attendance</h1>
        <p class="page-subtitle">Copy your numbers from UMS, UniCue does the planning.</p>
      </div>
      <a class="button button-primary button-add" href="#/attendance/course/new" aria-label="Add course"><span aria-hidden="true">+</span> Course</a>
    </div>
    <div class="chip-scroll"><a class="filter-chip" href="#/attendance/import">Import timetable</a><a class="filter-chip" href="#/attendance/timetable">Timetable</a><button type="button" class="filter-chip" data-share-setup>Share my setup</button></div>
    ${courses.length === 0
      ? `<section class="card empty-state"><h2>No courses yet</h2><p>Fastest: import the timetable you export from UMS. It sets up every course, class day and time at once.</p><a class="button button-primary" href="#/attendance/import">Import timetable</a><a class="button button-secondary" href="#/attendance/course/new">Add a course by hand</a></section>`
      : `<div class="course-list stack">${renderSemesterCard(courses)}${courses.map(renderCourseCard).join("")}</div>`}
  `;
}

export function getSemesterTarget() { try { return Number(localStorage.getItem("unicue_semester_target")) || 75; } catch { return 75; } }

export function ring(percent, target, size = "") {
  const r = 30, c = 2 * Math.PI * r, v = percent === null ? 0 : Math.min(100, percent);
  const tone = percent === null ? "idle" : percent >= target ? "ok" : percent >= target - 5 ? "warn" : "bad";
  return `<svg class="ring ring-${tone} ${size}" viewBox="0 0 72 72" role="img" aria-label="${percent === null ? "No data" : percent.toFixed(1) + " percent"}"><circle class="ring-track" cx="36" cy="36" r="${r}"/><circle class="ring-bar" cx="36" cy="36" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c - (c * v) / 100}" transform="rotate(-90 36 36)"/><text x="36" y="41" text-anchor="middle">${percent === null ? "—" : Math.round(percent) + "%"}</text></svg>`;
}

const fmtDay = iso => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function statLine(r) {
  return `<p class="stat-line"><span><b>${r.present}</b> present</span><span><b>${r.dl}</b> DL</span><span><b>${r.absent}</b> absent</span></p>`;
}

export function outlookPill(r, editHref) {
  const o = outlook(r);
  if (!r.hasPlan && r.current !== null) return `<a class="plan-pill pill-idle" href="${editHref}"><strong>${o.title}</strong><span>${o.sub}</span></a>`;
  return `<div class="plan-pill pill-${o.tone}"><strong>${escapeHtml(o.title)}</strong><span>${escapeHtml(o.sub)}</span></div>`;
}

export function asOfLine(r) {
  return `<span class="asof ${r.staleDays > 1 ? "stale" : ""}">${r.staleDays > 1 ? `Last updated ${fmtDay(r.countedThrough)} · ${r.staleDays} days old` : `Counted up to ${fmtDay(r.countedThrough)}`}</span>`;
}

export function renderSemesterCard(courses) {
  if (!courses.length) return "";
  const target = getSemesterTarget();
  const r = semesterReport(courses, target);
  return `<section class="card semester-card"><a class="course-main" href="#/attendance/planner">${ring(r.current, target)}<div class="course-info"><h2 class="section-title">Whole semester</h2>${statLine(r)}<p class="course-code">${r.conducted} conducted${r.hasPlan ? ` · ${r.weeksLeft} weeks left` : ""}</p></div></a>${outlookPill(r, "#/attendance")}<a class="button button-secondary" href="#/attendance/planner">Plan a trip or leave</a></section>`;
}

function renderCourseCard(course) {
  const r = courseReport(course);
  const id = encodeURIComponent(course.id);
  return `<article class="card course-card"><a class="course-main" href="#/attendance/course/${id}">${ring(r.current, course.target)}<div class="course-info"><h2 class="section-title">${escapeHtml(course.name)}</h2><p class="course-code">${course.code ? escapeHtml(course.code) + " · " : ""}${r.conducted} conducted</p>${statLine(r)}</div></a>${outlookPill(r, `#/attendance/course/${id}/edit`)}<div class="card-foot">${asOfLine(r)}<button class="button button-secondary button-sm" type="button" data-update="${escapeHtml(course.id)}">Update numbers</button></div></article>`;
}

export function bindAttendance(root, rerender) {
  root.querySelectorAll("[data-update]").forEach(btn => btn.addEventListener("click", () => openUpdateSheet(btn.dataset.update, rerender)));
}

// Quick-update sheet: type the numbers from UMS, absent is worked out for you.
export function openUpdateSheet(courseId, onDone) {
  const course = attendanceRepository.getById(courseId);
  if (!course) return;
  document.querySelector(".sheet-backdrop")?.remove(); document.body.classList.remove("sheet-open");
  const field = (key, label, value) => `<div class="stepper-row"><label for="u-${key}">${label}</label><div class="stepper"><button type="button" data-step="-1" data-for="${key}" aria-label="Decrease ${label}">−</button><input id="u-${key}" name="${key}" type="number" inputmode="numeric" min="0" step="1" value="${value}"><button type="button" data-step="1" data-for="${key}" aria-label="Increase ${label}">+</button></div></div>`;
  const wrap = document.createElement("div");
  wrap.className = "sheet-backdrop";
  wrap.innerHTML = `<form class="sheet" role="dialog" aria-modal="true" aria-label="Update ${escapeHtml(course.name)}" novalidate>
    <div class="sheet-grab" aria-hidden="true"></div>
    <h2>${escapeHtml(course.name)}</h2>
    <p class="muted">Enter the totals shown in UMS.</p>
    ${field("conducted", "Conducted", course.conducted)}${field("attended", "Present", course.attended)}${field("dl", "Duty leave (DL)", course.dl || 0)}
    <div class="absent-row"><span>Absent</span><strong id="u-absent">0</strong></div>
    <div class="seg" role="radiogroup" aria-label="Numbers include classes up to"><span class="seg-label">Numbers include classes up to</span>
      <label><input type="radio" name="through" value="yesterday" checked><span>Yesterday</span></label>
      <label><input type="radio" name="through" value="today"><span>Today</span></label></div>
    <p class="field-error" id="u-error" role="alert"></p>
    <div class="form-actions"><button class="button" type="button" data-close>Cancel</button><button class="button button-primary" type="submit">Save</button></div>
  </form>`;
  document.body.appendChild(wrap);
  const form = wrap.querySelector("form");
  const val = k => Math.max(0, parseInt(form.elements[k].value, 10) || 0);
  const refresh = () => {
    const absent = val("conducted") - val("attended") - val("dl");
    const out = form.querySelector("#u-absent");
    out.textContent = String(Math.max(0, absent));
    out.classList.toggle("bad", absent < 0);
    form.querySelector("#u-error").textContent = absent < 0 ? "Present plus DL can't be more than conducted." : "";
    return absent >= 0;
  };
  const close = () => { document.body.classList.remove("sheet-open"); window.removeEventListener("hashchange", close); wrap.remove(); };
  window.addEventListener("hashchange", close);
  wrap.addEventListener("click", e => { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
  form.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  form.addEventListener("input", refresh);
  form.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => { const i = form.elements[b.dataset.for]; i.value = Math.max(0, val(b.dataset.for) + Number(b.dataset.step)); refresh(); }));
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!refresh()) return;
    const d = new Date(); if (form.elements.through.value === "yesterday") d.setDate(d.getDate() - 1);
    const pad = n => String(n).padStart(2, "0");
    attendanceRepository.update(course.id, { conducted: val("conducted"), attended: val("attended"), dl: val("dl"), countedThrough: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` });
    close();
    onDone?.();
  });
  refresh();
  document.body.classList.add("sheet-open");
}
