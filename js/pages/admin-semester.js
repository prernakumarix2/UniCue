import { semesterRepository } from "../repositories/semester-repository.js";
import { getSemester, validateSemester, formatHolidayLines, parseHolidayLines } from "../domain/semester.js";
import { getHolidays } from "../domain/holidays.js";
import { getCurrentAdmin } from "../admin/auth.js";
import { escapeHtml } from "../utils/escape.js";
import { showToast } from "../components/toast.js";
import { icon } from "../components/icons.js";

export async function renderAdminSemester() {
  const admin = await getCurrentAdmin();
  if (!admin) return `<div class="page-header"><h1 class="page-title">Admin access required</h1><a class="button button-primary" href="#/admin">Admin Login</a></div>`;
  const cfg = getSemester();
  const holidays = cfg.holidays ?? getHolidays();
  return `<div class="page-header"><a class="back-link" href="#/admin/dashboard">${icon("chevron", 16)} Dashboard</a><h1 class="page-title">Semester &amp; holidays</h1><p class="page-subtitle">Applies to every student the next time they open UniCue. No redeploy needed.</p></div>
  <form id="semester-form" class="form-stack admin-form" novalidate>
    <fieldset><legend>Last class day</legend>
      <label>Last class day of the semester<input type="date" name="lastDate" value="${escapeHtml(cfg.lastDate)}"></label>
      <p class="muted">Used for any course where the student has not set their own last day.</p>
    </fieldset>
    <fieldset><legend>Holidays (no classes)</legend>
      <label>One per line<textarea name="holidaysText" rows="12" spellcheck="false" placeholder="2026-11-07 to 2026-11-10 Diwali&#10;2026-10-20 Dussehra">${escapeHtml(formatHolidayLines(holidays))}</textarea></label>
      <p class="muted">Formats: <code>2026-11-07 Diwali</code>, <code>07/11/2026 Diwali</code>, or a range <code>2026-11-07 to 2026-11-10 Diwali</code>. Weekends need no entry.</p>
      <p id="semester-count" class="muted" aria-live="polite"></p>
    </fieldset>
    <div id="semester-errors" class="form-errors" role="alert"></div>
    <button class="button button-primary" type="submit">Save for all students</button>
  </form>`;
}

export function bindAdminSemester(root, { navigate }) {
  const form = root.querySelector("#semester-form");
  if (!form) return;
  const errorBox = root.querySelector("#semester-errors");
  const count = root.querySelector("#semester-count");
  const area = form.elements.holidaysText;
  const refresh = () => { const r = parseHolidayLines(area.value); count.textContent = `${r.holidays.length} holiday day${r.holidays.length === 1 ? "" : "s"}${r.errors.length ? `, ${r.errors.length} line${r.errors.length === 1 ? "" : "s"} need fixing` : ""}.`; };
  area.addEventListener("input", refresh); refresh();

  let saving = false;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving) return;
    errorBox.textContent = "";
    const { value, errors } = validateSemester({ lastDate: form.elements.lastDate.value, holidaysText: area.value });
    if (errors.length) { errorBox.innerHTML = errors.map(escapeHtml).join("<br>"); return; }
    saving = true; const btn = form.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Saving…";
    try { await semesterRepository.save(value); showToast("Saved. Students get it next time they open the app."); navigate("#/admin/dashboard"); }
    catch (error) { errorBox.textContent = error.message || "Unable to save."; saving = false; btn.disabled = false; btn.textContent = "Save for all students"; }
  });
}
