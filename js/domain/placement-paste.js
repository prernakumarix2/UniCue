// Admin helper: a pasted company notice -> suggested placement fields. Suggestions only, the admin reviews everything.
import { cleanMessageText } from "./inbox.js";
import { findDates, findTime } from "./smart-paste.js";

// [field, label pattern (on the lower-cased label), multiLine]
const LABELS = [
  ["company", /^(company( name)?|organi[sz]ation|employer)$/, false],
  ["role", /^((job|hiring) )?(role|roles|profile|designation|position|job title|title)$/, false],
  ["salary", /^(ctc|package|salary|stipend|compensation|ctc ?\/ ?stipend|ctc offered)$/, false],
  ["workLocations", /^((work|job) )?locations?$/, false],
  ["eligibleBatches", /^(eligible )?(batch(es)?|passing out batch|graduation year)$/, false],
  ["eligiblePrograms", /^(eligible )?(programs?|branches|branch|courses?|streams?)$/, false],
  ["bond", /^(bond|service (agreement|bond)|bond details)$/, false],
  ["contactPerson", /^(contact( person)?|spoc|point of contact)$/, false],
  ["applicationUrl", /^(link|apply|apply now|apply link|apply here|registration link|application link|url)$/, false],
  ["deadlineText", /^(last date( to (apply|register))?|registration (deadline|last date)|application deadline|deadline|apply by|register by)$/, false],
  ["driveDateText", /^(drive date|date of drive|test date|interview date|date)$/, false],
  ["eligibility", /^(eligibility( criteria)?|criteria|eligible criteria)$/, true],
  ["selectionProcess", /^(selection (process|procedure|rounds)|rounds|hiring process|recruitment process|process)$/, true],
  ["jobDescription", /^(job description|jd|about the role|responsibilities|role description)$/, true],
  ["skills", /^(skills( required)?|required skills|key skills)$/, true],
  ["documentsRequired", /^(documents( required)?|required documents)$/, true],
  ["specialRequirements", /^(special requirements?|instructions|note|notes|important)$/, true]
];
const LABEL_LINE = /^\s*(?:[-*•▪●]\s*)?([A-Za-z][A-Za-z0-9 /&().]{1,40}?)\s*[:：\-–—]\s*(.*)$/;
const pad = n => String(n).padStart(2, "0");

const labelField = label => {
  const key = label.toLowerCase().replace(/\s+/g, " ").trim();
  return LABELS.find(([, re]) => re.test(key)) || null;
};

function toLocalDateTime(text, now, defaultTime = "") {
  const d = findDates(text, now)[0];
  if (!d) return { value: "", assumedTime: false };
  const t = findTime(text);
  return { value: `${d.date}T${t || defaultTime || "00:00"}`, assumedTime: !t };
}

export function smartPastePlacement(raw, now = new Date()) {
  const clean = cleanMessageText(raw);
  const notes = [];
  const out = { company: "", role: "", driveType: "", eligibleBatches: "", eligiblePrograms: "", eligibility: "", salary: "", bond: "", workLocations: "", jobDescription: "", skills: "", selectionProcess: "", contactPerson: "", documentsRequired: "", specialRequirements: "", applicationUrl: "", applicationDeadline: "", driveDate: "", notes };
  if (!clean) return out;

  const lines = clean.split("\n");
  const raws = {}; let current = null; let blanks = 0;
  const preface = [];
  for (const line of lines) {
    const m = line.match(LABEL_LINE);
    const hit = m && labelField(m[1]);
    if (hit) {
      current = { field: hit[0], multi: hit[2], parts: m[2].trim() ? [m[2].trim()] : [], expectsNext: !m[2].trim() };
      (raws[hit[0]] ||= []).push(current); blanks = 0; continue;
    }
    if (!line.trim()) { blanks += 1; if (blanks >= 2) current = null; continue; }
    if (current && (current.multi || current.expectsNext) && (current.multi || current.parts.length === 0)) { current.parts.push(line.trim().replace(/^[-*•▪●]\s*/, "")); blanks = 0; if (!current.multi) current = null; continue; }
    if (!current) preface.push(line.trim());
    blanks = 0;
  }
  const text = field => (raws[field] || []).map(r => r.parts.join(field === "eligibility" || field === "selectionProcess" || field === "documentsRequired" || field === "jobDescription" || field === "specialRequirements" ? "\n" : ", ")).filter(Boolean).join("\n").trim();

  for (const f of ["company", "role", "salary", "workLocations", "eligibleBatches", "eligiblePrograms", "bond", "contactPerson", "eligibility", "selectionProcess", "jobDescription", "skills", "documentsRequired", "specialRequirements"]) out[f] = text(f).slice(0, f === "jobDescription" ? 5000 : 1500);

  // company: label, else the first headline line ("Google is hiring", "Infosys Campus Drive")
  if (!out.company) {
    const head = preface.find(l => l.length > 2);
    const m = head && head.match(/^(.{2,60}?)\s+(?:is hiring|is conducting|is visiting|campus (?:drive|recruitment|placement)|placement drive|recruitment drive|off[- ]campus|hiring|drive)\b/i);
    if (m) { out.company = m[1].replace(/^(?:subject\s*[:\-]\s*)/i, "").trim(); notes.push(`Company guessed as "${out.company}" from the headline. Check the spelling.`); }
    else notes.push("Couldn't find the company name. Type it in.");
  }
  if (!out.role) notes.push("Couldn't find the role. Type it in.");

  const whole = clean.toLowerCase();
  if (/\binterns?(hips?)?\b/.test(whole)) out.driveType = "Internship"; else if (/\b(placement|campus drive|campus recruitment)\b/.test(whole)) out.driveType = "Placement";

  const url = (clean.match(/https?:\/\/[^\s<>"')\]]+/i) || [""])[0].replace(/[.,;:!?]+$/, "");
  out.applicationUrl = text("applicationUrl").match(/https?:\/\/\S+/)?.[0]?.replace(/[.,;:!?]+$/, "") || url;
  if (out.applicationUrl) notes.push("Used the first link as the application link. Check it.");

  // deadline: labelled, else a line that mentions last date / register by / deadline
  let deadlineSource = text("deadlineText");
  if (!deadlineSource) deadlineSource = lines.find(l => /(last date|register by|apply (?:by|before)|deadline|registration closes?)/i.test(l) && findDates(l, now).length) || "";
  if (deadlineSource) {
    const r = toLocalDateTime(deadlineSource, now, "23:59");
    out.applicationDeadline = r.value;
    if (r.value) notes.push(r.assumedTime ? "Deadline has no time in the notice, so I used 11:59 PM. Adjust it." : "Found the application deadline. Check the time.");
  } else notes.push("No application deadline found. Students rely on it, add it if it exists.");
  const driveSource = text("driveDateText");
  if (driveSource) { const r = toLocalDateTime(driveSource, now, "09:00"); out.driveDate = r.value; if (r.value && r.assumedTime) notes.push("Drive date has no time, so I used 9:00 AM."); }

  const salaryOk = /\d/.test(out.salary);
  if (out.salary && !salaryOk) notes.push("The package text has no number. Check it.");
  const filled = ["company", "role", "salary", "workLocations", "eligibility", "selectionProcess"].filter(f => out[f]).length;
  notes.unshift(`Filled ${filled} of 6 key fields from labelled lines (Company, Role, CTC, Location, Eligibility, Selection process).`);
  return out;
}
