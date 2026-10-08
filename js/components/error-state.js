import { escapeHtml } from "../utils/escape.js";
export function errorState(title = "Something went wrong", message = "Please try again.") {
  // Temporary problems (network, slow load) get a Try again button; "not found" style errors do not.
  const retry = /unavailable|unable to load|something went wrong/i.test(title);
  return `<section class="error-state card"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${retry ? '<button type="button" class="button button-secondary" data-retry>Try again</button>' : ""}</section>`;
}
