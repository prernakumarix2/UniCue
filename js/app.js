import { router } from "./router.js";
import { createStore } from "./state/store.js";
import { renderHeader, headerVariant } from "./components/header.js";
import { renderBottomNav, setActiveNav } from "./components/bottom-nav.js";
import { skeleton } from "./components/skeleton.js";
import { peekCached } from "./repositories/content-sync.js";
import { localStorageRepository } from "./repositories/local-storage.js";
import { attendanceRepository } from "./repositories/attendance-repository.js";
import { renderAttendance, bindAttendance } from "./pages/attendance.js";
import { renderLeavePlanner, bindLeavePlanner } from "./pages/leave-planner.js";
import { renderSetupShared, bindSetupShared } from "./pages/setup-shared.js";
import { courseSetupUrl } from "./domain/course-share.js";
import { shareOrWhatsApp } from "./utils/share.js";
import { renderTimetable, renderTimetableImport, bindTimetableImport } from "./pages/timetable.js";
import { informationRepository } from "./repositories/information-repository.js";
import { filterInformation } from "./domain/information.js";
import { markRead, unreadCount } from "./utils/read-state.js";
import { deadlineRepository } from "./repositories/deadline-repository.js";
import { toDate } from "./utils/dates.js";
import { renderCourseForm, bindCourseForm } from "./pages/course-form.js";
import { renderCourseDetail, bindCourseDetail } from "./pages/course-detail.js";
import { renderDeadlines, bindDeadlines } from "./pages/deadlines.js";
import { renderDeadlineForm, bindDeadlineForm } from "./pages/deadline-form.js";
import { renderSharedDeadline, bindSharedDeadline } from "./pages/deadline-shared.js";
import { renderInformation, bindInformation } from "./pages/information.js";
import { parseEligibilityRules, checkEligibility } from "./domain/placement-insights.js";
import { getProfile, saveProfile, toggleSavedDrive } from "./utils/placement-prefs.js";
import { eligibilityResultHtml, bookmark } from "./pages/placement-detail.js";
import { showToast } from "./components/toast.js";
import { renderAdminSemester, bindAdminSemester } from "./pages/admin-semester.js";
import { applySemesterFromMeta, loadStoredSemester } from "./domain/semester.js";
import { onContentMeta } from "./firebase/firestore.js";
import { renderCompany } from "./pages/company.js";
import { pickBanner } from "./domain/inbox.js";
import { dismissedBanners, dismissBanner } from "./utils/banner-state.js";
import { installMode, bumpVisits, getVisits, getDismissedAt, dismissInstall, isStandalone } from "./utils/install.js";
import { emergencyBannerHtml, installBannerHtml, updateBannerHtml } from "./components/shell-banners.js";
import { snoozeBackup, touchFirstSeen } from "./utils/backup-state.js";
import { renderPrivacy } from "./pages/privacy.js";
import { FEEDBACK_URL } from "./app-config.js";
import { renderInformationDetail } from "./pages/information-detail.js";
import { renderPlacement, renderPlacementList, bindPlacement } from "./pages/placement.js";
import { placementRepository } from "./repositories/placement-repository.js";
import { renderPlacementDetail } from "./pages/placement-detail.js";
import { renderHome } from "./pages/home.js";
import { renderSettings, bindSettings } from "./pages/settings.js";
import { loadHolidays } from "./domain/holidays.js";
import { renderMore, renderAbout, renderGuide } from "./pages/more.js";
import { renderAdmin, bindAdmin, renderAdminDashboard, renderAdminManager, bindAdminDashboard, bindAdminManager } from "./pages/admin.js";
import { renderInformationEditor, bindInformationEditor, renderPlacementEditor, bindPlacementEditor } from "./pages/admin-information.js";
import { applyTheme, setTheme, watchSystemTheme } from "./theme.js";
import { errorState } from "./components/error-state.js";
import { mountAuth } from "./pages/auth.js";
import { getSession, isLoggedIn, logOut, rememberNext, takeNext } from "./auth/student-auth.js";

