import { firebaseConfig, getFirebaseConfigStatus } from "../firebase/config.js";
import { adminLogin, adminLogout, getCurrentAdmin } from "../admin/auth.js";
import { informationRepository } from "../repositories/information-repository.js";
import { placementRepository } from "../repositories/placement-repository.js";
import { informationStatusPatch } from "../domain/information.js";
import { placementStatusPatch } from "../domain/placements.js";
import { getHolidays } from "../domain/holidays.js";
import { escapeHtml } from "../utils/escape.js";
import { formatDateTime } from "../utils/dates.js";
import { errorState } from "../components/error-state.js";
import { icon } from "../components/icons.js";

export function renderAdmin() {
  const status = getFirebaseConfigStatus();
  const disabled = status.ready ? "" : "disabled";
  const statusText = status.ready ? "Sign in with your admin account." : (status.enabled ? `Firebase setup incomplete: ${status.missing.join(", ")}` : "Firebase is not configured yet.");
  return `<div class="page-header"><h1 class="page-title">Admin Login</h1><p class="page-subtitle">Restricted UniCue content management.</p></div>
    <form id="admin-login" class="card form-stack"><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><div id="admin-error" class="form-errors" role="alert"></div><button class="button button-primary" type="submit" ${disabled}>Sign in</button><p class="muted">${statusText}</p></form>`;
}

export function bindAdmin(root, navigate) {
  root.querySelector("#admin-login")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = root.querySelector("#admin-error");
    errorBox.textContent = "";
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      await adminLogin(data.email, data.password);
      navigate("#/admin/dashboard");
    } catch (error) {
      errorBox.textContent = error.message || "Unable to sign in.";
    }
  });
}

export async function renderAdminDashboard() {
  const admin = await getCurrentAdmin();
  if (!admin) return `<div class="page-header"><h1 class="page-title">Admin access required</h1><p class="muted">Sign in with the configured administrator account.</p><a class="button button-primary" href="#/admin">Admin Login</a></div>`;
  let info = [], places = [];
  try { [info, places] = await Promise.all([informationRepository.getAll(), placementRepository.getAll()]); } catch { /* counts are optional */ }
  const n = (list, status) => list.filter(i => (i.status || "draft") === status).length;
  const tile = (tone, value, label) => `<div class="admin-stat tone-${tone}"><strong>${value}</strong><span>${label}</span></div>`;
  const row = (href, ico, title, text, count) => `<a class="admin-row" href="${href}"><span class="admin-row-icon">${icon(ico, 22)}</span><span class="admin-row-text"><strong>${title}</strong><span>${text}</span></span><span class="admin-row-count">${count}</span>${icon("chevron", 18)}</a>`;
  return `<section class="admin-hero"><span class="admin-avatar">${icon("shield", 22)}</span><div><h1>Admin Dashboard</h1><p>${escapeHtml(admin.email || "Content management")}</p></div><span class="live-pill">Signed in</span></section>
    <div class="admin-stats">${tile("ok", n(info, "published"), "Messages live")}${tile("muted", n(info, "draft"), "Message drafts")}${tile("ok", n(places, "published"), "Placements live")}${tile("warn", n(places, "closed"), "Placements closed")}</div>
    <div class="admin-quick"><a class="button button-primary" href="#/admin/information/new">${icon("plus", 18)} New message</a><a class="button button-primary button-tonal" href="#/admin/placements/new">${icon("plus", 18)} New placement</a></div>
    <h2 class="group-title">Manage</h2>
    <div class="admin-list">${row("#/admin/information", "megaphone", "Manage Messages", "Create, edit, publish, expire notices.", info.length)}${row("#/admin/placements", "placement", "Manage Placements", "Drives, deadlines and eligibility.", places.length)}${row("#/admin/semester", "cap", "Semester & holidays", "Last class day and the holiday list for every student.", getHolidays().length)}</div>
    <button id="admin-logout" class="admin-signout">${icon("logout", 18)} Sign out</button>`;
}

export function bindAdminDashboard(root, navigate) {
  root.querySelector("#admin-logout")?.addEventListener("click", async () => { await adminLogout(); navigate("#/admin"); });
}

const MANAGER = {
  Information: {
    path: "information", noun: "Information", repo: informationRepository,
    title: item => item.title || "Untitled",
    meta: item => item.category || "Other",
    publicHref: item => `#/information/${encodeURIComponent(item.id)}`,
    actions: status => ({
      draft: [["published", "Publish"]],
      published: [["draft", "Unpublish"], ["expired", "Expire"]],
      expired: [["published", "Republish"], ["draft", "Draft"]]
    })[status] || [["draft", "Draft"]],
    patch: (item, status) => informationStatusPatch(item, status)
  },
  Placements: {
    path: "placements", noun: "Placement", repo: placementRepository,
    title: item => `${item.company || "Company"} — ${item.role || "Role"}`,
    meta: item => item.applicationDeadline ? `Apply before ${formatDateTime(item.applicationDeadline)}` : "No deadline",
    publicHref: item => `#/placement/${encodeURIComponent(item.id)}`,
    actions: status => ({
      draft: [["published", "Publish"]],
      published: [["draft", "Unpublish"], ["closed", "Close"]],
      closed: [["published", "Reopen"], ["draft", "Draft"]]
    })[status] || [["draft", "Draft"]],
    patch: (item, status) => placementStatusPatch(status)
  }
};

