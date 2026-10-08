// Share "my course setup" by link: course codes, names, class days/times, last date. NEVER attendance numbers.
// Links are untrusted input: strictly validated, size-capped, and re-built field by field.
import { scheduleFromSlots } from "./timetable.js";

const MAX_PAYLOAD = 9000, MAX_COURSES = 20, MAX_SLOTS = 40;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const b64 = {
  enc: t => { const bytes = new TextEncoder().encode(t); let s = ""; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  dec: p => new TextDecoder().decode(Uint8Array.from(atob(p.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)))
};
const hhmm = t => t.replace(":", "");
const unhhmm = t => `${t.slice(0, 2)}:${t.slice(2)}`;

export function encodeCourseSetup(courses) {
  const list = (courses || []).filter(c => (c.slots?.length || Object.keys(c.schedule || {}).length)).slice(0, MAX_COURSES).map(c => {
    const item = { c: String(c.code || c.name).slice(0, 15), n: String(c.name || "").slice(0, 80) };
    if (c.section) item.x = String(c.section).slice(0, 20);
    if (c.lastDate) item.l = c.lastDate;
    if (c.slots?.length) item.t = c.slots.slice(0, MAX_SLOTS).map(s => [s.day, hhmm(s.start), hhmm(s.end), s.room, s.type]);
    else item.s = Object.fromEntries(Object.entries(c.schedule || {}).filter(([d, n]) => n > 0));
    return item;
  });
  return b64.enc(JSON.stringify({ v: 1, k: list }));
}

/** { value: [{ code, name, section, lastDate, slots, schedule }] } or { error }. Never throws. */
export function decodeCourseSetup(payload) {
  try {
    if (typeof payload !== "string" || !payload || payload.length > MAX_PAYLOAD || !/^[A-Za-z0-9_-]+$/.test(payload)) return { error: "This link is not valid." };
    const data = JSON.parse(b64.dec(payload));
    if (!data || data.v !== 1 || !Array.isArray(data.k)) return { error: "This link is from a different version." };
    const value = [];
    for (const c of data.k.slice(0, MAX_COURSES)) {
      const code = String(c?.c ?? "").trim();
      if (!/^[A-Za-z0-9 _-]{1,15}$/.test(code)) continue;
      const slots = [];
      for (const t of Array.isArray(c.t) ? c.t.slice(0, MAX_SLOTS) : []) {
        const [day, start, end, room, type] = Array.isArray(t) ? t : [];
        if (!Number.isInteger(day) || day < 1 || day > 6 || !/^\d{4}$/.test(start || "") || !/^\d{4}$/.test(end || "")) continue;
        const s = unhhmm(start), e = unhhmm(end);
        if (!TIME.test(s) || !TIME.test(e) || e <= s || !/^[A-Za-z0-9-]{1,12}$/.test(room || "") || !/^[LPT]$/.test(type || "")) continue;
        slots.push({ day, start: s, end: e, room, type });
      }
      let schedule = scheduleFromSlots(slots);
      if (!slots.length && c.s && typeof c.s === "object") {
        schedule = {};
        for (const d of [1, 2, 3, 4, 5, 6]) { const n = Number(c.s[d]); if (Number.isInteger(n) && n > 0 && n <= 8) schedule[d] = n; }
      }
      if (!Object.keys(schedule).length) continue;
      value.push({
        code: code.toUpperCase(), name: String(c.n ?? "").trim().slice(0, 80) || code.toUpperCase(),
        section: /^[A-Za-z0-9]{1,20}$/.test(c.x || "") ? c.x.toUpperCase() : "",
        lastDate: /^\d{4}-\d{2}-\d{2}$/.test(c.l || "") ? c.l : "", slots, schedule
      });
    }
    return value.length ? { value } : { error: "This link has no usable courses." };
  } catch { return { error: "This link is not valid." }; }
}

export const courseSetupUrl = (courses, base) => `${base.replace(/#.*$/, "")}#/setup/${encodeCourseSetup(courses)}`;
