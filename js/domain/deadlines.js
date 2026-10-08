const TYPES = ["Assignment", "Quiz", "Lab", "PBIQ", "Project", "Presentation", "Exam", "Other"];
export const DEADLINE_TYPES = [...TYPES];

export function validateDeadline(input) {
  const errors = {};
  if (!String(input.title ?? "").trim()) errors.title = "Title is required.";
  if (!TYPES.includes(input.type)) errors.type = "Choose a valid deadline type.";
  if (!input.dueDate) errors.dueDate = "Due date is required.";
  if (input.dueDate && Number.isNaN(new Date(input.dueDate).getTime())) errors.dueDate = "Enter a valid date.";
  if (input.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.dueTime)) errors.dueTime = "Enter a valid time.";
  if (String(input.notes ?? "").length > 1000) errors.notes = "Notes must be 1000 characters or fewer.";
  return errors;
}

export function getDueDateTime(deadline) {
  if (!deadline?.dueDate) return null;
  const time = deadline.dueTime || "23:59:59.999";
  const date = new Date(`${deadline.dueDate}T${time}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isOverdue(deadline, now = new Date()) {
  if (deadline?.completed) return false;
  const due = getDueDateTime(deadline);
  return Boolean(due && due.getTime() < now.getTime());
}

export function getDeadlineBucket(deadline, now = new Date()) {
  if (deadline.completed) return "completed";
  if (isOverdue(deadline, now)) return "overdue";
  const due = getDueDateTime(deadline);
  if (!due) return "upcoming";
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (due >= start && due <= end) return "today";
  const tomorrow = new Date(start); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEnd = new Date(end); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  if (due >= tomorrow && due <= tomorrowEnd) return "tomorrow";
  return "upcoming";
}

export function sortDeadlines(items) {
  return [...items].sort((a,b) => (getDueDateTime(a)?.getTime() ?? Infinity) - (getDueDateTime(b)?.getTime() ?? Infinity));
}

/** Finer-grained than getDeadlineBucket: splits "upcoming" into this week (next 7 days) and later. */
export function getDeadlineGroup(deadline, now = new Date()) {
  const bucket = getDeadlineBucket(deadline, now);
  if (bucket !== "upcoming") return bucket;
  const due = getDueDateTime(deadline);
  if (!due) return "later";
  const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((day(due) - day(now)) / 86400000) <= 7 ? "week" : "later";
}
