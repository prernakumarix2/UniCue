// Deadline helpers: quick date chips, exam countdown, and share-by-link (no database, the link carries the data).
import { DEADLINE_TYPES, validateDeadline, getDueDateTime } from "./deadlines.js";

const pad = n => String(n).padStart(2, "0");
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Date shortcut chips: Today, Tomorrow, then the next days by name ("Mon 12"). */
export function quickDates(now = new Date(), count = 7) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({ value: isoOf(d), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${WEEKDAYS[d.getDay()]} ${d.getDate()}` });
  }
  return out;
}

/** Student-added exams that are still ahead (today counts). [{ item, days }] soonest first. */
export function upcomingExams(deadlines, now = new Date()) {
  const today = startOfDay(now).getTime();
  return (deadlines || [])
    .filter(d => d && d.type === "Exam" && !d.completed)
    .map(item => ({ item, due: getDueDateTime(item) }))
    .filter(x => x.due)
    .map(({ item, due }) => ({ item, days: Math.round((startOfDay(due).getTime() - today) / 86400000) }))
    .filter(x => x.days >= 0)
    .sort((a, b) => a.days - b.days);
}

export const examCountdown = days => (days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`);

/* ---------- Share by link ---------- */

const MAX_PAYLOAD = 2000;
const b64urlEncode = text => {
  const bytes = new TextEncoder().encode(text);
  let bin = ""; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlDecode = payload => {
  const bin = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

/** Compact, URL-safe payload for one deadline. Notes are trimmed so links stay short enough for WhatsApp. */
export function encodeShare(item) {
  const data = { v: 1, t: String(item.title || "").slice(0, 150), c: String(item.courseName || "").slice(0, 80), y: item.type, d: item.dueDate };
  if (item.dueTime) data.m = item.dueTime;
  if (item.notes) data.n = String(item.notes).slice(0, 300);
  return b64urlEncode(JSON.stringify(data));
}

/**
 * Untrusted input from a link. Returns { value } (a clean deadline draft) or { error }.
 * Never throws; every field is re-validated and re-limited.
 */
export function decodeShare(payload) {
  try {
    if (typeof payload !== "string" || !payload || payload.length > MAX_PAYLOAD || !/^[A-Za-z0-9_-]+$/.test(payload)) return { error: "This link is not valid." };
    const data = JSON.parse(b64urlDecode(payload));
    if (!data || typeof data !== "object" || data.v !== 1) return { error: "This link is from a different version." };
    const value = {
      title: String(data.t ?? "").trim().slice(0, 150),
      courseName: String(data.c ?? "").trim().slice(0, 80),
      type: DEADLINE_TYPES.includes(data.y) ? data.y : "Other",
      dueDate: String(data.d ?? ""),
      dueTime: data.m ? String(data.m) : "",
      notes: String(data.n ?? "").trim().slice(0, 300)
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.dueDate)) return { error: "This link has an invalid date." };
    const errors = validateDeadline(value);
    if (Object.keys(errors).length) return { error: Object.values(errors)[0] };
    return { value };
  } catch {
    return { error: "This link is not valid." };
  }
}

export const shareUrl = (item, base) => `${base.replace(/#.*$/, "")}#/shared/${encodeShare(item)}`;

export function shareMessage(item) {
  const when = new Date(`${item.dueDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${item.type}: ${item.title}${item.courseName ? ` (${item.courseName})` : ""}, due ${when}${item.dueTime ? ` ${item.dueTime}` : ""}. Add it to UniCue:`;
}

export function isDuplicateDeadline(draft, existing) {
  const t = String(draft.title || "").trim().toLowerCase();
  return (existing || []).some(d => String(d.title || "").trim().toLowerCase() === t && d.dueDate === draft.dueDate);
}
