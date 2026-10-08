const DAY_MS = 86400000;

export const MAX_SELECTION_STEPS = 10;

export const PLACEMENT_STATUSES = ["Open", "Closing Soon", "Closed"];
// Stored (admin-controlled) record states. "closed" stays visible to students.
export const PLACEMENT_RECORD_STATUSES = ["draft", "published", "closed"];

function toIso(value) {
  const date = toDate(value);
  return date ? date.toISOString() : "";
}

export function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getPlacementStatus(item, now = new Date()) {
  if (String(item?.status || "").toLowerCase() === "closed") return "Closed";
  const deadline = toDate(item?.applicationDeadline);
  if (!deadline) return "Open";
  if (deadline.getTime() <= now.getTime()) return "Closed";
  const days = (deadline.getTime() - now.getTime()) / DAY_MS;
  return days <= 2 ? "Closing Soon" : "Open";
}

export function normalizePlacement(input = {}) {
  const status = PLACEMENT_RECORD_STATUSES.includes(input.status) ? input.status : (input.published ? "published" : "draft");
  return {
    company: String(input.company || "").trim(),
    role: String(input.role || "").trim(),
    driveType: String(input.driveType || "").trim(),
    driveCode: String(input.driveCode || "").trim(),
    eligibleBatches: String(input.eligibleBatches || "").trim(),
    eligiblePrograms: String(input.eligiblePrograms || "").trim(),
    eligibility: String(input.eligibility || "").trim(),
    salary: String(input.salary || "").trim(),
    bond: String(input.bond || "").trim(),
    applicationDeadline: toIso(input.applicationDeadline),
    workLocations: String(input.workLocations || "").trim(),
    jobDescription: String(input.jobDescription || "").trim(),
    skills: String(input.skills || "").trim(),
    selectionProcess: String(input.selectionProcess || "").trim(),
    driveDate: toIso(input.driveDate),
    joiningDate: toIso(input.joiningDate),
    contactPerson: String(input.contactPerson || "").trim(),
    tpcInfo: String(input.tpcInfo || "").trim(),
    documentsRequired: String(input.documentsRequired || "").trim(),
    dressCode: String(input.dressCode || "").trim(),
    specialRequirements: String(input.specialRequirements || "").trim(),
    companyWebsite: String(input.companyWebsite || "").trim(),
    officialSource: String(input.officialSource || "").trim(),
    applicationUrl: String(input.applicationUrl || "").trim(),
    status
  };
}

/** One step per line (or "A -> B -> C" on a single line) -> [{ title, detail }]. Never truncates. */
export function parseSelectionSteps(text) {
  const raw = String(text ?? "").replace(/\r/g, "").trim();
  if (!raw) return [];
  let parts = raw.split("\n").map(l => l.trim()).filter(Boolean);
  if (parts.length === 1) {
    const arrow = parts[0].split(/\s*(?:->|=>|→|»)\s*/);
    parts = arrow.length > 1 ? arrow : parts[0].split(/\s*;\s*/);
  }
  return parts.map(line => {
    const clean = line.replace(/^(?:[-*•▪●]|\d+[.)])\s*/, "").trim();
    const m = clean.match(/^(.{2,60}?)\s*[:\-–—]\s+(.+)$/);
    if (!m || /^(?:round|step|stage)\s*\d+$/i.test(m[1].trim())) return { title: clean, detail: "" };
    return { title: m[1].trim(), detail: m[2].trim() };
  }).filter(step => step.title);
}

export function formatSelectionSteps(steps = []) {
  return steps.map(s => (s.detail ? `${s.title}: ${s.detail}` : s.title)).join("\n");
}

const norm = v => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");

function sameRole(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(b + " ") || b.startsWith(a + " ");
}

/** Existing placements at the same company (closed ones and the item itself skipped); same role ranks first. */
export function findSimilarPlacements(candidate = {}, list = [], { excludeId = "" } = {}) {
  const company = norm(candidate.company);
  const role = norm(candidate.role);
  if (company.length < 2) return [];
  const same = [];
  const other = [];
  for (const item of list) {
    if (!item || (excludeId && item.id === excludeId)) continue;
    if (String(item.status || "").toLowerCase() === "closed") continue;
    if (norm(item.company) !== company) continue;
    if (sameRole(role, norm(item.role))) same.push({ item, reason: "Same company and role" });
    else other.push({ item, reason: "Same company, different role" });
  }
  return [...same, ...other];
}

export function validatePlacement(item) {
  const errors = {};
  if (!item.company) errors.company = "Company is required.";
  else if (item.company.length > 150) errors.company = "Company must be 150 characters or fewer.";
  if (!item.role) errors.role = "Role is required.";
  else if (item.role.length > 150) errors.role = "Role must be 150 characters or fewer.";
  if (parseSelectionSteps(item.selectionProcess).length > MAX_SELECTION_STEPS) errors.selectionProcess = `Selection process can have at most ${MAX_SELECTION_STEPS} steps.`;
  if (item.applicationDeadline && !toDate(item.applicationDeadline)) errors.applicationDeadline = "Application deadline is invalid.";
  if (item.driveDate && !toDate(item.driveDate)) errors.driveDate = "Drive date is invalid.";
  if (item.joiningDate && !toDate(item.joiningDate)) errors.joiningDate = "Joining date is invalid.";
  if (item.companyWebsite && !/^https?:\/\//i.test(item.companyWebsite)) errors.companyWebsite = "Company website must start with http:// or https://.";
  if (item.officialSource && !/^https?:\/\//i.test(item.officialSource)) errors.officialSource = "Official source must start with http:// or https://.";
  if (item.applicationUrl && !/^https?:\/\//i.test(item.applicationUrl)) errors.applicationUrl = "Application link must start with http:// or https://.";
  return errors;
}

export function filterPlacements(items = [], { query = "", status = "All" } = {}, now = new Date()) {
  const q = query.trim().toLowerCase();
  return [...items]
    .filter(item => {
      const computed = getPlacementStatus(item, now);
      if (status !== "All" && computed !== status) return false;
      if (!q) return true;
      return [
        item.company, item.role, item.location, item.workLocations,
        item.jobDescription, item.skills, item.eligibility, item.salary,
        item.driveType, item.driveCode, item.eligiblePrograms, item.eligibleBatches
      ].some(value => String(value ?? "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      // Open / Closing Soon first (soonest deadline first, no-deadline last);
      // Closed last (most recently closed first).
      const aClosed = getPlacementStatus(a, now) === "Closed";
      const bClosed = getPlacementStatus(b, now) === "Closed";
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      const ad = toDate(a.applicationDeadline)?.getTime();
      const bd = toDate(b.applicationDeadline)?.getTime();
      if (aClosed) return (bd ?? 0) - (ad ?? 0) || String(a.company || "").localeCompare(String(b.company || ""));
      return (ad ?? Number.MAX_SAFE_INTEGER) - (bd ?? Number.MAX_SAFE_INTEGER) || String(a.company || "").localeCompare(String(b.company || ""));
    });
}

/** Parses the raw admin form and returns { value, errors } where errors is a list of messages. */
export function parsePlacementForm(data = {}) {
  const value = normalizePlacement(data);
  const errors = Object.values(validatePlacement(value));
  for (const [field, label] of [["applicationDeadline", "Application deadline"], ["driveDate", "Drive date"], ["joiningDate", "Joining date"]]) {
    if (data[field] && !value[field]) errors.push(`${label} is invalid.`);
  }
  return { value, errors };
}

/** Patch applied by the one-click manager actions (publish / unpublish / close / reopen). */
export function placementStatusPatch(status) {
  return { status };
}
