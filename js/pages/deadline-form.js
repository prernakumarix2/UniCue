import { deadlineRepository } from "../repositories/deadline-repository.js";
import { attendanceRepository } from "../repositories/attendance-repository.js";
import { DEADLINE_TYPES, validateDeadline } from "../domain/deadlines.js";
import { quickDates, shareUrl, shareMessage } from "../domain/deadline-tools.js";
import { escapeHtml } from "../utils/escape.js";
import { shareOrWhatsApp } from "../utils/share.js";
import { showToast } from "../components/toast.js";
import { icon } from "../components/icons.js";

export function renderDeadlineForm({ id } = {}) {
  const item = id ? deadlineRepository.getById(id) : null;
  const type = item?.type || "Assignment";
  const courses = attendanceRepository.getAll();
  const dates = quickDates();
  return `<div class="page-header"><a class="back-link" href="#/deadlines">${icon("chevron", 16)} Deadlines</a><h1 class="page-title">${item ? "Edit deadline" : "Add deadline"}</h1><p class="page-subtitle">Assignments, quizzes, labs and exams.</p></div>
    <form id="deadline-form" class="card form-stack" data-id="${escapeHtml(id || "")}" novalidate>
      <div class="field-block"><span class="field-label">What is it?</span>
        <div class="chip-scroll" role="radiogroup" aria-label="Type">${DEADLINE_TYPES.map(t => `<label class="chip-radio"><input type="radio" name="type" value="${escapeHtml(t)}" ${t === type ? "checked" : ""}><span>${escapeHtml(t)}</span></label>`).join("")}</div>
        <p class="muted exam-hint" ${type === "Exam" ? "" : "hidden"}>Add each exam with its date. UniCue counts down to it on Home and Deadlines.</p>
      </div>
      <label>Title<input name="title" maxlength="150" required value="${escapeHtml(item?.title || "")}" placeholder="e.g. CA-2 assignment"></label>
      <div class="field-block"><label>Course <span class="muted">(optional)</span><input name="courseName" maxlength="150" value="${escapeHtml(item?.courseName || "")}"></label>
        ${courses.length ? `<div class="chip-scroll" aria-label="Pick a course">${courses.map(c => `<button type="button" class="filter-chip" data-course="${escapeHtml(c.code || c.name)}">${escapeHtml(c.code || c.name)}</button>`).join("")}</div>` : ""}
      </div>
      <div class="field-block"><span class="field-label">When is it due?</span>
        <div class="chip-scroll" aria-label="Quick date">${dates.map(d => `<button type="button" class="filter-chip${d.value === item?.dueDate ? " active" : ""}" data-date="${d.value}">${escapeHtml(d.label)}</button>`).join("")}</div>
        <div class="form-grid"><label>Due date<input name="dueDate" type="date" required value="${escapeHtml(item?.dueDate || "")}"></label><label>Due time <span class="muted">(optional)</span><input name="dueTime" type="time" value="${escapeHtml(item?.dueTime || "")}"></label></div>
      </div>
      <label>Notes <span class="muted">(optional)</span><textarea name="notes" maxlength="1000" rows="3">${escapeHtml(item?.notes || "")}</textarea></label>
      <div id="deadline-errors" class="form-errors" role="alert"></div>
      <div class="form-actions"><a class="button button-secondary" href="#/deadlines">Cancel</a><button class="button button-primary" type="submit">${item ? "Save changes" : "Save deadline"}</button></div>
      ${item ? `<div class="form-actions"><button type="button" class="button button-tonal" id="deadline-share">${icon("share", 16)} Share with classmates</button><button type="button" class="button button-danger-quiet" id="deadline-delete">Delete</button></div>` : ""}
    </form>`;
}

export function bindDeadlineForm(root, { id, navigate }) {
  const form = root.querySelector("#deadline-form");
  if (!form) return;
  const dateInput = form.elements.dueDate;
  const syncDateChips = () => form.querySelectorAll("[data-date]").forEach(b => b.classList.toggle("active", b.dataset.date === dateInput.value));

  form.querySelectorAll("[data-date]").forEach(b => b.addEventListener("click", () => { dateInput.value = b.dataset.date; syncDateChips(); }));
  dateInput.addEventListener("input", syncDateChips);
  form.querySelectorAll("[data-course]").forEach(b => b.addEventListener("click", () => {
    form.elements.courseName.value = b.dataset.course;
    form.querySelectorAll("[data-course]").forEach(x => x.classList.toggle("active", x === b));
  }));
  form.querySelectorAll('input[name="type"]').forEach(r => r.addEventListener("change", () => { form.querySelector(".exam-hint").hidden = r.value !== "Exam" || !r.checked; }));

  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const errors = validateDeadline(data);
    const errorBox = form.querySelector("#deadline-errors");
    if (Object.keys(errors).length) { errorBox.innerHTML = Object.values(errors).map(escapeHtml).join("<br>"); return; }
    const payload = { ...data, dueAt: data.dueTime ? `${data.dueDate}T${data.dueTime}` : null };
    if (id) deadlineRepository.update(id, payload); else deadlineRepository.create(payload);
    navigate("#/deadlines");
  });

  form.querySelector("#deadline-share")?.addEventListener("click", () => {
    const item = deadlineRepository.getById(id);
    if (item) shareOrWhatsApp({ text: shareMessage(item), url: shareUrl(item, location.href) });
  });
  form.querySelector("#deadline-delete")?.addEventListener("click", () => {
    const old = deadlineRepository.getById(id);
    if (!old) return;
    deadlineRepository.delete(id);
    navigate("#/deadlines");
    showToast("Deadline deleted", { actionLabel: "Undo", onAction: () => { const { id: _drop, ...rest } = old; deadlineRepository.create(rest); navigate("#/deadlines"); } });
  });
}
