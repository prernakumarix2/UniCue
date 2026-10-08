// Opens the phone share sheet; falls back to WhatsApp when the browser has none. Returns when done.
export async function shareOrWhatsApp({ text, url = "" }) {
  try {
    if (navigator.share) { await navigator.share(url ? { text, url } : { text }); return; }
  } catch { return; /* user cancelled */ }
  window.open(`https://wa.me/?text=${encodeURIComponent(url ? `${text} ${url}` : text)}`, "_blank", "noopener");
}