applyTheme();
watchSystemTheme();
localStorageRepository.initialize();
const store = createStore({ attendance: attendanceRepository.getAll(), deadlines: localStorageRepository.getDeadlines(), preferences: localStorageRepository.getPreferences() });
const app = document.querySelector("#app");
const APP_VERSION_TAPS = 5;
const AUTH_ROUTES = new Set(["login", "signup", "forgot"]);

function bindAddDeadline(root) {
  const btn = root.querySelector("[data-add-deadline]");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const d = toDate(btn.dataset.when);
    if (!d) return;
    const p = n => String(n).padStart(2, "0");
    deadlineRepository.create({ title: `Register: ${btn.dataset.company}`, courseName: "", type: "Other", dueDate: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, dueTime: `${p(d.getHours())}:${p(d.getMinutes())}`, notes: "Placement drive registration (added from Placement)." });
    btn.textContent = "Added to deadlines ✓";
    btn.disabled = true;
  });
}

function bindPlacementPrivate(root) {
  const card = root.querySelector(".elig-card");
  if (card) {
    const rules = parseEligibilityRules(card.dataset.eligText);
    const read = () => ({ cgpa: card.querySelector('[name="cgpa"]').value, backlogs: card.querySelector('[name="backlogs"]').value });
    card.addEventListener("input", () => {
      const profile = read(); saveProfile(profile);
      card.querySelector(".elig-result").innerHTML = eligibilityResultHtml(checkEligibility(rules, profile));
    });
  }
  root.querySelector("[data-save-drive]")?.addEventListener("click", event => {
    const btn = event.currentTarget;
    const on = toggleSavedDrive(btn.dataset.saveDrive);
    btn.setAttribute("aria-pressed", String(on));
    btn.innerHTML = bookmark(on);
  });
}

function bindMessageDeadlines(root) {
  root.querySelectorAll("[data-add-msg-deadline]").forEach(btn => btn.addEventListener("click", () => {
    deadlineRepository.create({ title: btn.dataset.title, courseName: "", type: "Other", dueDate: btn.dataset.date, dueTime: btn.dataset.time || "", notes: btn.dataset.notes || "" });
    btn.textContent = "Added ✓"; btn.disabled = true;
  }));
}

// ---- Persistent shell: header, nav and offline bar are created once; only #page-root changes. ----
let headerKey = null;
let seq = 0;
let firstRender = true;

function mountShell() {
  headerKey = null;
  app.innerHTML = `<div class="app-shell"><div id="app-header"></div><div id="emergency-banner"></div><div id="update-banner"></div><div id="install-banner"></div><div id="net-banner" class="net-banner" role="status" hidden>You're offline. Showing saved data.</div><main class="app-main" id="page-root" tabindex="-1"></main><div id="app-nav">${renderBottomNav()}</div></div>`;
}

function updateChrome(route) {
  const key = headerVariant(route);
  if (key !== headerKey) { document.querySelector("#app-header").innerHTML = renderHeader(route); headerKey = key; }
  const admin = key === "admin";
  const nav = document.querySelector("#app-nav");
  nav.hidden = admin;
  document.querySelector(".app-shell").classList.toggle("no-nav", admin);
  if (!admin) setActiveNav(nav, route);
}

// ---- Emergency banner + install banner (above the page, below the header) ----
let installPrompt = null;
let lastItems = [];
const modeNow = (force = false) => installMode({ standalone: isStandalone(), userAgent: navigator.userAgent, hasPrompt: Boolean(installPrompt), visits: force ? 99 : getVisits(), dismissedAt: force ? 0 : getDismissedAt() });

