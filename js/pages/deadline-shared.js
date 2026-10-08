import { deadlineRepository } from "../repositories/deadline-repository.js";
import { decodeShare, isDuplicateDeadline } from "../domain/deadline-tools.js";
import { escapeHtml } from "../utils/escape.js";
import { formatDeadlineDue } from "../utils/dates.js";
import { errorState } from "../components/error-state.js";
import { icon } from "../components/icons.js";

// A classmate's deadline arrives as a link. Everything in it is untrusted: decoded, validated and escaped.
export function renderSharedDeadline(payload) {
  const { value, error } = decodeShare(payload);
  const back = `<div class="page-header"><a class="back-link" href="#/deadlines">${icon("chevron", 16)} Deadlines</a></div>`;
  if (error) return back + errorState("Can't open this link", `${error} Ask your classmate to share it again.`);
  const dup = isDuplicateDeadline(value, deadlineRepository.getAll());
  return `${back}<article class="card detail-card shared-deadline" data-payload="${escapeHtml(payload)}">
    <p class="eyebrow">Shared by a classmate</p>
    <span class="badge type-badge type-${escapeHtml(value.type)}">${escapeHtml(value.type)}</span>
    <h1>${escapeHtml(value.title)}</h1>
    <p class="meta-line">${value.courseName ? `${escapeHtml(value.courseName)} · ` : ""}Due ${escapeHtml(formatDeadlineDue(value))}</p>
    ${value.notes ? `<p class="rich-text">${escapeHtml(value.notes).replaceAll("\n", "<br>")}</p>` : ""}
    <p class="muted">Check the details against the official source before relying on them.</p>
    <button type="button" class="button button-primary" id="shared-add" ${dup ? "disabled" : ""}>${dup ? "Already in your deadlines" : "Add to my deadlines"}</button>
  </article>`;
}

export function bindSharedDeadline(root, { navigate }) {
  const btn = root.querySelector("#shared-add");
  const card = root.querySelector(".shared-deadline");
  if (!btn || !card) return;
  btn.addEventListener("click", () => {
    const { value } = decodeShare(card.dataset.payload);
    if (!value || isDuplicateDeadline(value, deadlineRepository.getAll())) return;
    deadlineRepository.create({ ...value, dueAt: value.dueTime ? `${value.dueDate}T${value.dueTime}` : null });
    navigate("#/deadlines");
  });
}
