// Placement helpers: selection-process steps, eligibility rules, and the student's PRIVATE eligibility check.
// The check only looks at CGPA and backlogs. It never replaces the official LPU/UMS eligibility.

/** "Online test -> Technical interview -> HR" or numbered/bulleted lines -> [{ title, detail }]. */
export function parseSteps(text) {
  const raw = String(text ?? "").replace(/\r/g, "").trim();
  if (!raw) return [];
  let parts = raw.split("\n").map(l => l.trim()).filter(Boolean);
  if (parts.length === 1) {
    const arrow = parts[0].split(/\s*(?:->|=>|→|»|>)\s*/);
    parts = arrow.length > 1 ? arrow : parts[0].split(/\s*;\s*/);
  }
  return parts.map(line => {
    const clean = line.replace(/^(?:round|step|stage)\s*\d+\s*[:.)-]?\s*/i, "").replace(/^(?:[-*•▪●]|\d+[.)])\s*/, "").trim();
    const m = clean.match(/^(.{2,60}?)\s*[:\-–—]\s+(.+)$/);
    return m ? { title: m[1].trim(), detail: m[2].trim() } : { title: clean, detail: "" };
  }).filter(step => step.title).slice(0, 10);
}

/** Reads "min 6.5 CGPA", "60% in 10th", "no active backlogs" out of free text. Missing rules stay null. */
export function parseEligibilityRules(text) {
  const t = String(text ?? "").toLowerCase();
  const rules = { minCgpa: null, maxBacklogs: null };
  const cgpa = t.match(/(?:cgpa|cpi|gpa)\D{0,25}?(\d{1,2}(?:\.\d{1,2})?)(?!\s*%)/) || t.match(/(\d{1,2}(?:\.\d{1,2})?)\s*(?:\+|and above|or above|or more)?\s*(?:cgpa|cpi|gpa)/);
  if (cgpa) { const v = parseFloat(cgpa[1]); if (v > 0 && v <= 10) rules.minCgpa = v; }
  if (/\b(no|nil|zero|without)\s+(?:current\s+|active\s+|pending\s+|standing\s+)*backlogs?\b/.test(t) || /\bbacklogs?\s*[:=-]?\s*(?:nil|none|0)\b/.test(t)) rules.maxBacklogs = 0;
  else { const b = t.match(/(?:up to|upto|max(?:imum)?|not more than|at most)\s*(\d+)\s*(?:active\s+|current\s+)?backlogs?/); if (b) rules.maxBacklogs = parseInt(b[1], 10); }
  return rules;
}

/**
 * profile: { cgpa, backlogs } (numbers or empty). Returns { status: "ok" | "warn" | "unknown", reasons: [] }.
 * unknown = no rule we can check, or the student has not filled in their details.
 */
export function checkEligibility(rules, profile) {
  const hasRule = rules && (rules.minCgpa !== null || rules.maxBacklogs !== null);
  if (!hasRule) return { status: "unknown", reasons: ["No CGPA or backlog rule found in the eligibility text. Read it carefully."] };
  const cgpa = profile?.cgpa === "" || profile?.cgpa == null ? null : Number(profile.cgpa);
  const backlogs = profile?.backlogs === "" || profile?.backlogs == null ? null : Number(profile.backlogs);
  const reasons = []; let warn = false; let missing = false;
  if (rules.minCgpa !== null) {
    if (cgpa === null || Number.isNaN(cgpa)) missing = true;
    else if (cgpa < rules.minCgpa) { warn = true; reasons.push(`Needs CGPA ${rules.minCgpa}+. Yours is ${cgpa}.`); }
    else reasons.push(`CGPA ${cgpa} meets ${rules.minCgpa}+.`);
  }
  if (rules.maxBacklogs !== null) {
    if (backlogs === null || Number.isNaN(backlogs)) missing = true;
    else if (backlogs > rules.maxBacklogs) { warn = true; reasons.push(`Allows ${rules.maxBacklogs === 0 ? "no" : `up to ${rules.maxBacklogs}`} backlogs. You entered ${backlogs}.`); }
    else reasons.push(`Backlogs (${backlogs}) are within the limit.`);
  }
  if (warn) return { status: "warn", reasons };
  if (missing) return { status: "unknown", reasons: ["Add your CGPA and backlogs to check this drive.", ...reasons] };
  return { status: "ok", reasons };
}

/** Drives closing within `hours` that are still open. Soonest first. */
export function closingWithin(items, hours = 48, now = new Date()) {
  return (items || []).map(item => ({ item, t: new Date(item.applicationDeadline).getTime() }))
    .filter(({ item, t }) => item.status !== "closed" && Number.isFinite(t) && t > now.getTime() && t - now.getTime() <= hours * 3600000)
    .sort((a, b) => a.t - b.t).map(x => x.item);
}

/** "Closes in 5 h", "Closes tomorrow, 5:00 PM" style text. Returns { text, tone } or null. */
export function closesIn(deadline, now = new Date()) {
  const t = new Date(deadline).getTime();
  if (!Number.isFinite(t)) return null;
  const ms = t - now.getTime();
  if (ms <= 0) return { text: "Registration closed", tone: "closed" };
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return { text: `Closes in ${Math.max(1, Math.round(ms / 60000))} min`, tone: "soon" };
  if (hours < 24) return { text: `Closes in ${hours} h`, tone: "soon" };
  const days = Math.floor(hours / 24);
  return { text: `Closes in ${days} day${days === 1 ? "" : "s"}`, tone: days <= 2 ? "soon" : "open" };
}
