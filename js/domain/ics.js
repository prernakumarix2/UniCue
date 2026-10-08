// Calendar export (.ics, RFC 5545) for deadlines. Floating local times, 1-day-before reminder.
const pad = n => String(n).padStart(2, "0");
const esc = text => String(text ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const dateOnly = s => s.replaceAll("-", "");

function fold(line) {
  const parts = []; let rest = line;
  while (rest.length > 74) { parts.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  parts.push(rest);
  return parts;
}

export function buildIcs(deadlines, now = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UniCue//Deadlines//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:UniCue deadlines"];
  for (const d of deadlines) {
    if (!d?.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) continue;
    const summary = `${d.type ? `[${d.type}] ` : ""}${d.title}`;
    const desc = [d.courseName, d.notes].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:${d.id}@unicue`, `DTSTAMP:${stamp(now)}`);
    if (d.dueTime && /^\d{2}:\d{2}$/.test(d.dueTime)) {
      const start = new Date(`${d.dueDate}T${d.dueTime}`);
      const end = new Date(start.getTime() + 30 * 60000);
      const local = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
      lines.push(`DTSTART:${local(start)}`, `DTEND:${local(end)}`);
    } else {
      const next = new Date(`${d.dueDate}T00:00:00`); next.setDate(next.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(d.dueDate)}`, `DTEND;VALUE=DATE:${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`);
    }
    lines.push(`SUMMARY:${esc(summary)}`);
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Due tomorrow: ${d.title}`)}`, "TRIGGER:-P1D", "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.flatMap(fold).join("\r\n") + "\r\n";
}