function paintEmergency() {
  const box = document.querySelector("#emergency-banner");
  if (!box) return;
  const hide = router.current().name.startsWith("admin");
  box.innerHTML = hide ? "" : emergencyBannerHtml(pickBanner(lastItems, dismissedBanners()));
}
function paintInstall() {
  const box = document.querySelector("#install-banner");
  if (!box) return;
  box.innerHTML = router.current().name === "home" ? installBannerHtml(modeNow()) : "";
}
async function runInstall(mode) {
  if (mode === "prompt" && installPrompt) {
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch { /* ignore */ }
    installPrompt = null;
  } else dismissInstall();
  paintInstall();
  if (router.current().name === "profile" || router.current().name === "more") render({ keepScroll: true });
}
document.addEventListener("click", event => {
  const dismiss = event.target.closest("[data-dismiss-banner]");
  if (dismiss) { dismissBanner(dismiss.dataset.dismissBanner); paintEmergency(); return; }
  if (event.target.closest("[data-logout]")) { logOut(); router.go("/login"); return; }
  if (event.target.closest("[data-reload-app]")) { location.reload(); return; }
  if (event.target.closest("[data-retry]")) { render({ keepScroll: true }); return; }
  if (event.target.closest("[data-snooze-backup]")) { snoozeBackup(7); event.target.closest(".backup-card")?.remove(); return; }
  if (event.target.closest("[data-hide-setup]")) { try { localStorage.setItem("unicue_setup_hidden", "1"); } catch { /* ignore */ } event.target.closest(".setup-card")?.remove(); return; }
  if (event.target.closest("[data-share-setup]")) {
    const courses = attendanceRepository.getAll();
    if (!courses.some(c => c.slots?.length || Object.keys(c.schedule || {}).length)) { showToast("Add your class days first, then you can share the setup."); return; }
    shareOrWhatsApp({ text: "My UniCue course setup (class days and times, no attendance numbers). Open it to add yours:", url: courseSetupUrl(courses, location.href) });
    return;
  }
  if (event.target.closest("[data-install-dismiss]")) { dismissInstall(); paintInstall(); return; }
  const act = event.target.closest("[data-install-action]");
  if (act) runInstall(act.dataset.installAction);
});
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; paintInstall(); });
window.addEventListener("appinstalled", () => { installPrompt = null; paintInstall(); });
bumpVisits();

function paintBadge(items) {
  lastItems = items || [];
  paintEmergency();
  const badge = document.querySelector("#nav-badge");
  if (!badge) return;
  const n = unreadCount(filterInformation(items || [], {}));
  badge.hidden = n === 0;
  badge.textContent = n > 9 ? "9+" : String(n);
}

async function updateUnread(route) {
  paintInstall();
  if (route.name.startsWith("admin")) { paintEmergency(); return; }
  try { paintBadge(await informationRepository.getPublished()); }
  catch { /* keep whatever the cached badge shows */ }
}

function updateNetBanner() {
  const banner = document.querySelector("#net-banner");
  if (banner) banner.hidden = navigator.onLine !== false;
}

