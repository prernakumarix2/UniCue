import { placementRepository } from "../repositories/placement-repository.js";
import { getPlacementStatus } from "../domain/placements.js";
import { escapeHtml, safeUrl } from "../utils/escape.js";
import { formatPackage, shortPackage, summarizeList } from "../utils/formatting.js";
import { icon } from "../components/icons.js";
import { initials } from "../utils/formatting.js";
import { formatDateTime } from "../utils/dates.js";
import { errorState } from "../components/error-state.js";
import { parseSteps, parseEligibilityRules, checkEligibility, closesIn } from "../domain/placement-insights.js";
import { getProfile, isSavedDrive } from "../utils/placement-prefs.js";

export async function renderPlacementDetail(id) {
  try {
    const item = await placementRepository.getById(id);
    if (!item || !["published", "closed"].includes(item.status)) {
      return errorState("Opportunity not found", "This placement may have been removed or is not currently published.");
    }
    return placementDetailHtml(item);
  } catch (error) {
    return errorState("Placement unavailable", error.message || "Could not load this opportunity.");
  }
}

function fact(ico, label, value, wide = false) {
  if (!value) return "";
  return `<div class="fact${wide ? " fact-wide" : ""}">${icon(ico, 16)}<span class="fact-text"><span class="fact-label">${escapeHtml(label)}</span><span class="fact-value">${escapeHtml(value)}</span></span></div>`;
}

function acc(title, value, open = false) {
  if (!value) return "";
  const body = escapeHtml(String(value).replace(/\n{3,}/g, "\n\n").trim()).replaceAll("\n", "<br>");
  return `<details class="acc"${open ? " open" : ""}><summary><h2>${escapeHtml(title)}</h2>${icon("chevron", 16)}</summary><p>${body}</p></details>`;
}

function tidyList(v) { return String(v ?? "").split(/\s*[,;]\s*/).filter(Boolean).join(", "); }

const bookmark = on => `<svg width="20" height="20" viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg>`;
export { bookmark };

function closeBanner(item, status) {
  if (status === "Closed" || !item.applicationDeadline) return "";
  const c = closesIn(item.applicationDeadline);
  return c ? `<p class="close-banner close-${c.tone}">${icon("clock", 16)}<span><strong>${escapeHtml(c.text)}</strong> · ${escapeHtml(formatDateTime(item.applicationDeadline))}</span></p>` : "";
}

function processTimeline(text) {
  const steps = parseSteps(text);
  if (!steps.length) return "";
  return `<details class="acc" open><summary><h2>Selection process</h2>${icon("chevron", 16)}</summary><ol class="steps">${steps.map((st, i) => `<li><span class="step-n">${i + 1}</span><span class="step-body"><strong>${escapeHtml(st.title)}</strong>${st.detail ? `<span class="muted">${escapeHtml(st.detail)}</span>` : ""}</span></li>`).join("")}</ol></details>`;
}

