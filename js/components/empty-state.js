import { escapeHtml } from "../utils/escape.js";
export function emptyState(title, message, action = "") {
  return `<section class="empty-state card"><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(message)}</p>${action}</section>`;
}
