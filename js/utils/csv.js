// CSV / TSV text -> string[][]. Handles quotes, embedded newlines, BOM. The delimiter is detected (tab for pasted tables).
export function parseDelimited(text) {
  const src = String(text ?? "").replace(/^\uFEFF/, "");
  const head = src.slice(0, 2000);
  const count = ch => head.split(ch).length - 1;
  const delim = count("\t") > 0 && count("\t") >= count(",") ? "\t" : count(";") > count(",") ? ";" : ",";
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false; } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i += 1; row.push(cell); cell = ""; rows.push(row); row = []; }
    else cell += ch;
    if (rows.length > 500) break;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}
