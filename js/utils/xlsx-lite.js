// Minimal .xlsx reader (first worksheet -> rows of text). No library: an .xlsx is a zip of XML files.
// Used only to read the timetable the student exports from UMS. Read-only, size-capped, never throws on bad input.
const MAX_FILE = 5 * 1024 * 1024;
const MAX_ENTRY = 10 * 1024 * 1024;
const MAX_ROWS = 500, MAX_COLS = 50;

const u16 = (v, o) => v.getUint16(o, true);
const u32 = (v, o) => v.getUint32(o, true);

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function zipEntries(buffer) {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i -= 1) if (u32(view, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Not a zip file");
  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n += 1) {
    if (u32(view, p) !== 0x02014b50) throw new Error("Bad zip directory");
    const nameLen = u16(view, p + 28), extraLen = u16(view, p + 30), commentLen = u16(view, p + 32);
    const name = new TextDecoder().decode(new Uint8Array(buffer, p + 46, nameLen));
    entries.set(name, { method: u16(view, p + 10), compSize: u32(view, p + 20), size: u32(view, p + 24), offset: u32(view, p + 42) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readEntry(buffer, entry) {
  if (entry.size > MAX_ENTRY) throw new Error("File inside is too large");
  const view = new DataView(buffer);
  if (u32(view, entry.offset) !== 0x04034b50) throw new Error("Bad zip entry");
  const start = entry.offset + 30 + u16(view, entry.offset + 26) + u16(view, entry.offset + 28);
  const raw = new Uint8Array(buffer, start, entry.compSize);
  const out = entry.method === 0 ? raw : entry.method === 8 ? await inflateRaw(raw) : null;
  if (!out) throw new Error("Unsupported compression");
  return new TextDecoder().decode(out);
}

const decodeXml = s => s
  .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const textOf = xml => [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => decodeXml(m[1])).join("");
const colIndex = letters => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** ArrayBuffer of an .xlsx -> string[][] (first sheet). Throws Error with a plain message on bad files. */
export async function readXlsxRows(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > MAX_FILE) throw new Error("File is too large or unreadable");
  const entries = zipEntries(buffer);
  const sheetName = [...entries.keys()].filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))[0];
  if (!sheetName) throw new Error("No worksheet found");
  const shared = entries.has("xl/sharedStrings.xml")
    ? [...(await readEntry(buffer, entries.get("xl/sharedStrings.xml"))).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1]))
    : [];
  const xml = await readEntry(buffer, entries.get(sheetName));
  const rows = [];
  for (const cell of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = /\br="([A-Z]+)(\d+)"/.exec(cell[1]);
    if (!ref || !cell[2]) continue;
    const r = Number(ref[2]) - 1, c = colIndex(ref[1]);
    if (r >= MAX_ROWS || c >= MAX_COLS) continue;
    const type = (/\bt="(\w+)"/.exec(cell[1]) || [])[1];
    let value = "";
    if (type === "inlineStr") value = textOf(cell[2]);
    else { const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cell[2]); value = v ? (type === "s" ? shared[Number(v[1])] ?? "" : decodeXml(v[1])) : ""; }
    (rows[r] ||= [])[c] = value;
  }
  return Array.from(rows, row => Array.from(row || [], v => v ?? ""));
}
