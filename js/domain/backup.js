import { sanitizeSlots } from "./timetable.js";
export const BACKUP_VERSION = 1;

export function buildBackup({ attendance = [], deadlines = [], semesterTarget = null, theme = "system", preferences = {} }, now = new Date()) {
  return { app: "unicue", version: BACKUP_VERSION, exportedAt: now.toISOString(), attendance, deadlines, semesterTarget, theme,
    preferences: { placementProfile: preferences.placementProfile || null, savedDrives: Array.isArray(preferences.savedDrives) ? preferences.savedDrives : [] } };
}

/** Optional on-device placement data (CGPA/backlogs, saved drives). Tolerates old backups that have none. */
export function sanitizePreferences(raw) {
  const num = v => (v === "" || v == null || !Number.isFinite(Number(v)) ? "" : Math.min(30, Math.max(0, Number(v))));
  const p = raw && typeof raw === "object" ? raw : {};
  return {
    placementProfile: p.placementProfile && typeof p.placementProfile === "object" ? { cgpa: num(p.placementProfile.cgpa) === "" ? "" : Math.min(10, num(p.placementProfile.cgpa)), backlogs: num(p.placementProfile.backlogs) } : null,
    savedDrives: (Array.isArray(p.savedDrives) ? p.savedDrives : []).filter(x => typeof x === "string" && x.length > 0 && x.length <= 100).slice(0, 100)
  };
}

const isObj = v => v && typeof v === "object" && !Array.isArray(v);

export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: "That file is not valid JSON." }; }
  if (!isObj(data) || data.app !== "unicue") return { ok: false, error: "This is not a UniCue backup file." };
  if (data.version > BACKUP_VERSION) return { ok: false, error: "This backup is from a newer version of UniCue." };
  if (!Array.isArray(data.attendance) || !Array.isArray(data.deadlines)) return { ok: false, error: "The backup is missing attendance or deadlines." };
  const courseOk = c => isObj(c) && typeof c.id === "string" && typeof c.name === "string" && Number.isInteger(c.conducted) && Number.isInteger(c.attended) && c.attended + (Number(c.dl) || 0) <= c.conducted && c.conducted >= 0 && Number(c.target) >= 0 && Number(c.target) <= 100;
  const deadlineOk = d => isObj(d) && typeof d.id === "string" && typeof d.title === "string" && typeof d.dueDate === "string";
  if (!data.attendance.every(courseOk)) return { ok: false, error: "Some courses in the backup are invalid." };
  if (!data.deadlines.every(deadlineOk)) return { ok: false, error: "Some deadlines in the backup are invalid." };
  const theme = ["system", "light", "dark"].includes(data.theme) ? data.theme : "system";
  const semesterTarget = Number.isFinite(Number(data.semesterTarget)) && data.semesterTarget !== null ? Math.min(100, Math.max(0, Number(data.semesterTarget))) : null;
  const attendance = data.attendance.map(c => (Array.isArray(c.slots) ? { ...c, slots: sanitizeSlots(c.slots) } : c));
  return { ok: true, data: { attendance, deadlines: data.deadlines, semesterTarget, theme, preferences: sanitizePreferences(data.preferences) } };
}
