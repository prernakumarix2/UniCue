export const INFORMATION_CATEGORIES = ["Academic", "Examination", "Placement", "University", "Important Notice", "Event", "Other"];
export const INFORMATION_IMPORTANCE = ["Critical", "Important", "Normal"];
export const INFORMATION_STATUSES = ["draft", "published", "expired"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const isHttpUrl = value => /^https?:\/\/\S+$/i.test(String(value ?? "").trim());

function toIso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function isValidDateTime(value) {
  return !value || !Number.isNaN(new Date(value).getTime());
}

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

const lines = text => String(text ?? "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const cells = line => line.split("|").map(cell => cell.trim());
// Split on the FIRST pipe only, so the value part may contain "|" or "://" untouched.
const splitFirst = line => {
  const index = line.indexOf("|");
  return index === -1 ? [line.trim(), ""] : [line.slice(0, index).trim(), line.slice(index + 1).trim()];
};

/* ---------- Active / expiry ---------- */

export function isExpiredInformation(item, now = new Date()) {
  if (!item) return false;
  if (item.status === "expired") return true;
  if (!item.expiresAt) return false;
  const expiry = new Date(item.expiresAt);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime();
}

export function isActiveInformation(item, now = new Date()) {
  if (!item || item.status !== "published") return false;
  return !isExpiredInformation(item, now);
}

/* ---------- List sorting / filtering ---------- */

export function sortInformation(items) {
  const weight = { Critical: 3, Important: 2, Normal: 1 };
  const time = item => new Date(item.updatedAt || item.publishedAt || 0).getTime() || 0;
  return [...items].sort((a, b) =>
    (weight[b.importance] ?? 0) - (weight[a.importance] ?? 0) || time(b) - time(a)
  );
}

export function filterInformation(items, { query = "", category = "All" } = {}, now = new Date()) {
  const q = query.trim().toLowerCase();
  return sortInformation(items.filter(item => {
    if (!isActiveInformation(item, now)) return false;
    if (category !== "All" && item.category !== category) return false;
    if (!q) return true;
    return [item.title, item.summary, item.company, item.content, item.category, item.sourceName]
      .some(value => String(value ?? "").toLowerCase().includes(q));
  }));
}

/* ---------- Text <-> structured fields (admin editor) ---------- */
// Important dates:  Label | YYYY-MM-DD | HH:MM (time optional)
// Attachments:      Name | https://link
// Contacts:         Label | value

export function parseImportantDates(text) {
  const items = []; const errors = [];
  lines(text).forEach((line, index) => {
    const [label = "", date = "", time = ""] = cells(line);
    if (!label || !isRealDate(date)) { errors.push(`Important date line ${index + 1}: use "Label | YYYY-MM-DD | HH:MM" (time optional).`); return; }
    if (time && !TIME_RE.test(time)) { errors.push(`Important date line ${index + 1}: time must be HH:MM (24-hour).`); return; }
    items.push(time ? { label, date, time } : { label, date });
  });
  return { items, errors };
}

export function parseAttachments(text) {
  const items = []; const errors = [];
  lines(text).forEach((line, index) => {
    const [name, url] = splitFirst(line);
    if (!name || !isHttpUrl(url)) { errors.push(`Attachment line ${index + 1}: use "Name | https://link".`); return; }
    items.push({ name, url });
  });
  return { items, errors };
}

export function parseContacts(text) {
  const items = []; const errors = [];
  lines(text).forEach((line, index) => {
    const [label, value] = splitFirst(line);
    if (!label || !value) { errors.push(`Contact line ${index + 1}: use "Label | value".`); return; }
    items.push({ label, value });
  });
  return { items, errors };
}

export const formatImportantDatesText = items => (items ?? []).map(i => [i.label, i.date, i.time].filter(Boolean).join(" | ")).join("\n");
export const formatAttachmentsText = items => (items ?? []).map(i => `${i.name} | ${i.url}`).join("\n");
export const formatContactsText = items => (items ?? []).map(i => `${i.label} | ${i.value}`).join("\n");

/* ---------- Validation / normalisation ---------- */

export function validateInformation(input) {
  const errors = {};
  if (!String(input.title ?? "").trim()) errors.title = "Title is required.";
  else if (String(input.title).trim().length > 200) errors.title = "Title must be 200 characters or fewer.";
  if (!INFORMATION_CATEGORIES.includes(input.category)) errors.category = "Choose a valid category.";
  if (!INFORMATION_IMPORTANCE.includes(input.importance)) errors.importance = "Choose a valid importance level.";
  if (!String(input.content ?? "").trim()) errors.content = "Content is required.";
  if (String(input.summary ?? "").trim().length > 200) errors.summary = "Summary must be 200 characters or fewer.";
  if (String(input.company ?? "").trim().length > 80) errors.company = "Company must be 80 characters or fewer.";
  if (input.sourceUrl && !isHttpUrl(input.sourceUrl)) errors.sourceUrl = "Source URL must start with http:// or https://.";
  if (!isValidDateTime(input.publishedAt)) errors.publishedAt = "Enter a valid published date/time.";
  if (!isValidDateTime(input.expiresAt)) errors.expiresAt = "Enter a valid expiry date/time.";
  else if (input.expiresAt && input.publishedAt && isValidDateTime(input.publishedAt)
    && new Date(input.expiresAt).getTime() < new Date(input.publishedAt).getTime()) {
    errors.expiresAt = "Expiry must be after the published date.";
  }
  const actionUrl = input.action?.url ?? input.actionUrl;
  const actionLabel = input.action?.label ?? input.actionLabel;
  if (actionUrl && !isHttpUrl(actionUrl)) errors.actionUrl = "Action URL must start with http:// or https://.";
  if (actionLabel && !actionUrl) errors.actionUrl = "Add an action URL or clear the action label.";
  if (input.status !== undefined && !INFORMATION_STATUSES.includes(input.status)) errors.status = "Choose a valid status.";
  if (Array.isArray(input.importantDates)) {
    for (const date of input.importantDates) {
      if (!date.label?.trim() || !date.date) { errors.importantDates = "Every important date needs a label and date."; break; }
    }
  }
  return errors;
}

export function normalizeInformation(input, existing = {}) {
  const status = INFORMATION_STATUSES.includes(input.status) ? input.status : (input.published ? "published" : "draft");
  const actionUrl = String(input.action?.url ?? input.actionUrl ?? "").trim();
  const actionLabel = String(input.action?.label ?? input.actionLabel ?? "").trim();
  return {
    ...existing,
    title: String(input.title ?? "").trim(),
    category: input.category,
    importance: input.importance,
    content: String(input.content ?? "").trim(),
    summary: String(input.summary ?? "").trim(),
    company: String(input.company ?? "").trim(),
    sourceName: String(input.sourceName ?? "").trim(),
    sourceUrl: String(input.sourceUrl ?? "").trim(),
    publishedAt: toIso(input.publishedAt) || (status === "published" ? new Date().toISOString() : ""),
    expiresAt: toIso(input.expiresAt),
    verified: Boolean(input.verified),
    banner: Boolean(input.banner),
    action: actionUrl ? { label: actionLabel || "Open official source", url: actionUrl } : null,
    importantDates: Array.isArray(input.importantDates) ? input.importantDates.filter(item => item.label && item.date) : (existing.importantDates ?? []),
    attachments: Array.isArray(input.attachments) ? input.attachments : (existing.attachments ?? []),
    contacts: Array.isArray(input.contacts) ? input.contacts : (existing.contacts ?? []),
    status
  };
}

/** Parses the raw admin form and returns { value, errors } where errors is a list of messages. */
export function parseInformationForm(data, existing = {}) {
  const dates = parseImportantDates(data.importantDatesText);
  const attachments = parseAttachments(data.attachmentsText);
  const contacts = parseContacts(data.contactsText);
  const raw = { ...data, importantDates: dates.items };
  const fieldErrors = Object.values(validateInformation(raw));
  const errors = [...fieldErrors, ...dates.errors, ...attachments.errors, ...contacts.errors];
  const value = normalizeInformation({ ...raw, attachments: attachments.items, contacts: contacts.items }, existing);
  return { value, errors };
}

/** Patch applied by the one-click manager actions (publish / unpublish / expire). */
export function informationStatusPatch(item, status, now = new Date()) {
  const patch = { status };
  if (status === "published" && !item?.publishedAt) patch.publishedAt = now.toISOString();
  return patch;
}