export async function renderAdminManager(kind) {
  const admin = await getCurrentAdmin();
  if (!admin) return `<div class="page-header"><h1 class="page-title">Admin access required</h1><a class="button button-primary" href="#/admin">Admin Login</a></div>`;
  const cfg = MANAGER[kind];
  let items;
  try { items = await cfg.repo.getAll(); }
  catch (error) { return errorState(`Unable to load ${kind.toLowerCase()}`, error.message); }
  const sorted = [...items].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  const counts = sorted.reduce((acc, item) => { acc[item.status || "draft"] = (acc[item.status || "draft"] || 0) + 1; return acc; }, {});
  const summary = Object.entries(counts).map(([status, n]) => `${n} ${status}`).join(" · ");
  const card = item => {
    const status = item.status || "draft";
    const visible = status === "published" || (kind === "Placements" && status === "closed");
    return `<article class="card admin-item" data-status="${escapeHtml(status)}"><div class="admin-item-top"><span class="badge badge-status-${escapeHtml(status)}">${escapeHtml(status)}</span><span class="muted">Updated ${escapeHtml(formatDateTime(item.updatedAt))}</span></div>
      <h2>${escapeHtml(cfg.title(item))}</h2><p class="muted">${escapeHtml(cfg.meta(item))}</p>
      <div class="admin-item-actions">
        <a class="button button-tonal" href="#/admin/${cfg.path}/${encodeURIComponent(item.id)}/edit">${icon("edit", 16)} Edit</a>
        ${cfg.actions(status).map(([next, label], i) => `<button class="button ${i === 0 ? "button-secondary" : "button-ghost"}" data-admin-status="${next}" data-id="${escapeHtml(item.id)}">${label}</button>`).join("")}
        <span class="spacer"></span>
        <a class="icon-btn" href="#/admin/${cfg.path}/${encodeURIComponent(item.id)}/duplicate" aria-label="Duplicate as a new draft" title="Duplicate as a new draft">${icon("doc", 18)}</a>
        ${visible ? `<a class="icon-btn" href="${cfg.publicHref(item)}" aria-label="Student view" title="Student view">${icon("eye", 18)}</a>` : ""}
        <button class="icon-btn danger" data-admin-delete="${escapeHtml(item.id)}" aria-label="Delete" title="Delete">${icon("trash", 18)}</button>
      </div></article>`;
  };
  return `<div class="page-header"><a class="back-link" href="#/admin/dashboard">${icon("chevron", 16)} Dashboard</a><h1 class="page-title">Manage ${kind === "Information" ? "Messages" : kind}</h1>${summary ? `<p class="page-subtitle">${escapeHtml(summary)}</p>` : ""}</div>
    <div class="admin-toolbar"><a class="button button-primary" href="#/admin/${cfg.path}/new">${icon("plus", 18)} Create ${cfg.noun === "Information" ? "Message" : cfg.noun}</a></div>
    <div class="chip-scroll admin-filters" role="group" aria-label="Filter by status">${["all", ...Object.keys(counts)].map((s, i) => `<button type="button" class="filter-chip${i === 0 ? " active" : ""}" data-admin-filter="${escapeHtml(s)}">${s === "all" ? `All ${sorted.length}` : `${escapeHtml(s)} ${counts[s]}`}</button>`).join("")}</div>
    <div id="admin-manager-error" class="form-errors" role="alert"></div>
    <div class="stack">${sorted.length ? sorted.map(card).join("") : `<section class="card empty-state"><h2>No ${kind.toLowerCase()} yet</h2><p class="muted">Create the first item to begin publishing content.</p></section>`}</div>`;
}

export function bindAdminManager(root, kind, navigate) {
  const cfg = MANAGER[kind];
  const errorBox = root.querySelector("#admin-manager-error");
  const run = async (button, task) => {
    errorBox.textContent = "";
    root.querySelectorAll("button").forEach(b => { b.disabled = true; });
    try { await task(); navigate(window.location.hash); }
    catch (error) {
      errorBox.textContent = error.message || "Action failed.";
      root.querySelectorAll("button").forEach(b => { b.disabled = false; });
    }
  };

  root.querySelectorAll("[data-admin-filter]").forEach(chip => chip.addEventListener("click", () => {
    root.querySelectorAll("[data-admin-filter]").forEach(c => c.classList.toggle("active", c === chip));
    root.querySelectorAll(".admin-item").forEach(card => { card.hidden = chip.dataset.adminFilter !== "all" && card.dataset.status !== chip.dataset.adminFilter; });
  }));

  root.querySelectorAll("[data-admin-status]").forEach(button => button.addEventListener("click", () => run(button, async () => {
    const admin = await getCurrentAdmin();
    if (!admin) throw new Error("Your admin session has expired. Sign in again.");
    const existing = await cfg.repo.getById(button.dataset.id);
    if (!existing) throw new Error("This item no longer exists.");
    await cfg.repo.update(button.dataset.id, { ...cfg.patch(existing, button.dataset.adminStatus), updatedBy: admin.uid });
  })));

  root.querySelectorAll("[data-admin-delete]").forEach(button => button.addEventListener("click", () => {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    run(button, () => cfg.repo.remove(button.dataset.adminDelete));
  }));
}
