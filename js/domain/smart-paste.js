// Admin helper: turn raw pasted UMS text into a pre-filled message, and warn about near-duplicates.
// Everything here is a SUGGESTION. The admin reviews each field before publishing.
import { cleanMessageText, topicOf } from "./inbox.js";

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const pad = n => String(n).padStart(2, "0");

const CRITICAL_RE = /\b(suspend(?:ed|s)?|cancel(?:l)?ed|postpone(?:d|s)?|detain(?:ed)?|debarred?|rusticat\w*|disciplinary|show[- ]cause|emergency|strictly prohibited)\b/i;
const IMPORTANT_RE = /\b(last date|last day|deadline|mandatory|compulsory|urgent|must|final reminder|shortlist\w*|before \d|closes?|closing)\b/i;
const CATEGORY_RULES = [
  ["Placement", /\b(placement|drive|recruit\w*|hiring|campus drive|ctc|lpa|package|internship|job)\b/i],
  ["Examination", /\b(exam\w*|mid[- ]?term|end[- ]?term|date ?sheet|admit card|seating plan|re-?evaluation|re-?appear|makeup)\b/i],
  ["Event", /\b(fest|event|seminar|workshop|webinar|competition|hackathon|celebration|orientation)\b/i],
  ["Academic", /\b(timetable|syllabus|assignment|course|attendance|lecture|section|project|lab|quiz)\b/i],
  ["University", /\b(hostel|fee|fees|library|holiday|transport|bus|mess)\b/i]
];
const SKIP_LINE = /^(announcements?|reporting|notice|circular|dear (students?|all)|subject\s*:?\s*$|regards|thanks?)[\s,:.!-]*$/i;
const ACTION_RE = /\b(must|should|need to|needs to|required|register|submit|report|attend|apply|upload|fill|before|last date|carry|bring)\b/i;

/** First http(s) link, without trailing punctuation. */
function firstUrl(text) {
  const match = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  return match ? match[0].replace(/[.,;:!?]+$/, "") : "";
}

