import { attendanceRepository } from "../repositories/attendance-repository.js";
import { semesterLeave } from "../domain/planner.js";
import { longestSafeTrip, tripShareText, courseVerdict } from "../domain/trip.js";
import { getSemesterTarget, ring } from "./attendance.js";
import { escapeHtml } from "../utils/escape.js";

const pad = n => String(n).padStart(2, "0");
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = v => (v ? new Date(`${v}T00:00:00`) : null);
const fmt = d => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const plural = (n, w = "class", p = "classes") => `${n} ${n === 1 ? w : p}`;

export function renderLeavePlanner() {
  const courses = attendanceRepository.getAll();
  if (!courses.length) return `<div class="page-header"><a class="back-link" href="#/attendance">← Attendance</a><h1 class="page-title">Plan a trip</h1></div><section class="card empty-state"><p>Add a course first.</p><a class="button button-primary" href="#/attendance/course/new">Add Course</a></section>`;
  return `<div class="page-header"><a class="back-link" href="#/attendance">← Attendance</a><h1 class="page-title">Plan a trip</h1><p class="page-subtitle">Wedding, festival or home visit? See what it costs before you go.</p></div>
  <form class="card form-stack" id="leave-form" novalidate>
    <div class="chip-scroll" role="group" aria-label="Quick pick">
      <button type="button" class="filter-chip" data-preset="0">Today</button>
      <button type="button" class="filter-chip" data-preset="2">3 days</button>
      <button type="button" class="filter-chip" data-preset="6">7 days</button>
      <button type="button" class="filter-chip" data-preset="clear">Clear</button>
    </div>
    <div class="form-grid">
      <label>Away from<input type="date" name="from"></label>
      <label>Away until<input type="date" name="to"></label>
    </div>
    <label>Overall target (%)<input type="number" name="target" inputmode="numeric" min="0" max="100" step="1" value="${getSemesterTarget()}"></label>
    <p class="field-error" id="leave-error" role="alert"></p>
  </form>
  <div id="leave-results" class="stack section"></div>`;
}

function verdict(r) {
  const v = courseVerdict(r);
  if (!r.hasPlan) return { tone: "idle", title: v.title, sub: "Edit this course to plan its leave." };
  if (!r.feasible) return { tone: "bad", title: v.title, sub: `Best possible is ${r.best.toFixed(1)}% even with no leave.` };
  if (r.margin < 0) return { tone: "bad", title: `${plural(-r.margin)} over the limit`, sub: `You can miss ${r.canMiss} in total, this trip uses ${r.skip}.` };
  if (r.skip === 0) return { tone: r.canMiss === 0 ? "warn" : "ok", title: r.canMiss === 0 ? "Can't miss any class" : `Can miss ${plural(r.canMiss)}`, sub: "Pick dates to see the impact." };
  return { tone: v.tone, title: v.title, sub: `Trip uses ${r.skip} of the ${r.canMiss} you can miss.` };
}

function headline(s, picked) {
  if (!picked) return "";
  const planned = s.rows.filter(r => r.hasPlan);
  if (!planned.length) return "";
  if (s.atRisk.length || !s.after.safe) return { tone: "bad", title: "Not safe to go", sub: s.atRisk.length ? `${s.atRisk.map(r => r.course.name).join(", ")} would drop below target.` : "Your overall result would drop below target." };
  const tight = planned.some(r => r.margin === 0);
  return tight ? { tone: "warn", title: "Safe, but no room left", sub: "At least one course would have zero spare classes." } : { tone: "ok", title: "Safe to go", sub: "Every course stays above its target." };
}

