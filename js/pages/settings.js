import { localStorageRepository } from "../repositories/local-storage.js";
import { buildBackup, parseBackup } from "../domain/backup.js";
import { getHolidays } from "../domain/holidays.js";
import { getTheme, setTheme } from "../theme.js";
import { escapeHtml } from "../utils/escape.js";
import { markBackedUp, getBackupState } from "../utils/backup-state.js";

const prettyDate = d => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const today = () => new Date().toISOString().slice(0, 10);

export function renderSettings() {
  const upcoming = getHolidays().filter(h => h.date >= today()).slice(0, 8);
  return `<div class="page-header"><a class="text-link" href="#/profile">← Profile</a><h1 class="page-title">Settings</h1></div>
  <div class="stack">
    <section class="card"><h2>Back up your data</h2><p class="muted">Attendance, deadlines, timetable and saved drives live only on this phone. Save a backup file before clearing browser data or changing phones.</p>
      <div class="form-actions"><button class="button button-primary" id="export-btn" type="button">Export backup</button><label class="button button-secondary file-btn">Import backup<input id="import-file" type="file" accept="application/json,.json" hidden></label></div>
      <p class="field-help" id="backup-msg" role="status">${(() => { const last = getBackupState().lastBackup; return last ? `Last backup: ${escapeHtml(new Date(last).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))}.` : "You have not made a backup on this phone yet."; })()}</p></section>
    <section class="card"><h2>University holidays</h2><p class="muted">These are skipped automatically when counting remaining classes.</p>
      ${upcoming.length ? `<ul class="holiday-list">${upcoming.map(h => `<li><span>${escapeHtml(h.name)}</span><span class="muted">${escapeHtml(prettyDate(h.date))}</span></li>`).join("")}</ul>` : `<p class="muted">No upcoming holidays listed.</p>`}</section>
  </div>`;
}

export function bindSettings(root, rerender) {
  const msg = root.querySelector("#backup-msg");
  root.querySelector("#export-btn")?.addEventListener("click", () => {
    const backup = buildBackup({
      attendance: localStorageRepository.getAttendance(),
      deadlines: localStorageRepository.getDeadlines(),
      semesterTarget: Number(localStorage.getItem("unicue_semester_target")) || null,
      theme: getTheme(),
      preferences: localStorageRepository.getPreferences()
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `unicue-backup-${today()}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    markBackedUp();
    msg.textContent = "Backup downloaded. Keep the file somewhere safe, like your email or Drive.";
  });
  root.querySelector("#import-file")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) { msg.textContent = result.error; return; }
    const { attendance, deadlines, semesterTarget, theme, preferences } = result.data;
    if (!window.confirm(`Replace the data on this phone with ${attendance.length} course(s) and ${deadlines.length} deadline(s) from the backup?`)) return;
    localStorageRepository.saveAttendance(attendance);
    localStorageRepository.saveDeadlines(deadlines);
    if (semesterTarget !== null) { try { localStorage.setItem("unicue_semester_target", String(semesterTarget)); } catch { /* ignore */ } }
    setTheme(theme);
    localStorageRepository.savePreferences({ ...localStorageRepository.getPreferences(), ...(preferences.placementProfile ? { placementProfile: preferences.placementProfile } : {}), savedDrives: preferences.savedDrives });
    msg.textContent = "Backup restored.";
    rerender();
  });
}
