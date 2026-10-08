// Message-overload helpers: clean pasted UMS text and collapse repeated updates about the same topic.

/** Tidy text pasted from UMS/PDF/WhatsApp: invisible characters, tabs, ragged spacing, long blank runs. */
export function cleanMessageText(raw = "") {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .split("\n").map(line => line.replace(/[ ]{2,}/g, " ").replace(/^[\s]*[•▪◦●·]\s*/, "- ").trimEnd()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function previewText(raw = "", max = 140) {
  const flat = cleanMessageText(raw).replace(/\s*\n+\s*/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

// Words that start the "what happened" part of a title: everything before them is the topic (usually a company).
const STOP = new Set(["drive", "drives", "registration", "registrations", "register", "registered", "shortlist", "shortlisted", "shortlisting", "result", "results",
  "recruitment", "hiring", "placement", "placements", "update", "updates", "reminder", "notice", "test", "interview", "interviews", "ppt", "pre", "online",
  "assessment", "oa", "schedule", "rescheduled", "revised", "reopened", "open", "opens", "opened", "last", "final", "selected", "selection", "round", "list", "for", "is", "are", "has", "have", "will"]);

/**
 * { key, label } when the title looks like an update about a named topic ("Google drive: shortlist" -> Google), else null.
 * Heuristic on purpose: only placement-style messages are grouped, so unrelated notices are never merged.
 */
export function topicOf(item) {
  const explicit = String(item?.company || "").trim();
  if (explicit) return { key: explicit.toLowerCase(), label: explicit }; // admin-set company: exact grouping
  const title = String(item?.title || "").trim();
  const placementish = item?.category === "Placement" || /\b(drive|recruit|hiring|campus|shortlist|placement)\b/i.test(title);
  if (!placementish || !title) return null;
  const head = title.split(/\s[-–—|]\s|:/)[0];
  const words = head.split(/\s+/).filter(Boolean);
  const topic = [];
  for (const w of words) {
    if (STOP.has(w.toLowerCase().replace(/[^a-z]/g, ""))) break;
    topic.push(w);
    if (topic.length === 4) break;
  }
  const label = topic.join(" ").replace(/[^\w&.+ -]/g, "").trim();
  if (label.length < 2) return null;
  return { key: label.toLowerCase(), label };
}

/**
 * items must already be sorted (importance, then newest). Critical items are never collapsed.
 * Returns [{ type: "single", item } | { type: "group", key, label, lead, rest }].
 */
export function groupRepeats(items) {
  const byKey = new Map();
  for (const item of items) {
    if (item.importance === "Critical") continue;
    const topic = topicOf(item);
    if (!topic) continue;
    if (!byKey.has(topic.key)) byKey.set(topic.key, { ...topic, members: [] });
    byKey.get(topic.key).members.push(item);
  }
  const grouped = new Set([...byKey.values()].filter(g => g.members.length >= 2).map(g => g.key));
  const out = []; const emitted = new Set();
  for (const item of items) {
    const topic = item.importance === "Critical" ? null : topicOf(item);
    if (topic && grouped.has(topic.key)) {
      if (emitted.has(topic.key)) continue;
      emitted.add(topic.key);
      const g = byKey.get(topic.key);
      out.push({ type: "group", key: g.key, label: g.label, lead: g.members[0], rest: g.members.slice(1) });
    } else out.push({ type: "single", item });
  }
  return out;
}

/** The soonest upcoming important date of a message: { label, date, time, days } or null. Used for the "by when" chip. */
export function nextDateOf(item, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let best = null;
  for (const d of Array.isArray(item?.importantDates) ? item.importantDates : []) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d?.date || "");
    if (!m) continue;
    const days = Math.round((new Date(+m[1], +m[2] - 1, +m[3]).getTime() - today) / 86400000);
    if (days < 0) continue;
    if (!best || days < best.days) best = { label: d.label, date: d.date, time: d.time || "", days };
  }
  return best;
}

/** Latest active message flagged as an emergency banner that the student has not dismissed, or null. */
export function pickBanner(items, dismissedIds = [], now = new Date()) {
  const gone = new Set(dismissedIds);
  const time = i => new Date(i.publishedAt || i.updatedAt || 0).getTime() || 0;
  return (items || [])
    .filter(i => i && i.banner === true && i.status === "published" && !gone.has(i.id)
      && !(i.expiresAt && new Date(i.expiresAt).getTime() < now.getTime()))
    .sort((a, b) => time(b) - time(a))[0] || null;
}

/** Everything about one company: its messages (explicit company or title guess), newest first. */
export function messagesForCompany(items, name, now = new Date()) {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return [];
  const time = i => new Date(i.updatedAt || i.publishedAt || 0).getTime() || 0;
  return (items || [])
    .filter(i => i && i.status === "published" && !(i.expiresAt && new Date(i.expiresAt).getTime() < now.getTime()) && topicOf(i)?.key === key)
    .sort((a, b) => time(b) - time(a));
}
