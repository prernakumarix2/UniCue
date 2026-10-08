const KEY = "unicue_theme";
const COLORS = { light: "#ffffff", dark: "#0f1020" };

export function getTheme() {
  try { return localStorage.getItem(KEY) || "system"; } catch { return "system"; }
}

export function resolveTheme(choice = getTheme()) {
  if (choice === "light" || choice === "dark") return choice;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(choice = getTheme()) {
  const resolved = resolveTheme(choice);
  document.documentElement.dataset.theme = resolved;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = COLORS[resolved];
  document.head.appendChild(meta);
  return resolved;
}

export function setTheme(choice) {
  try { localStorage.setItem(KEY, choice); } catch { /* storage unavailable */ }
  return applyTheme(choice);
}

export function watchSystemTheme() {
  if (!window.matchMedia) return;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (getTheme() === "system") applyTheme("system"); });
}
