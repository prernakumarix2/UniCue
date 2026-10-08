import { informationRepository } from "../repositories/information-repository.js";
import { isExpiredInformation } from "../domain/information.js";
import { escapeHtml, safeUrl } from "../utils/escape.js";
import { formatDateTime, formatDate } from "../utils/dates.js";
import { errorState } from "../components/error-state.js";
import { icon } from "../components/icons.js";
import { cleanMessageText, topicOf } from "../domain/inbox.js";

export async function renderInformationDetail(id) {
  try {
    const item = await informationRepository.getById(id);
    if (!item || !["published", "expired"].includes(item.status)) {
      return errorState("Information not found", "This notice may have been removed or unpublished.");
    }
    return informationDetailHtml(item);
  } catch (error) {
    return errorState("Information unavailable", error.message || "Could not load this notice.");
  }
}

/** Pure render of one message detail page. Also used by the admin "Preview as student". */
export function informationDetailHtml(item) {
    const expired = isExpiredInformation(item);
    const actionUrl = safeUrl(item.action?.url);
    const sourceUrl = safeUrl(item.sourceUrl);
    const attachments = Array.isArray(item.attachments) ? item.attachments : [];
    const contacts = Array.isArray(item.contacts) ? item.contacts : [];
    const dates = Array.isArray(item.importantDates) ? item.importantDates : [];
    const importance = escapeHtml(item.importance || "Normal");

    // Order: importance, title, metadata, important dates, action, content, attachments, source, contact.
    return `<div class="page-header"><a class="back-link" href="#/information">${icon("chevron", 16)} Messages</a></div><article class="card detail-card message-detail">
      <span class="badge badge-${importance}">${importance}</span>${item.verified ? ` <span class="official-tag">✓ Official${item.sourceName ? ` · ${escapeHtml(item.sourceName)}` : ""}</span>` : ""}
      <h1>${escapeHtml(item.title)}</h1>
      ${item.summary ? `<section class="todo-callout"><h2>What you need to do</h2><p>${escapeHtml(item.summary)}</p></section>` : ""}
      ${expired ? `<p class="form-errors" role="status"><strong>This information has expired.</strong></p>` : ""}
      <p class="meta-line">${escapeHtml(item.category || "Other")} · Published ${escapeHtml(formatDateTime(item.publishedAt))}${item.updatedAt ? ` · Updated ${escapeHtml(formatDateTime(item.updatedAt))}` : ""}${item.expiresAt ? ` · ${expired ? "Expired" : "Expires"} ${escapeHtml(formatDate(item.expiresAt))}` : ""}</p>
      ${topicOf(item) ? `<p><a class="chip chip-link" href="#/company/${encodeURIComponent(topicOf(item).label)}">All updates about ${escapeHtml(topicOf(item).label)} ${icon("chevron", 12)}</a></p>` : ""}
      ${dates.length ? `<section><h2>Important dates</h2><ul>${dates.map(d => `<li class="date-row"><span><strong>${escapeHtml(d.label)}</strong>: ${escapeHtml(formatDate(d.date))}${d.time ? ` at ${escapeHtml(d.time)}` : ""}</span><button type="button" class="chip-button" data-add-msg-deadline data-title="${escapeHtml(`${d.label}: ${item.company || item.title}`.slice(0, 110))}" data-date="${escapeHtml(d.date)}" data-time="${escapeHtml(d.time || "")}" data-notes="${escapeHtml(`From message: ${item.title}`)}">${icon("deadlines", 14)} Add</button></li>`).join("")}</ul></section>` : ""}
      ${actionUrl ? `<section class="action-strip"><div><h2>Action required</h2><span class="muted">Open the official notice to act on it.</span></div><a class="button button-primary" href="${escapeHtml(actionUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.action?.label || "Open official source")} ${icon("external", 16)}</a></section>` : ""}
      <section><h2>Details</h2><div class="rich-text">${escapeHtml(cleanMessageText(item.content)).replaceAll("\n", "<br>")}</div></section>
      ${attachments.length ? `<section><h2>Attachments</h2><div class="stack">${attachments.map(file => { const url = safeUrl(file.url); return url ? `<a class="text-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(file.name || "Attachment")} ↗</a>` : ""; }).join("")}</div></section>` : ""}
      ${item.sourceName || sourceUrl ? `<section><h2>Source</h2><p class="muted">${sourceUrl ? `<a class="text-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.sourceName || "Official source")} ↗</a>` : escapeHtml(item.sourceName)}${item.verified ? ` <span class="verified-tag">${icon("check", 13)} Checked by UniCue admin</span>` : ""}</p></section>` : ""}
      ${contacts.length ? `<section><h2>Contact</h2><ul>${contacts.map(c => `<li>${escapeHtml(c.label || "Contact")}: ${escapeHtml(c.value || "")}</li>`).join("")}</ul></section>` : ""}
    </article>`;
}
