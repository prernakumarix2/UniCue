import { informationRepository } from "../repositories/information-repository.js";
import { placementRepository } from "../repositories/placement-repository.js";
import { messagesForCompany } from "../domain/inbox.js";
import { getPlacementStatus } from "../domain/placements.js";
import { escapeHtml } from "../utils/escape.js";
import { initials } from "../utils/formatting.js";
import { timeAgo } from "../utils/dates.js";
import { errorState } from "../components/error-state.js";
import { icon } from "../components/icons.js";

// One place for everything about a company: its drives and every update, newest first.
export async function renderCompany(name) {
  const [infoResult, placeResult] = await Promise.allSettled([informationRepository.getPublished(), placementRepository.getPublished()]);
  if (infoResult.status === "rejected" && placeResult.status === "rejected") return errorState("Company unavailable", "Could not load. Check your connection.");
  const key = String(name || "").trim().toLowerCase();
  const messages = infoResult.status === "fulfilled" ? messagesForCompany(infoResult.value, name) : [];
  const drives = placeResult.status === "fulfilled" ? placeResult.value.filter(p => String(p.company || "").trim().toLowerCase() === key) : [];
  const back = `<div class="page-header"><a class="back-link" href="#/information">${icon("chevron", 16)} Messages</a></div>`;
  const head = `<div class="pd-head company-head"><span class="avatar" aria-hidden="true">${escapeHtml(initials(name))}</span><div class="pd-title"><p class="pd-company">Company</p><h1>${escapeHtml(name)}</h1></div></div>`;
  if (!messages.length && !drives.length) return `${back}${head}<section class="card empty-state"><h2>Nothing here yet</h2><p class="muted">No published drives or updates for this company.</p></section>`;
  const driveHtml = drives.length ? `<h2 class="group-title">Drives</h2><div class="stack">${drives.map(d => { const st = getPlacementStatus(d); return `<a class="card" href="#/placement/${encodeURIComponent(d.id)}"><div class="card-row"><strong>${escapeHtml(d.role || "Opportunity")}</strong><span class="p-status p-status-${st === "Closed" ? "closed" : st === "Closing Soon" ? "soon" : "open"}">${escapeHtml(st)}</span></div></a>`; }).join("")}</div>` : "";
  const msgHtml = messages.length ? `<h2 class="group-title">Updates (${messages.length})</h2><ol class="timeline">${messages.map(m => `<li><a class="timeline-item" href="#/information/${encodeURIComponent(m.id)}"><span class="timeline-time">${escapeHtml(timeAgo(m.updatedAt || m.publishedAt))}</span><strong>${escapeHtml(m.title)}</strong>${m.summary ? `<span class="muted">${escapeHtml(m.summary)}</span>` : ""}</a></li>`).join("")}</ol>` : "";
  return `${back}${head}${driveHtml}${msgHtml}`;
}
