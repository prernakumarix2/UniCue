import { icon } from "../components/icons.js";

// Plain-language data facts. Keep this honest: update it whenever what UniCue stores or sends changes.
export function renderPrivacy() {
  return `<div class="page-header"><a class="back-link" href="#/about">${icon("chevron", 16)} About</a><h1 class="page-title">Your privacy</h1><p class="page-subtitle">What UniCue keeps, and where.</p></div>
  <div class="stack">
    <section class="card detail-card"><h2>Never asked for</h2><ul><li>Your UMS username or password.</li><li>Your phone number.</li><li>A verified email. The email and password you use to log in to UniCue are a demo account that is saved on this phone only.</li></ul></section>
    <section class="card detail-card"><h2>Stays on this phone only</h2><ul><li>Your courses, attendance numbers, class days and times.</li><li>Your deadlines and exam dates.</li><li>Your CGPA and backlogs for the "Am I eligible?" check, and your saved drives.</li><li>Which messages you've read.</li><li>Your UniCue demo account (name, email and a scrambled copy of the password). Log out from Profile to leave this phone signed out.</li></ul><p class="muted">This data is never sent to UniCue's servers. Because of that, clearing your browser data erases it, so use Settings to back it up.</p></section>
    <section class="card detail-card"><h2>Files you choose</h2><p>A timetable file you pick is read on this phone and not uploaded. It contains your student ID, which UniCue ignores and does not store.</p></section>
    <section class="card detail-card"><h2>What comes from the internet</h2><p>Messages, placement drives, the holiday list and the last class day are published by the UniCue admin and are readable by anyone with the link. They contain no student data.</p></section>
    <section class="card detail-card"><h2>When you share</h2><ul><li>A deadline link contains only that deadline.</li><li>A course setup link contains course names, class days and times, never your attendance numbers.</li></ul><p class="muted">Anyone who gets a link can read what's in it, so share it only where you mean to.</p></section>
    <section class="card detail-card"><h2>Technical logs</h2><p>Like any website, the services that host UniCue (GitHub Pages, Google Firebase and Google Fonts, which supplies the headline typeface) can see technical details such as your IP address when your phone loads the app, the published content or the font.</p></section>
    <section class="card detail-card"><h2>Not an official LPU app</h2><p>UniCue is an independent student project. It helps you track and plan, but UMS and official notices are always the final word.</p></section>
  </div>`;
}