export function bindLeavePlanner(root) {
  const form = root.querySelector("#leave-form");
  const out = root.querySelector("#leave-results");
  const err = root.querySelector("#leave-error");
  if (!form || !out) return;

  let lastShare = "";
  const shareResult = async () => {
    if (!lastShare) return;
    try { if (navigator.share) { await navigator.share({ text: lastShare }); return; } } catch { return; /* user cancelled */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastShare)}`, "_blank", "noopener");
  };
  const update = () => {
    const d = new FormData(form);
    const target = Math.min(100, Math.max(0, Number(d.get("target")) || 75));
    try { localStorage.setItem("unicue_semester_target", String(target)); } catch { /* ignore */ }
    let from = parse(d.get("from")), to = parse(d.get("to"));
    if (from && !to) to = from;
    if (!from && to) from = to;
    err.textContent = from && to && to < from ? "“Away until” is before “Away from”." : "";
    if (err.textContent) { from = to = null; }
    const s = semesterLeave(attendanceRepository.getAll(), target, from, to);
    const picked = Boolean(from && to);

    const summary = `<section class="card leave-summary">
      <div class="leave-head"><h2 class="section-title">${picked ? `${fmt(from)}${+from === +to ? "" : " – " + fmt(to)}` : "No dates picked"}</h2><span class="muted">${picked ? `${plural(s.skip)} missed` : "Choose dates above"}</span></div>
      <div class="leave-stats">
        <div><strong>${s.all.current === null ? "—" : s.all.current.toFixed(1) + "%"}</strong><span>Now</span></div>
        <div><strong>${s.all.best === null ? "—" : s.all.best.toFixed(1) + "%"}</strong><span>No leave</span></div>
        <div class="${picked ? (s.after.safe ? "ok" : "bad") : ""}"><strong>${s.after.percent === null ? "—" : s.after.percent.toFixed(1) + "%"}</strong><span>${picked ? "After leave" : "End result"}</span></div>
      </div>
      <p class="leave-note ${!picked ? "" : s.atRisk.length ? "unsafe" : "safe"}">${!picked ? "Projected to the last day of the semester, attending every other class." : s.atRisk.length ? `${plural(s.atRisk.length, "course", "courses")} would fall below target: ${s.atRisk.map(r => escapeHtml(r.course.name)).join(", ")}.` : "Every course stays above its target."}</p>
    </section>`;

    const head = headline(s, picked);
    const headHtml = head ? `<section class="plan-pill pill-${head.tone} trip-verdict"><strong>${escapeHtml(head.title)}</strong><span>${escapeHtml(head.sub)}</span><button type="button" class="chip-button" id="trip-share">Share result</button></section>` : "";
    const safe = from && picked ? longestSafeTrip(attendanceRepository.getAll(), target, from) : null;
    const safeHtml = !safe || safe.unknown ? "" : safe.limitless ? `<section class="card trip-safe"><h2 class="section-title">How long can you stay?</h2><p>Leaving on ${fmt(from)}, no course drops below target before the semester ends.</p></section>`
      : `<section class="card trip-safe"><h2 class="section-title">How long can you stay?</h2><p>${safe.lastSafe ? `Leaving on <strong>${fmt(from)}</strong>, you can stay away until <strong>${fmt(safe.lastSafe)}</strong> (${plural(safe.days, "day", "days")}) with every course on target.` : `Even leaving on <strong>${fmt(from)}</strong> for one day would drop a course below target.`}</p>${safe.blockedBy.length ? `<p class="muted">First to break: ${safe.blockedBy.map(escapeHtml).join(", ")}</p>` : ""}</section>`;
    lastShare = picked ? tripShareText({ from, to, skip: s.skip, atRiskNames: s.atRisk.map(r => r.course.name), safeTarget: target }) : "";
    const rows = [...s.rows].sort((a, b) => (a.hasPlan && a.margin < 0 ? 0 : 1) - (b.hasPlan && b.margin < 0 ? 0 : 1));
    const card = r => { const v = verdict(r); return `<article class="card course-card"><div class="course-main">${ring(r.after.percent, r.target)}<div class="course-info"><h2 class="section-title">${escapeHtml(r.course.name)}</h2><p class="course-code">${r.hasPlan ? `Misses ${r.skip} of ${r.remaining} classes left` : "No schedule set"} · target ${r.target}%</p>${r.hasPlan && picked && r.feasible && r.margin >= 0 ? `<p class="course-code">After you're back: attend ${r.mustAttend} of the ${r.remaining - r.skip} left</p>` : ""}</div></div><div class="plan-pill pill-${v.tone}"><strong>${escapeHtml(v.title)}</strong><span>${escapeHtml(v.sub)}</span></div></article>`; };
    out.innerHTML = headHtml + summary + safeHtml + rows.map(card).join("");
    out.querySelector("#trip-share")?.addEventListener("click", shareResult);
  };

  form.querySelectorAll("[data-preset]").forEach(b => b.addEventListener("click", () => {
    const p = b.dataset.preset;
    if (p === "clear") { form.elements.from.value = ""; form.elements.to.value = ""; }
    else { const a = new Date(), z = new Date(); z.setDate(z.getDate() + Number(p)); form.elements.from.value = toISO(a); form.elements.to.value = toISO(z); }
    update();
  }));
  form.addEventListener("input", update);
  update();
}