export function eligibilityResultHtml(result) {
  const label = { ok: "Looks like you meet the CGPA and backlog rules", warn: "You may not meet the rules", unknown: "Can't check yet" }[result.status];
  return `<p class="elig-status elig-${result.status}"><strong>${label}</strong></p>${result.reasons.length ? `<ul class="elig-reasons">${result.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ul>` : ""}`;
}

function eligibilityCard(item) {
  if (!item.eligibility) return "";
  const profile = getProfile();
  const result = checkEligibility(parseEligibilityRules(item.eligibility), profile);
  return `<section class="elig-card" data-elig-text="${escapeHtml(item.eligibility)}"><h2>Am I eligible?</h2>
    <div class="elig-fields"><label>My CGPA<input type="number" inputmode="decimal" step="0.01" min="0" max="10" name="cgpa" value="${escapeHtml(profile.cgpa)}" placeholder="7.5"></label><label>Backlogs<input type="number" inputmode="numeric" min="0" max="30" name="backlogs" value="${escapeHtml(profile.backlogs)}" placeholder="0"></label></div>
    <div class="elig-result" aria-live="polite">${eligibilityResultHtml(result)}</div>
    <p class="muted elig-note">Private: stays on this phone. Checks CGPA and backlogs only. Program, batch and other rules are in the text below. UMS is final.</p></section>`;
}

/** Pure render of one placement detail page. Also used by the admin "Preview as student". */
export function placementDetailHtml(item) {
    const applyUrl = safeUrl(item.applicationUrl || item.officialSource);
    const sourceUrl = safeUrl(item.officialSource);
    const status = getPlacementStatus(item);
    const tone = status === "Closed" ? "closed" : status === "Closing Soon" ? "soon" : "open";
    const pkg = shortPackage(item.salary);
    const loc = summarizeList(item.workLocations);
    const when = typeof item.applicationDeadline === "string" ? item.applicationDeadline : (item.applicationDeadline?.toDate?.().toISOString?.() || "");
    const skills = String(item.skills || "").split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
    const contact = [item.contactPerson, item.tpcInfo].filter(Boolean).join("\n");
    return `<div class="page-header"><a class="back-link" href="#/placement">${icon("chevron", 16)} Placement</a></div>
      <article class="card detail-card placement-detail">
        <div class="pd-head"><span class="avatar" aria-hidden="true">${escapeHtml(initials(item.company))}</span><div class="pd-title"><p class="pd-company">${escapeHtml(item.company || "Company")}</p><h1>${escapeHtml(item.role || "Role")}</h1></div><span class="p-status p-status-${tone}">${escapeHtml(status)}</span></div>
        ${closeBanner(item, status)}
        <div class="pd-tags">${item.driveType ? `<span class="chip">${escapeHtml(item.driveType)}</span>` : ""}${item.driveCode ? `<span class="chip">Drive ${escapeHtml(item.driveCode)}</span>` : ""}${pkg ? `<span class="p-pkg">${escapeHtml(pkg)}</span>` : ""}</div>
        ${item.company ? `<p class="detail-links"><a class="text-link" href="#/company/${encodeURIComponent(item.company)}">All updates about ${escapeHtml(item.company)}</a></p>` : ""}
        <section class="facts">
          ${fact("clock", "Apply before", item.applicationDeadline ? formatDateTime(item.applicationDeadline) : "", true)}
          ${fact("deadlines", "Drive date", item.driveDate ? formatDateTime(item.driveDate) : "")}
          ${fact("cap", "Batches", tidyList(item.eligibleBatches))}
          ${fact("doc", "Programs", tidyList(item.eligiblePrograms))}
          ${fact("rupee", "Bond", item.bond)}
          ${fact("deadlines", "Joining", item.joiningDate ? formatDateTime(item.joiningDate) : "")}
          ${item.workLocations ? `<details class="fact fact-wide loc-fact"><summary>${icon("pin", 16)}<span class="fact-text"><span class="fact-label">Location</span><span class="fact-value">${escapeHtml(loc.first)}${loc.more ? ` <em>+${loc.more} more</em>` : ""}</span></span>${loc.more ? icon("chevron", 16) : ""}</summary>${loc.more ? `<p>${escapeHtml(item.workLocations)}</p>` : ""}</details>` : ""}
          ${item.salary && String(item.salary).length > 24 ? `<div class="fact fact-wide">${icon("rupee", 16)}<span class="fact-text"><span class="fact-label">Package details</span><span class="fact-value">${escapeHtml(formatPackage(item.salary))}</span></span></div>` : ""}
        </section>
        ${eligibilityCard(item)}
        ${acc("Eligibility", item.eligibility, true)}
        ${acc("Job description", item.jobDescription, true)}
        ${skills.length ? `<details class="acc"><summary><h2>Required skills</h2>${icon("chevron", 16)}</summary><div class="skill-chips">${skills.map(x => `<span class="chip">${escapeHtml(x)}</span>`).join("")}</div></details>` : ""}
        ${processTimeline(item.selectionProcess)}
        ${acc("Documents required", item.documentsRequired)}
        ${acc("Special requirements", item.specialRequirements)}
        ${acc("Dress code", item.dressCode)}
        ${acc("TPC / contact information", contact)}
        ${item.companyWebsite && safeUrl(item.companyWebsite) ? `<p class="detail-links"><a class="text-link" href="${escapeHtml(safeUrl(item.companyWebsite))}" target="_blank" rel="noopener">Company website ${icon("external", 14)}</a>${sourceUrl ? ` <a class="text-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">Official source ${icon("external", 14)}</a>` : ""}</p>` : (sourceUrl ? `<p class="detail-links">Source: <a class="text-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">Official source ${icon("external", 14)}</a></p>` : "")}
        <p class="muted placement-disclaimer">UniCue is an information and discovery layer. It does not process applications, register students for drives, collect UMS credentials, or replace the official LPU placement process.</p>
      </article>
      <div class="sticky-cta"><button type="button" class="button button-secondary cta-icon" data-save-drive="${escapeHtml(item.id)}" aria-pressed="${isSavedDrive(item.id)}" aria-label="Save this drive" title="Save this drive">${bookmark(isSavedDrive(item.id))}</button>${item.applicationDeadline ? `<button type="button" class="button button-secondary cta-icon" data-add-deadline data-company="${escapeHtml(item.company || "Drive")}" data-when="${escapeHtml(when)}" aria-label="Add register-by to my deadlines" title="Add register-by to my deadlines">${icon("deadlines", 20)}</button>` : ""}${applyUrl ? `<a class="button button-primary" href="${escapeHtml(applyUrl)}" target="_blank" rel="noopener noreferrer">Apply through official LPU process ${icon("external", 16)}</a>` : ""}</div>`;
}
