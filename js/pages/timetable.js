import { attendanceRepository } from "../repositories/attendance-repository.js";
import { readXlsxRows } from "../utils/xlsx-lite.js";
import { parseDelimited } from "../utils/csv.js";
import { parseTimetableGrid, buildPlan, applyPlan, importDefaults, weeklyTimetable, DAY_LONG } from "../domain/timetable.js";
import { getSemester } from "../domain/semester.js";
import { escapeHtml } from "../utils/escape.js";
import { showToast } from "../components/toast.js";
import { icon } from "../components/icons.js";

const TYPE_LABEL = { L: "Lecture", P: "Practical", T: "Tutorial" };
const MAX_BYTES = 5 * 1024 * 1024;

/* ---------------- Weekly timetable ---------------- */
export function renderTimetable() {
  const courses = attendanceRepository.getAll();
  const week = weeklyTimetable(courses);
  const back = `<div class="page-header page-header-row"><div><a class="back-link" href="#/attendance">${icon("chevron", 16)} Attendance</a><h1 class="page-title">Timetable</h1></div><div class="chip-scroll"><a class="button button-secondary button-sm" href="#/attendance/import">Import</a><button type="button" class="button button-secondary button-sm" data-share-setup>Share</button></div></div>`;
  if (!week.some(d => d.rows.length)) return `${back}<section class="card empty-state"><h2>No timetable yet</h2><p class="muted">Import the timetable you export from UMS and UniCue fills in your class days and times.</p><a class="button button-primary" href="#/attendance/import">Import timetable</a></section>`;
  const today = new Date().getDay();
  return `${back}<div class="stack">${week.filter(d => d.rows.length).map(d => `<section class="card tt-day${d.day === today ? " tt-today" : ""}"><h2 class="tt-day-name">${DAY_LONG[d.day]}${d.day === today ? ' <span class="badge">Today</span>' : ""}</h2>${d.rows.map(({ course, slot }) => `<a class="tt-row" href="#/attendance/course/${encodeURIComponent(course.id)}"><span class="tt-time">${escapeHtml(slot.start)}<small>${escapeHtml(slot.end)}</small></span><span class="tt-main"><strong>${escapeHtml(course.code || course.name)}</strong><span class="muted">${escapeHtml(TYPE_LABEL[slot.type] || slot.type)} · Room ${escapeHtml(slot.room)}</span></span></a>`).join("")}</section>`).join("")}</div>`;
}

/* ---------------- Import ---------------- */
export function renderTimetableImport() {
  return `<div class="page-header"><a class="back-link" href="#/attendance">${icon("chevron", 16)} Attendance</a><h1 class="page-title">Import timetable</h1><p class="page-subtitle">Set up all your courses, class days and times in one step.</p></div>
  <section class="card form-stack">
    <h2>1. Export it from UMS</h2>
    <p class="muted">Open your Time Table in UMS, use the export menu and choose <strong>Excel</strong> (best tested) or <strong>CSV</strong>. PDF and Word files can't be read.</p>
    <h2>2. Choose the file</h2>
    <label class="button button-primary file-pick">Choose file<input id="tt-file" type="file" accept=".xlsx,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>
    <details class="acc"><summary><h2>Or paste the table text</h2>${icon("chevron", 16)}</summary><div class="form-stack"><textarea id="tt-paste" rows="5" placeholder="Paste the timetable here (copied with the weekday headings)"></textarea><button type="button" class="button button-secondary" id="tt-paste-run">Read pasted text</button></div></details>
    <p class="muted tt-privacy">The file is read on this phone and never uploaded. It contains your student ID, which UniCue ignores.</p>
  </section>
  <div id="tt-result" aria-live="polite"></div>`;
}

export function bindTimetableImport(root, { navigate }) {
  const result = root.querySelector("#tt-result");
  let plan = [];
  const fail = message => { result.innerHTML = `<section class="card form-errors" role="alert">${escapeHtml(message)}</section>`; };

  async function rowsFromFile(file) {
    if (file.size > MAX_BYTES) throw new Error("That file is too big to be a timetable.");
    const buf = await file.arrayBuffer();
    const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
    if (head[0] === 0x25 && head[1] === 0x50) throw new Error("PDF files can't be read. Export the timetable as Excel or CSV instead.");
    if (head[0] === 0x50 && head[1] === 0x4b) {
      if (typeof DecompressionStream === "undefined") throw new Error("This browser can't open Excel files. Export as CSV instead.");
      try { return await readXlsxRows(buf); } catch { throw new Error("That doesn't look like an Excel timetable export (Word files can't be read). Choose Excel or CSV from the UMS export menu."); }
    }
    return parseDelimited(new TextDecoder().decode(buf));
  }

  function showPreview(rows) {
    const parsed = parseTimetableGrid(rows);
    if (parsed.error) return fail(parsed.error);
    plan = buildPlan(parsed.entries, attendanceRepository.getAll());
    const created = plan.filter(p => !p.match).length;
    result.innerHTML = `<section class="card form-stack"><h2>Found ${plan.length} course${plan.length === 1 ? "" : "s"}</h2>
      ${plan.map((p, i) => `<label class="tt-plan"><input type="checkbox" data-plan="${i}" checked><span class="tt-plan-main"><strong>${escapeHtml(p.code)}</strong> <span class="badge">${p.match ? `Updates ${escapeHtml(p.match.name)}` : "New course"}</span><span class="muted">${escapeHtml(p.summary)}</span></span></label>`).join("")}
      <p class="muted">Each timetable slot counts as one class. Existing courses keep their attendance numbers.${created ? " New courses start at 0 classes, add your numbers from UMS afterwards." : ""}${parsed.ignoredSunday ? ` ${parsed.ignoredSunday} Sunday class${parsed.ignoredSunday === 1 ? " was" : "es were"} skipped.` : ""}</p>
      <button type="button" class="button button-primary" id="tt-apply">Import selected</button></section>`;
  }

  root.querySelector("#tt-file")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    result.innerHTML = '<p class="muted">Reading…</p>';
    try { showPreview(await rowsFromFile(file)); } catch (error) { fail(error.message || "Couldn't read that file."); }
  });
  root.querySelector("#tt-paste-run")?.addEventListener("click", () => {
    const text = root.querySelector("#tt-paste").value;
    if (!text.trim()) return fail("Paste the timetable text first.");
    showPreview(parseDelimited(text));
  });
  result.addEventListener("click", event => {
    if (!event.target.closest("#tt-apply")) return;
    const chosen = [...result.querySelectorAll("[data-plan]")].filter(b => b.checked).map(b => plan[Number(b.dataset.plan)]);
    if (!chosen.length) return fail("Select at least one course.");
    let semesterEnd = getSemester().lastDate; if (!semesterEnd) { try { semesterEnd = localStorage.getItem("unicue_semester_end") || ""; } catch { /* ignore */ } }
    const defaults = importDefaults(attendanceRepository.getAll(), semesterEnd);
    const { created, updated } = applyPlan(chosen, attendanceRepository, defaults);
    showToast(`${created ? `${created} added` : ""}${created && updated ? ", " : ""}${updated ? `${updated} updated` : ""}. Now add your attended and conducted numbers.`);
    navigate("#/attendance");
  });
}
