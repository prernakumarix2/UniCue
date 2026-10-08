import { placementRepository } from "../repositories/placement-repository.js";
import { filterPlacements, getPlacementStatus } from "../domain/placements.js";
import { escapeHtml } from "../utils/escape.js";
import { formatDateTime } from "../utils/dates.js";
import { shortPackage, summarizeList } from "../utils/formatting.js";
import { relativeDue, toDate } from "../utils/dates.js";
import { errorState } from "../components/error-state.js";
import { icon } from "../components/icons.js";
import { closingWithin, closesIn } from "../domain/placement-insights.js";
import { savedDriveIds } from "../utils/placement-prefs.js";

export async function renderPlacement() {
  try {
    const items = await placementRepository.getPublished();
    return renderPlacementList(items);
  } catch (error) {
    return errorState("Placement unavailable", error.message || "Could not load placement opportunities.");
  }
}

const STATUS_CHIPS = ["All", "Open", "Closing Soon", "Saved", "Closed"];

// "Saved" is a personal filter (on-device), the others are drive statuses.
function listFor(items, query, status) {
  if (status !== "Saved") return filterPlacements(items, { query, status });
  const saved = new Set(savedDriveIds());
  return filterPlacements(items.filter(i => saved.has(i.id)), { query, status: "All" });
}

function closingStrip(items) {
  const soon = closingWithin(items, 48);
  if (!soon.length) return "";
  return `<section class="closing-strip" aria-label="Closing soon"><h2 class="group-title group-critical">Closing in 48 hours</h2><div class="closing-row">${soon.map(i => `<a class="closing-card" href="#/placement/${encodeURIComponent(i.id)}"><span class="avatar" aria-hidden="true">${escapeHtml(initials(i.company))}</span><span class="closing-text"><strong>${escapeHtml(i.company || "Company")}</strong><span>${escapeHtml(closesIn(i.applicationDeadline)?.text || "")}</span></span></a>`).join("")}</div></section>`;
}

export function renderPlacementList(items = [], query = "", status = "All") {
  const filtered = listFor(items, query, status);
  return `<div class="page-header">
    <h1 class="page-title">Placement</h1>
    <p class="page-subtitle">Discover current opportunities. Applications continue through the official LPU process.</p>
  </div>
  <div class="filter-block">
    <input id="placement-search" type="search" placeholder="Search company, role or skill" aria-label="Search placements" value="${escapeHtml(query)}">
    <select id="placement-status" class="sr-only" aria-label="Status" tabindex="-1"><option ${status === "All" ? "selected" : ""}>All</option><option ${status === "Open" ? "selected" : ""}>Open</option><option ${status === "Closing Soon" ? "selected" : ""}>Closing Soon</option><option ${status === "Closed" ? "selected" : ""}>Closed</option><option ${status === "Saved" ? "selected" : ""}>Saved</option></select>
    ${chips(STATUS_CHIPS, status, "data-chip-status")}
  </div>
  ${status === "All" && !query ? closingStrip(items) : ""}
  <div id="placement-results" class="stack">${filtered.length ? filtered.map(renderPlacementCard).join("") : `<section class="empty-state card"><h2>${status === "Saved" ? "No saved drives yet" : "No opportunities found"}</h2><p class="muted">${status === "Saved" ? "Open a drive and tap the bookmark to keep it here." : "Try another search or status filter."}</p></section>`}</div>`;
}

function initials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export function chips(values, active, attr) {
  return `<div class="chip-scroll" role="group" aria-label="Filter">${values.map(v => `<button type="button" class="filter-chip${v === active ? " active" : ""}" ${attr}="${escapeHtml(v)}" aria-pressed="${v === active}">${escapeHtml(v)}</button>`).join("")}</div>`;
}

function renderPlacementCard(item) {
  const status = getPlacementStatus(item);
  const due = relativeDue(toDate(item.applicationDeadline));
  const pkg = shortPackage(item.salary);
  const loc = summarizeList(item.workLocations);
  const statusTone = status === "Closed" ? "closed" : status === "Closing Soon" ? "soon" : "open";
  const when = item.applicationDeadline ? formatDateTime(item.applicationDeadline) : "";
  const apply = status === "Closed" ? (when ? `Closed ${escapeHtml(when)}` : "") : (due ? `Register ${escapeHtml(due.label.replace("Due ", "").replace(/^In /, "in "))}` : (when ? `Apply by ${escapeHtml(when)}` : ""));
  return `<a class="card placement-card${status === "Closed" ? " is-closed" : ""}" href="#/placement/${encodeURIComponent(item.id)}">
    <div class="p-row"><span class="avatar" aria-hidden="true">${escapeHtml(initials(item.company))}</span><div class="p-main"><h2>${escapeHtml(item.company || "Company")}</h2><p class="p-role">${escapeHtml(item.role || item.driveType || "Placement opportunity")}</p></div><span class="p-status p-status-${statusTone}">${escapeHtml(status)}</span></div>
    ${pkg || item.driveType ? `<div class="p-meta">${pkg ? `<span class="p-pkg">${escapeHtml(pkg)}</span>` : ""}${item.driveType ? `<span class="chip">${escapeHtml(item.driveType)}</span>` : ""}</div>` : ""}
    ${loc.first || apply ? `<div class="p-foot">${loc.first ? `<span class="p-loc">${icon("pin", 15)}<span>${escapeHtml(loc.first)}${loc.more ? ` <em>+${loc.more} more</em>` : ""}</span></span>` : "<span></span>"}${apply ? `<span class="${due && status !== "Closed" ? `chip chip-${due.tone}` : "p-apply"}">${apply}</span>` : ""}</div>` : ""}
  </a>`;
}

export function bindPlacement(root, items) {
  const search = root.querySelector("#placement-search");
  const status = root.querySelector("#placement-status");
  const rerender = () => {
    const list = root.querySelector("#placement-results");
    if (!list) return;
    const filtered = listFor(items, search?.value || "", status?.value || "All");
    list.innerHTML = filtered.length ? filtered.map(renderPlacementCard).join("") : `<section class="empty-state card"><h2>No opportunities found</h2><p class="muted">Try another search or status filter.</p></section>`;
  };
  search?.addEventListener("input", rerender);
  status?.addEventListener("change", () => { syncChips(root, "data-chip-status", status.value); rerender(); });
  root.querySelectorAll("[data-chip-status]").forEach(btn => btn.addEventListener("click", () => {
    if (!status) return;
    status.value = btn.dataset.chipStatus;
    status.dispatchEvent(new Event("change"));
  }));
}

export function syncChips(root, attr, value) {
  root.querySelectorAll(`[${attr}]`).forEach(b => {
    const on = b.getAttribute(attr) === value;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}
