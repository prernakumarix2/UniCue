export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // Date-only strings (YYYY-MM-DD) must be local, not UTC, or they shift a day in some time zones.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = {}) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric", month: "short", year: "numeric", ...options
  }).format(date);
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit"
  }).format(date);
}

export function startOfToday(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfToday(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function isExpired(value, now = new Date()) {
  const date = toDate(value);
  return Boolean(date && date.getTime() < now.getTime());
}

export function toIsoOrNull(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

/** "Oct 21, 2026" for date-only deadlines; "Oct 21, 2026, 5:00 PM" only when the user entered a time. */
export function formatDeadlineDue(item) {
  if (item?.dueTime) return formatDateTime(`${item.dueDate}T${item.dueTime}`);
  return formatDate(item?.dueDate);
}

// Friendly countdown for a due date. Returns { label, tone } where tone is overdue|soon|later.
export function relativeDue(date, now = new Date()) {
  if (!date) return null;
  const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const n = Math.round((day(date) - day(now)) / 86400000);
  if (n < 0) return { label: n === -1 ? "Overdue by 1 day" : `Overdue by ${-n} days`, tone: "overdue" };
  if (n === 0) return { label: "Due today", tone: "soon" };
  if (n === 1) return { label: "Due tomorrow", tone: "soon" };
  return { label: `In ${n} days`, tone: n <= 3 ? "soon" : "later" };
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", else a date. */
export function timeAgo(value, now = new Date()) {
  const d = toDate(value);
  if (!d) return "";
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(d);
}