// Route table: each entry fills `root` (a detached view) and wires its events.
async function paint(route, root, rerender) {
  switch (route.name) {
    case "home": root.innerHTML = await renderHome(); break;
    case "attendance": root.innerHTML = renderAttendance(); bindAttendance(root, rerender); break;
    case "setup-shared": root.innerHTML = renderSetupShared(route.params.payload); bindSetupShared(root, { navigate: router.go }); break;
    case "timetable": root.innerHTML = renderTimetable(); break;
    case "timetable-import": root.innerHTML = renderTimetableImport(); bindTimetableImport(root, { navigate: router.go }); break;
    case "leave-planner": root.innerHTML = renderLeavePlanner(); bindLeavePlanner(root); break;
    case "course-form": root.innerHTML = renderCourseForm(); bindCourseForm(root, {}); break;
    case "course-form-edit": root.innerHTML = renderCourseForm({ courseId: route.params.id }); bindCourseForm(root, { courseId: route.params.id }); break;
    case "course-detail": root.innerHTML = renderCourseDetail({ courseId: route.params.id }); bindCourseDetail(root, { courseId: route.params.id, rerender }); break;
    case "deadlines": root.innerHTML = renderDeadlines(); bindDeadlines(root, rerender); break;
    case "deadline-form": root.innerHTML = renderDeadlineForm(); bindDeadlineForm(root, { navigate: router.go }); break;
    case "deadline-form-edit": root.innerHTML = renderDeadlineForm({ id: route.params.id }); bindDeadlineForm(root, { id: route.params.id, navigate: router.go }); break;
    case "deadline-shared": root.innerHTML = renderSharedDeadline(route.params.payload); bindSharedDeadline(root, { navigate: router.go }); break;
    case "company": root.innerHTML = await renderCompany(route.params.name); break;
    case "information": { const result = await renderInformation(); root.innerHTML = result.html; bindInformation(root, result.items); break; }
    case "information-detail": markRead(route.params.id); root.innerHTML = await renderInformationDetail(route.params.id); bindMessageDeadlines(root); break;
    case "placement": { try { const items = await placementRepository.getPublished(); root.innerHTML = renderPlacementList(items); bindPlacement(root, items); } catch (error) { root.innerHTML = errorState("Placement unavailable", error.message || "Could not load placement opportunities."); } break; }
    case "placement-detail": root.innerHTML = await renderPlacementDetail(route.params.id); bindAddDeadline(root); bindPlacementPrivate(root); break;
    case "profile":
    case "more": root.innerHTML = renderMore({ install: modeNow(true), feedbackUrl: FEEDBACK_URL, student: getSession() }); root.querySelectorAll("[data-theme-choice]").forEach(b => b.addEventListener("click", () => { setTheme(b.dataset.themeChoice); rerender(); })); break;
    case "settings": root.innerHTML = renderSettings(); bindSettings(root, rerender); break;
    case "privacy": root.innerHTML = renderPrivacy(); break;
    case "about": root.innerHTML = renderAbout(); bindAboutSecret(root); break;
    case "university-guide": root.innerHTML = renderGuide(); break;
    case "admin": root.innerHTML = renderAdmin(); bindAdmin(root, router.go); break;
    case "admin-dashboard": root.innerHTML = await renderAdminDashboard(); bindAdminDashboard(root, router.go); break;
    case "admin-information": root.innerHTML = await renderAdminManager("Information"); bindAdminManager(root, "Information", router.go); break;
    case "admin-information-new": root.innerHTML = await renderInformationEditor(); bindInformationEditor(root, { navigate: router.go }); break;
    case "admin-information-edit": root.innerHTML = await renderInformationEditor({ id: route.params.id }); bindInformationEditor(root, { id: route.params.id, navigate: router.go }); break;
    case "admin-semester": root.innerHTML = await renderAdminSemester(); bindAdminSemester(root, { navigate: router.go }); break;
    case "admin-information-duplicate": root.innerHTML = await renderInformationEditor({ templateId: route.params.id }); bindInformationEditor(root, { navigate: router.go }); break;
    case "admin-placements-duplicate": root.innerHTML = await renderPlacementEditor({ templateId: route.params.id }); bindPlacementEditor(root, { navigate: router.go }); break;
    case "admin-placements": root.innerHTML = await renderAdminManager("Placements"); bindAdminManager(root, "Placements", router.go); break;
    case "admin-placements-new": root.innerHTML = await renderPlacementEditor(); bindPlacementEditor(root, { navigate: router.go }); break;
    case "admin-placements-edit": root.innerHTML = await renderPlacementEditor({ id: route.params.id }); bindPlacementEditor(root, { id: route.params.id, navigate: router.go }); break;
    default: root.innerHTML = `<div class="route-not-found"><h1>Page not found</h1><p class="muted">The requested route does not exist.</p><a class="button button-primary" href="#/">Go Home</a></div>`;
  }
}

