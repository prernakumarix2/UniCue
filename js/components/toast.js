let current;
/** Small bottom message with an optional action (e.g. Undo). Survives page re-renders. */
export function showToast(message, { actionLabel = "", onAction = null, ms = 5000 } = {}) {
  current?.remove();
  const el = document.createElement("div");
  el.className = "toast"; el.setAttribute("role", "status");
  const text = document.createElement("span"); text.textContent = message; el.appendChild(text);
  if (actionLabel) {
    const btn = document.createElement("button"); btn.type = "button"; btn.textContent = actionLabel;
    btn.addEventListener("click", () => { el.remove(); onAction?.(); });
    el.appendChild(btn);
  }
  document.body.appendChild(el); current = el;
  setTimeout(() => { if (current === el) { el.remove(); current = null; } }, ms);
}
