import { icon } from "./icons.js";

export const TABS = [
  ["home", "Home", "#/"],
  ["messages", "Messages", "#/information"],
  ["attendance", "Attendance", "#/attendance"],
  ["deadlines", "Deadlines", "#/deadlines"],
  ["placement", "Placement", "#/placement"]
];

/** Which tab a route belongs to ("" = none, e.g. Profile). */
export function navSection(route) {
  const n = route.name;
  if (n === "home") return "home";
  if (n.startsWith("information") || n === "company") return "messages";
  if (n.startsWith("course") || n === "attendance" || n === "leave-planner" || n.startsWith("timetable") || n === "setup-shared") return "attendance";
  if (n.startsWith("deadline")) return "deadlines";
  if (n.startsWith("placement")) return "placement";
  return "";
}

/** Rendered once; the shell then only toggles the active state (no flicker, badge survives). */
export function renderBottomNav() {
  const items = TABS.map(([key, label, href]) =>
    `<a class="nav-item" data-nav="${key}" href="${href}">${icon(key, 24)}<span>${label}</span>${key === "messages" ? '<span class="nav-badge" id="nav-badge" hidden></span>' : ""}</a>`).join("");
  return `<nav class="bottom-nav" aria-label="Primary navigation">${items}</nav>`;
}

export function setActiveNav(navRoot, route) {
  const section = navSection(route);
  navRoot.querySelectorAll(".nav-item").forEach(el => {
    const on = el.dataset.nav === section;
    el.classList.toggle("active", on);
    if (on) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
  });
}