// Admin entry is deliberately not in the student UI: tap the version line on About five times.
function bindAboutSecret(root) {
  const el = root.querySelector("#about-version");
  let taps = 0, timer;
  el?.addEventListener("click", () => {
    taps += 1; clearTimeout(timer); timer = setTimeout(() => { taps = 0; }, 2500);
    if (taps >= APP_VERSION_TAPS) { taps = 0; router.go("/admin"); }
  });
}

const SLOW = new Set(["home", "company", "information", "information-detail", "placement", "placement-detail", "admin-dashboard", "admin-information", "admin-placements", "admin-information-edit", "admin-placements-edit"]);

/** keepScroll=true is used by in-page updates (e.g. ticking a deadline); navigation resets scroll. */
async function render({ keepScroll = false } = {}) {
  const route = router.current();

  // Student sign-in gate (demo). Admin screens have their own Firebase login and are never gated.
  if (AUTH_ROUTES.has(route.name)) {
    if (isLoggedIn()) { router.go(takeNext() || "#/"); return; }
    if (keepScroll && app.querySelector("[data-auth]")) return;   // background refreshes must not wipe what is being typed
    seq += 1;
    mountAuth(app, route.name, { navigate: router.go });
    window.scrollTo(0, 0);
    return;
  }
  if (!isLoggedIn() && !route.name.startsWith("admin")) {
    rememberNext(window.location.hash);
    router.go("/login");
    return;
  }
  if (document.title.endsWith("· UniCue") && !document.title.startsWith("UniCue")) document.title = "UniCue — Know what matters.";
  const mine = ++seq;
  if (!document.querySelector(".app-shell")) mountShell();
  updateChrome(route);
  updateNetBanner();
  const pageRoot = document.querySelector("#page-root");

  // Old content stays on screen while loading; a skeleton appears only if it takes a moment.
  const timer = SLOW.has(route.name)
    ? setTimeout(() => { if (mine === seq) pageRoot.replaceChildren(Object.assign(document.createElement("div"), { className: "view", innerHTML: skeleton(route.name) })); }, firstRender ? 0 : 140)
    : null;

  const view = document.createElement("div");
  view.className = "view";
  try { await paint(route, view, () => render({ keepScroll: true })); }
  catch (error) { view.innerHTML = errorState("Unable to load this screen", error.message || "Please try again."); }
  clearTimeout(timer);
  if (mine !== seq) return;            // the user already navigated elsewhere

  if (!keepScroll) { view.classList.add("page-enter"); window.scrollTo(0, 0); }
  pageRoot.replaceChildren(view);
  if (!keepScroll && !firstRender) pageRoot.focus({ preventScroll: true });
  firstRender = false;
  updateUnread(route);
}

window.addEventListener("hashchange", () => render());
window.addEventListener("unicue:read", () => updateUnread(router.current()));
window.addEventListener("offline", updateNetBanner);
window.addEventListener("online", () => { updateNetBanner(); const n = router.current().name; if (["home", "information", "placement"].includes(n)) render({ keepScroll: true }); });
if ("serviceWorker" in navigator) {
  // A new version takes over by itself, but the open screen keeps running the old code until reloaded. Tell the student.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) { const box = document.querySelector("#update-banner"); if (box) box.innerHTML = updateBannerHtml(); }
  });
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").then(reg => {
    // Installed apps can stay open for days: look for a new version when the student comes back (at most every 30 min).
    let lastCheck = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck > 30 * 60 * 1000) { lastCheck = Date.now(); reg.update().catch(() => {}); }
    });
  }).catch(() => {}));
}
touchFirstSeen();
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});   // ask the browser not to evict attendance/deadlines
mountShell();
paintBadge(peekCached("information"));   // instant unread badge from the last sync
// Settings from the admin ride along with the version check (no extra reads). Re-render once if they changed.
onContentMeta(meta => { if (applySemesterFromMeta(meta)) render({ keepScroll: true }); });
loadHolidays().finally(() => { loadStoredSemester(); render(); });