function sentences(text) {
  return text.replace(/\n+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(s => s.trim()).filter(s => s.length > 8);
}

function pickTitle(clean) {
  const lines = clean.split("\n").map(l => l.trim());
  for (const line of lines) {
    if (!line) continue;
    const subject = line.match(/^subject\s*[:\-]\s*(.+)$/i);
    const text = (subject ? subject[1] : line).replace(/^[-*#\s]+/, "").trim();
    if (text.length < 6 || SKIP_LINE.test(text)) continue;
    return { title: text.slice(0, 120).replace(/[.:]+$/, ""), line };
  }
  return { title: "", line: "" };
}

/** Finds dates in a line. Day-first (India): 21/10/2026, 21 Oct 2026, 21st October, 2026-10-21. */
export function findDates(text, now = new Date()) {
  const found = [];
  const push = (index, length, y, m, d) => {
    if (!y) { // no year: this year, or next year if that would be more than ~2 months ago
      y = now.getFullYear();
      if (new Date(y, m - 1, d).getTime() < now.getTime() - 60 * 86400000) y += 1;
    }
    const real = new Date(y, m - 1, d);
    if (real.getFullYear() !== y || real.getMonth() !== m - 1 || real.getDate() !== d) return;
    found.push({ index, length, date: `${y}-${pad(m)}-${pad(d)}` });
  };
  const patterns = [
    [/\b(\d{4})-(\d{2})-(\d{2})\b/g, m => [+m[1], +m[2], +m[3]]],
    [/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g, m => [+m[3], +m[2], +m[1]]],
    [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s-]+${MONTH_RE}\\.?(?:[\\s,'-]+(\\d{4}))?`, "gi"), m => [m[3] ? +m[3] : 0, MONTHS[m[2].slice(0, 4).toLowerCase()] || MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]]],
    [new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, "gi"), m => [m[3] ? +m[3] : 0, MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]]]
  ];
  for (const [re, pick] of patterns) {
    for (const m of text.matchAll(re)) {
      const [y, mo, d] = pick(m);
      if (mo && d) push(m.index, m[0].length, y, mo, d);
    }
  }
  // drop overlaps (the longer, more specific match wins)
  found.sort((a, b) => a.index - b.index || b.length - a.length);
  return found.filter((f, i) => !found.slice(0, i).some(p => f.index < p.index + p.length));
}

export function findTime(text) {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!m) return "";
  let h = +m[1]; const min = m[2] ? +m[2] : 0; const mer = (m[3] || "").toLowerCase();
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return h > 23 ? "" : `${pad(h)}:${pad(min)}`;
}

function labelFor(line, dates) {
  let label = line;
  for (const d of [...dates].sort((a, b) => b.index - a.index)) label = label.slice(0, d.index) + " " + label.slice(d.index + d.length);
  label = label.replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, " ").replace(/https?:\/\/\S+/g, " ")
    .replace(/\b(on|by|before|till|until|from|date|dated|at)\b\s*$/i, " ")
    .replace(/[\s:;,\-–—()|]+/g, " ").replace(/^[\s\-–:]+|[\s\-–:]+$/g, "").trim();
  if (label.length > 60) label = `${label.slice(0, 57).trimEnd()}…`;
  return label || "Date";
}

export function extractImportantDates(clean, now = new Date()) {
  const out = []; const seen = new Set();
  for (const line of clean.split("\n")) {
    const dates = findDates(line, now);
    if (!dates.length) continue;
    const time = findTime(line);
    const label = labelFor(line, dates);
    for (const d of dates.slice(0, 2)) {
      const key = `${label}|${d.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(time ? { label, date: d.date, time } : { label, date: d.date });
    }
  }
  return out.slice(0, 6);
}

export function extractContacts(clean) {
  const out = [];
  for (const m of clean.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) if (!out.some(c => c.value === m[0])) out.push({ label: "Email", value: m[0] });
  for (const m of clean.matchAll(/(?:\+91[\s-]?)?\b[6-9]\d{9}\b/g)) if (!out.some(c => c.value === m[0])) out.push({ label: "Phone", value: m[0] });
  return out.slice(0, 4);
}

/**
 * Raw pasted text -> suggested message fields plus human-readable notes explaining each guess.
 * Never throws; empty input returns empty suggestions.
 */
export function smartPaste(raw, now = new Date()) {
  const clean = cleanMessageText(raw);
  const notes = [];
  if (!clean) return { title: "", category: "Other", importance: "Normal", content: "", summary: "", company: "", actionUrl: "", importantDates: [], contacts: [], notes };

  const { title, line } = pickTitle(clean);
  let content = clean;
  if (line) {
    const rest = clean.split("\n").slice(clean.split("\n").findIndex(l => l.trim() === line) + 1).join("\n").trim();
    if (rest.length > 20) content = rest;
  }
  const haystack = `${title}\n${clean}`;

  let category = "Other";
  for (const [name, re] of CATEGORY_RULES) if (re.test(haystack)) { category = name; break; }
  notes.push(`Category guessed as ${category}.`);

  let importance = "Normal";
  const critical = haystack.match(CRITICAL_RE);
  const important = haystack.match(IMPORTANT_RE);
  if (critical) { importance = "Critical"; notes.push(`Marked Critical because it mentions "${critical[0]}". Lower it if this is routine.`); }
  else if (important) { importance = "Important"; notes.push(`Marked Important because it mentions "${important[0]}".`); }

  const company = topicOf({ title, category })?.label || "";
  if (company) notes.push(`Company guessed as ${company}. Check the spelling, it groups repeats.`);

  const summary = (sentences(content).find(s => ACTION_RE.test(s)) || sentences(content)[0] || "").slice(0, 160).replace(/\s+/g, " ");
  if (summary) notes.push("Summary is the first action sentence. Rewrite it as one clear line for students.");

  const importantDates = extractImportantDates(clean, now);
  if (importantDates.length) notes.push(`Found ${importantDates.length} date${importantDates.length === 1 ? "" : "s"}. Check the labels.`);
  const contacts = extractContacts(clean);
  const actionUrl = firstUrl(clean);
  if (actionUrl) notes.push("Used the first link as the action link.");

  return { title, category, importance, content, summary, company, actionUrl, importantDates, contacts, notes };
}

/* ---------- Similar-message warning ---------- */

const STOP_WORDS = new Set(["the", "and", "for", "with", "from", "that", "this", "are", "has", "have", "will", "all", "students", "student", "regarding", "about", "notice", "update", "updates", "reminder", "important", "new"]);
const tokens = text => new Set(String(text || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)));

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * Existing, non-expired messages that look like the draft (similar title, or same company posted recently).
 * Returns up to 3: [{ item, score, reason }], best first.
 */
export function findSimilar(draft, items, { excludeId = "", now = new Date() } = {}) {
  const dTokens = tokens(draft.title);
  const dCompany = String(draft.company || topicOf({ title: draft.title, category: draft.category })?.label || "").trim().toLowerCase();
  const matches = [];
  for (const item of items || []) {
    if (!item || item.id === excludeId || item.status === "expired") continue;
    const titleScore = jaccard(dTokens, tokens(item.title));
    const itemCompany = String(item.company || topicOf(item)?.label || "").trim().toLowerCase();
    const sameCompany = Boolean(dCompany) && dCompany === itemCompany;
    const ageDays = (now.getTime() - new Date(item.updatedAt || item.publishedAt || 0).getTime()) / 86400000;
    if (titleScore >= 0.6) matches.push({ item, score: titleScore, reason: "Very similar title" });
    else if (sameCompany && ageDays <= 14) matches.push({ item, score: 0.5 + titleScore / 2, reason: `Same company (${draft.company || item.company || dCompany}), posted recently` });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 3);
}
