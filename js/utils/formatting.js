export function formatPercentage(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(1)}%`;
}

export function formatCount(value, singular, plural = `${singular}s`) {
  const count = Number(value) || 0;
  return `${count} ${count === 1 ? singular : plural}`;
}

// "450000" -> "₹4.5 LPA"; free text like "12 LPA" is kept as typed.
export function formatPackage(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d+(\.\d+)?$/.test(text) && Number(text) >= 1000) return `₹${Number((Number(text) / 100000).toFixed(2))} LPA`;
  return text;
}

// Long free-text packages ("CTC Rs 4.5 LPA Plus Onetime...") become a short chip label ("₹4.5 LPA").
// The full text is still shown on the detail page.
export function shortPackage(value) {
  const full = formatPackage(value);
  if (!full) return "";
  const m = /(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(lpa|lakhs?|l\.?p\.?a)/i.exec(full);
  if (m) return `₹${m[2] ? `${m[1]}–${m[2]}` : m[1]} LPA`;
  return full.length > 22 ? `${full.slice(0, 21).trim()}…` : full;
}

// "Mysore, Pune, Delhi" -> { first: "Mysore", more: 2 }
export function summarizeList(value) {
  const parts = String(value ?? "").split(/[,;/\n]+/).map(s => s.trim()).filter(Boolean);
  return { first: parts[0] || "", more: Math.max(0, parts.length - 1) };
}

export function initials(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || "?").slice(0, 1)).toUpperCase();
}
