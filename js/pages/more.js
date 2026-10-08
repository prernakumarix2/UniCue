import { installCardHtml } from "../components/shell-banners.js";
import { escapeHtml } from "../utils/escape.js";
import { icon } from "../components/icons.js";
import { initials } from "../auth/student-auth.js";

const httpsOnly = url => (/^https:\/\/\S+$/i.test(String(url || "").trim()) ? String(url).trim() : "");

export function renderMore({ install = "none", feedbackUrl = "", student = null } = {}){
  const account = student ? `<section class="card account-card"><span class="avatar" aria-hidden="true">${escapeHtml(initials(student))}</span><div class="account-who"><strong>${escapeHtml(student.name)}</strong><span>${escapeHtml(student.email)}</span></div><button type="button" class="button button-secondary" data-logout>${icon("logout", 18)}<span>Log out</span></button></section>` : "";
  const feedback = httpsOnly(feedbackUrl);
  const t = (typeof localStorage!=="undefined" && localStorage.getItem("unicue_theme")) || "system";
  const opt=(v,l)=>`<button type="button" class="seg-btn ${t===v?"active":""}" data-theme-choice="${v}" aria-pressed="${t===v}">${l}</button>`;
  return `<div class="page-header"><h1 class="page-title">Profile</h1><p class="page-subtitle">Appearance, data and app info.</p></div><div class="stack">${account}<section class="card"><h2>Appearance</h2><div class="seg seg-3" role="group" aria-label="Theme">${opt("system","System")}${opt("light","Light")}${opt("dark","Dark")}</div></section>${installCardHtml(install)}${feedback ? `<a class="card menu-card" href="${escapeHtml(feedback)}" target="_blank" rel="noopener noreferrer"><h2>Send feedback</h2><p class="muted">Found a bug or want something added? Tell us.</p></a>` : ""}<a class="card menu-card" href="#/settings"><h2>Settings</h2><p class="muted">Local data and app controls.</p></a><a class="card menu-card" href="#/privacy"><h2>Your privacy</h2><p class="muted">What stays on your phone, and what doesn't.</p></a><a class="card menu-card" href="#/about"><h2>About UniCue</h2><p class="muted">What UniCue is and isn't.</p></a></div>`;
}
export function renderAbout(){return `<div class="page-header"><h1 class="page-title">About UniCue</h1></div><section class="card detail-card"><p>UniCue is a student-built information and academic utility platform for LPU students.</p><h2>Find → Understand → Track → Act</h2><p>UniCue complements official LPU systems. It does not replace UMS/LPU Touch.</p><h2>V1 boundaries</h2><ul><li>No UMS credential collection.</li><li>No scraping or access-control bypass.</li><li>No placement application processing.</li><li>No student-generated publishing.</li></ul><p><a class="text-link" href="#/privacy">How your data is handled</a></p><p class="muted about-version" id="about-version">UniCue v21 · built by an LPU student</p></section>`}
export function renderGuide(){return `<div class="page-header"><h1 class="page-title">University Guide</h1><p class="page-subtitle">Stable, curated guidance will live here.</p></div><section class="card"><p class="muted">Guide content will be maintained as static JSON when it is added.</p></section>`}
