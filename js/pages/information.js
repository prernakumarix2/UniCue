import { informationRepository } from "../repositories/information-repository.js";
import { filterInformation, INFORMATION_CATEGORIES } from "../domain/information.js";
import { groupRepeats, previewText, nextDateOf } from "../domain/inbox.js";
import { isRead, markAllRead } from "../utils/read-state.js";
import { escapeHtml } from "../utils/escape.js";
import { timeAgo, formatDate } from "../utils/dates.js";
import { emptyState, errorState } from "../components/index.js";
import { chips, syncChips } from "./placement.js";

const FILTERS = ["All", "Unread", ...INFORMATION_CATEGORIES];

// Fetches once; the page and its search/filter binding share the same items.
export async function renderInformation() {
  try {
    const items = await informationRepository.getPublished();
    return { html: renderList(items), items };
  } catch (error) {
    return { html: errorState("Information unavailable", error.message || "Could not load information."), items: null };
  }
}

const when = item => timeAgo(item.updatedAt || item.publishedAt);

// "Last date to register · 21 Oct · in 3 days": the one thing a student must not miss, shown without opening the message.
function dueChip(item) {
  const next = nextDateOf(item);
  if (!next || next.days > 30) return "";
  const rel = next.days === 0 ? "today" : next.days === 1 ? "tomorrow" : `in ${next.days} days`;
  const [y, m, d] = next.date.split("-").map(Number);
  return `<p class="msg-due${next.days <= 2 ? " msg-due-soon" : ""}"><span class="msg-due-label">${escapeHtml(next.label)}</span><span class="msg-due-when">${escapeHtml(formatDate(new Date(y, m - 1, d)))} · ${rel}</span></p>`;
}

export function infoCard(item, footer = "") {
  const imp = item.importance || "Normal";
  const unread = !isRead(item.id);
  const flag = imp === "Normal" ? "" : `<span class="badge badge-${escapeHtml(imp)}">${escapeHtml(imp)}</span>`;
  return `<div class="msg-wrap"><a class="card info-card msg msg-${escapeHtml(imp)}${unread ? " unread" : ""}" href="#/information/${encodeURIComponent(item.id)}">
    <div class="msg-top">${unread ? '<span class="unread-dot" role="img" aria-label="Unread"></span>' : ""}<span class="msg-cat">${escapeHtml(item.category || "Other")}</span>${flag}${item.verified ? `<span class="msg-verified" title="Checked by UniCue admin">✓ Official${item.sourceName ? ` · ${escapeHtml(String(item.sourceName).slice(0, 16))}` : ""}</span>` : ""}<span class="msg-time">${escapeHtml(when(item))}</span></div>
    <h2>${escapeHtml(item.title)}</h2>
    ${item.summary ? `<p class="msg-summary">${escapeHtml(item.summary)}</p>` : `<p class="info-preview">${escapeHtml(previewText(item.content, 150))}</p>`}${dueChip(item)}</a>${footer}</div>`;
}

function groupCard(g) {
  const unreadMore = g.rest.filter(i => !isRead(i.id)).length;
  const rows = g.rest.map(i => `<a class="msg-mini" href="#/information/${encodeURIComponent(i.id)}">${!isRead(i.id) ? '<span class="unread-dot"></span>' : ""}<span class="msg-mini-title">${escapeHtml(i.title)}</span><span class="msg-time">${escapeHtml(when(i))}</span></a>`).join("");
  const footer = `<details class="msg-more"><summary>${g.rest.length} earlier ${g.rest.length === 1 ? "update" : "updates"} about ${escapeHtml(g.label)}${unreadMore ? ` · ${unreadMore} unread` : ""}</summary><div class="msg-mini-list">${rows}<a class="msg-mini msg-all" href="#/company/${encodeURIComponent(g.label)}">See everything about ${escapeHtml(g.label)} ${"\u2192"}</a></div></details>`;
  return infoCard(g.lead, footer);
}

function resultsHtml(items, query, category) {
  const base = filterInformation(items, { query, category: category === "Unread" ? "All" : category });
  const filtered = category === "Unread" ? base.filter(i => !isRead(i.id)) : base;
  if (!filtered.length) {
    return category === "Unread" && !query
      ? emptyState("You're all caught up", "No unread messages. New ones will appear here.")
      : emptyState("No active information", "Try another search or category.");
  }
  const critical = filtered.filter(i => i.importance === "Critical");
  const rest = groupRepeats(filtered.filter(i => i.importance !== "Critical"));
  const restHtml = rest.map(e => e.type === "group" ? groupCard(e) : infoCard(e.item)).join("");
  if (!critical.length || !rest.length) return critical.map(i => infoCard(i)).join("") + restHtml;
  return `<h2 class="group-title group-critical">Needs attention</h2>${critical.map(i => infoCard(i)).join("")}<h2 class="group-title">Latest</h2>${restHtml}`;
}

const unreadIds = items => filterInformation(items || [], {}).filter(i => !isRead(i.id)).map(i => i.id);

export function renderList(items, query = "", category = "All") {
  const unread = unreadIds(items).length;
  return `<div class="page-header page-header-row"><div><h1 class="page-title">Messages</h1><p class="page-subtitle">Critical notices stay on top. Repeats are grouped.</p></div>${unread ? `<button type="button" class="text-link" id="mark-all-read">Mark all read</button>` : ""}</div>
    <div class="filter-block"><input id="information-search" type="search" placeholder="Search messages" value="${escapeHtml(query)}" aria-label="Search messages"><select id="information-category" class="sr-only" aria-label="Category" tabindex="-1">${FILTERS.map(c => `<option ${category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select>${chips(FILTERS, category, "data-chip-category")}</div>
    <div id="information-results" class="stack">${resultsHtml(items, query, category)}</div>`;
}

export function bindInformation(root, items) {
  const search = root.querySelector("#information-search");
  const category = root.querySelector("#information-category");
  const results = root.querySelector("#information-results");
  if (!items || !search || !category || !results) return;
  const update = () => { results.innerHTML = resultsHtml(items, search.value, category.value); };
  search.addEventListener("input", update);
  category.addEventListener("change", () => { syncChips(root, "data-chip-category", category.value); update(); });
  root.querySelectorAll("[data-chip-category]").forEach(btn => btn.addEventListener("click", () => { category.value = btn.dataset.chipCategory; category.dispatchEvent(new Event("change")); }));
  root.querySelector("#mark-all-read")?.addEventListener("click", event => { markAllRead(unreadIds(items)); event.currentTarget.remove(); update(); });
}
