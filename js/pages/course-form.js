import { slotsMatchSchedule } from "../domain/timetable.js";
import { attendanceRepository } from "../repositories/attendance-repository.js";
import { validateCourse } from "../domain/attendance.js";
import { localStorageRepository } from "../repositories/local-storage.js";
import { normalizeSchedule, iso, countedThrough } from "../domain/planner.js";
import { router } from "../router.js";

export function renderCourseForm({ courseId = null } = {}) {
  const existing = courseId ? attendanceRepository.getById(courseId) : null;
  const preferences = localStorageRepository.getPreferences();

  const values = existing ?? {
    name: "",
    code: "",
    conducted: 0,
    attended: 0,
    dl: 0,
    target: preferences.defaultAttendanceTarget ?? 75,
    lastDate: lastUsed("unicue_semester_end")
  };

  const isEdit = Boolean(existing);
  const presets = [75, 80, 85, 90, 95, 100];
  const isPreset = presets.includes(Number(values.target));

  return `
    <div class="page-header">
      <a class="back-link" href="${isEdit ? `#/attendance/course/${encodeURIComponent(courseId)}` : "#/attendance"}">← Back</a>
      <h1 class="page-title">${isEdit ? "Edit Course" : "Add Course"}</h1>
      <p class="page-subtitle">Type the totals from UMS. Absent is worked out for you.</p>
    </div>

    <form class="form card" id="course-form" novalidate>
      <div class="form-field">
        <label for="course-name">Course Name <span class="required">*</span></label>
        <input id="course-name" name="name" maxlength="150" required value="${escapeAttr(values.name)}" placeholder="e.g. Data Structures">
        <p class="field-error" data-error-for="name"></p>
      </div>

      <div class="form-field">
        <label for="course-code">Course Code</label>
        <input id="course-code" name="code" maxlength="50" value="${escapeAttr(values.code)}" placeholder="e.g. CSE205">
        <p class="field-error" data-error-for="code"></p>
      </div>

      <div class="form-grid course-form-grid three">
        <div class="form-field">
          <label for="conducted">Conducted <span class="required">*</span></label>
          <input id="conducted" name="conducted" type="number" min="0" step="1" inputmode="numeric" required value="${values.conducted}">
          <p class="field-error" data-error-for="conducted"></p>
        </div>
        <div class="form-field">
          <label for="attended">Present <span class="required">*</span></label>
          <input id="attended" name="attended" type="number" min="0" step="1" inputmode="numeric" required value="${values.attended}">
          <p class="field-error" data-error-for="attended"></p>
        </div>
        <div class="form-field">
          <label for="dl">DL</label>
          <input id="dl" name="dl" type="number" min="0" step="1" inputmode="numeric" value="${values.dl ?? 0}">
          <p class="field-error" data-error-for="dl"></p>
        </div>
      </div>
      <div class="absent-row"><span>Absent</span><strong id="absent-preview">0</strong></div>

      <div class="form-field">
        <label for="countedThrough">Numbers include classes up to</label>
        <input id="countedThrough" name="countedThrough" type="date" value="${escapeAttr(existing ? countedThrough(existing) : iso(yesterday()))}">
        <p class="field-help">Use today's date only if today's classes are already in the numbers above.</p>
      </div>

      <div class="form-field">
        <label for="target">Target Attendance</label>
        <select id="target" name="target">
          ${presets.map(value =>
            `<option value="${value}" ${Number(values.target) === value ? "selected" : ""}>${value}%</option>`
          ).join("")}
          <option value="custom" ${!isPreset ? "selected" : ""}>Custom</option>
        </select>
        <p class="field-help">This is your personal target for UniCue calculations, not an official LPU rule.</p>
        <p class="field-error" data-error-for="target"></p>
      </div>

      <div class="custom-target ${isPreset ? "hidden" : ""}">
        <div class="form-field">
          <label for="custom-target">Custom Target (%)</label>
          <input id="custom-target" name="customTarget" type="number" min="0" max="100" step="0.1" value="${isPreset ? "" : values.target}">
        </div>
      </div>

      <section class="card-inner plan-fields">
        <h2 class="section-title">Semester plan</h2>
        <p class="field-help">UniCue counts the classes left from these, minus university holidays.</p>
        <div class="form-field"><label for="lastDate">Last date of semester</label><input id="lastDate" name="lastDate" type="date" value="${escapeAttr(values.lastDate ?? "")}"></div>
        <div class="form-field"><span class="label">Classes on each day <span class="muted">(0 if none)</span></span><div class="day-grid">${[["Mon",1],["Tue",2],["Wed",3],["Thu",4],["Fri",5],["Sat",6]].map(([l,n]) => `<label class="day-count"><span>${l}</span><input type="number" name="cls${n}" min="0" max="8" step="1" inputmode="numeric" value="${(normalizeSchedule(values)[n]) || 0}"></label>`).join("")}</div></div>
        <div class="form-field"><label class="day-pick wide"><input type="checkbox" name="bonus" ${values.bonus ? "checked" : ""}><span>Bonus eligible (one week of this course\u2019s classes counted as DL)</span></label></div>
        <div class="form-field"><label for="holidays">Extra holidays for this course <span class="muted">(optional, YYYY-MM-DD, comma separated)</span></label><input id="holidays" name="holidays" value="${escapeAttr((values.holidays ?? []).join(", "))}"><p class="field-help">University holidays are added automatically.</p></div>
      </section>

      <div class="form-actions">
        <button class="button" type="button" id="cancel-course">Cancel</button>
        <button class="button button-primary" type="submit">${isEdit ? "Save Changes" : "Add Course"}</button>
      </div>
    </form>
  `;
}

export function bindCourseForm(root, { courseId = null } = {}) {
  const form = root?.querySelector("#course-form");
  if (!form) return;

  const absentOut = form.querySelector("#absent-preview");
  const refreshAbsent = () => {
    const n = k => Math.max(0, parseInt(form.elements[k].value, 10) || 0);
    const a = n("conducted") - n("attended") - n("dl");
    absentOut.textContent = String(Math.max(0, a));
    absentOut.classList.toggle("bad", a < 0);
  };
  ["conducted", "attended", "dl"].forEach(k => form.elements[k].addEventListener("input", refreshAbsent));
  refreshAbsent();

  const targetSelect = form.querySelector("#target");
  const customTarget = form.querySelector(".custom-target");

  targetSelect.addEventListener("change", () => {
    customTarget.classList.toggle("hidden", targetSelect.value !== "custom");
  });

  form.querySelector("#cancel-course").addEventListener("click", () => {
    router.go(courseId ? `/attendance/course/${encodeURIComponent(courseId)}` : "/attendance");
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    const formData = new FormData(form);
    const target = formData.get("target") === "custom"
      ? Number(formData.get("customTarget"))
      : Number(formData.get("target"));

    const result = validateCourse({
      name: formData.get("name"),
      code: formData.get("code"),
      conducted: Number(formData.get("conducted")),
      attended: Number(formData.get("attended")),
      dl: formData.get("dl"),
      target
    });

    form.querySelectorAll(".field-error").forEach(el => {
      el.textContent = "";
    });

    Object.entries(result.errors).forEach(([field, message]) => {
      const error = form.querySelector(`[data-error-for="${field}"]`);
      if (error) error.textContent = message;
    });

    if (!result.valid) return;

    const holidays = String(formData.get("holidays") || "").split(/[,\s]+/).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    Object.assign(result.value, {
      countedThrough: formData.get("countedThrough") || iso(yesterday()),
      lastDate: formData.get("lastDate") || "",
      schedule: Object.fromEntries([1,2,3,4,5,6].map(n => [n, Math.min(8, Math.max(0, parseInt(formData.get("cls" + n), 10) || 0))]).filter(([, c]) => c > 0)),
      bonus: formData.get("bonus") === "on",
      holidays
    });

    if (result.value.lastDate) { try { localStorage.setItem("unicue_semester_end", result.value.lastDate); } catch { /* ignore */ } }

    if (courseId) {
      const old = attendanceRepository.getById(courseId);
      if (old?.slots?.length && !slotsMatchSchedule(old.slots, result.value.schedule)) result.value.slots = []; // student changed the days by hand: the imported times no longer match
      attendanceRepository.update(courseId, result.value);
      router.go(`/attendance/course/${encodeURIComponent(courseId)}`);
    } else {
      const course = attendanceRepository.create(result.value);
      router.go(`/attendance/course/${encodeURIComponent(course.id)}`);
    }
  });
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d; }
function lastUsed(key) { try { return localStorage.getItem(key) || ""; } catch { return ""; } }
