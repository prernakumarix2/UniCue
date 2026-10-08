import { attendanceRepository } from "../repositories/attendance-repository.js";
import { decodeCourseSetup } from "../domain/course-share.js";
import { matchCourse, describeSchedule, applyPlan, importDefaults } from "../domain/timetable.js";
import { getSemester } from "../domain/semester.js";
import { escapeHtml } from "../utils/escape.js";
import { showToast } from "../components/toast.js";
import { errorState } from "../components/error-state.js";
import { icon } from "../components/icons.js";

// A classmate's course setup (class days and times only) arrives as a link. Validated and escaped.
export function renderSetupShared(payload) {
  const { value, error } = decodeCourseSetup(payload);
  const back = `<div class="page-header"><a class="back-link" href="#/attendance">${icon("chevron", 16)} Attendance</a></div>`;
  if (error) return back + errorState("Can't open this link", `${error} Ask your classmate to share it again.`);
  const existing = attendanceRepository.getAll();
  return `${back}<div class="page-header"><h1 class="page-title">Course setup from a classmate</h1><p class="page-subtitle">Class days and times only. No attendance numbers are included, you add your own.</p></div>
  <section class="card form-stack setup-shared" data-payload="${escapeHtml(payload)}">
    ${value.map((c, i) => { const m = matchCourse(existing, c.code); return `<label class="tt-plan"><input type="checkbox" data-plan="${i}" checked><span class="tt-plan-main"><strong>${escapeHtml(c.name)}</strong> <span class="badge">${m ? `Updates ${escapeHtml(m.name)}` : "New course"}</span><span class="muted">${escapeHtml(c.code)} · ${escapeHtml(describeSchedule(c.schedule))}</span></span></label>`; }).join("")}
    <p class="muted">Check these against your own timetable. Classmates in a different section may have different times.</p>
    <button type="button" class="button button-primary" id="setup-apply">Add to my courses</button>
  </section>`;
}

export function bindSetupShared(root, { navigate }) {
  const card = root.querySelector(".setup-shared");
  if (!card) return;
  root.querySelector("#setup-apply")?.addEventListener("click", () => {
    const { value } = decodeCourseSetup(card.dataset.payload);
    if (!value) return;
    const existing = attendanceRepository.getAll();
    const chosen = [...card.querySelectorAll("[data-plan]")].filter(b => b.checked).map(b => { const c = value[Number(b.dataset.plan)]; return { ...c, match: matchCourse(existing, c.code) }; });
    if (!chosen.length) return;
    let semesterEnd = getSemester().lastDate; if (!semesterEnd) { try { semesterEnd = localStorage.getItem("unicue_semester_end") || ""; } catch { /* ignore */ } }
    const { created, updated } = applyPlan(chosen, attendanceRepository, importDefaults(existing, semesterEnd));
    showToast(`${created ? `${created} added` : ""}${created && updated ? ", " : ""}${updated ? `${updated} updated` : ""}. Now add your own attended and conducted numbers.`);
    navigate("#/attendance");
  });
}
