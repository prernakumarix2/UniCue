import { icon } from "./icons.js";

const PROFILE_ROUTES = ["profile", "more", "settings", "about", "university-guide"];

/** Header content only changes between these variants, so the shell can skip needless re-renders. */
export function headerVariant(route) {
  if (route.name.startsWith("admin")) return "admin";
  return PROFILE_ROUTES.includes(route.name) ? "student-profile" : "student";
}

export function renderHeader(route) {
  const variant = headerVariant(route);
  const admin = variant === "admin";
  const right = admin
    ? `<a class="text-link" href="#/">Student app</a>`
    : `<a class="profile-link ${variant === "student-profile" ? "active" : ""}" href="#/profile" aria-label="Profile and settings" ${variant === "student-profile" ? 'aria-current="page"' : ""}>${icon("profile", 22)}</a>`;
  return `<header class="topbar"><div class="topbar-inner"><a class="brand" href="#/" aria-label="UniCue home"><img class="brand-logo" src="./assets/icons/favicon.svg" alt="" width="32" height="32"><span>${admin ? "UniCue Admin" : "UniCue"}</span></a>${right}</div></header>`;
}
