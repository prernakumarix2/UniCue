export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeUrl(value = "") {
  try {
    const url = new URL(value, window.location.href);
    if (["http:", "https:"].includes(url.protocol)) return url.href;
  } catch {}
  return "";
}
