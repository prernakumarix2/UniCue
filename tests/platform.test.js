import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { toPlain, friendlyFirestoreError } from "../js/firebase/firestore.js";
import { escapeHtml, safeUrl } from "../js/utils/escape.js";

const root = path.resolve(import.meta.dirname, "..");
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.name === "node_modules" || e.name === "tests" || e.name.startsWith(".") ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

test("Firestore Timestamps become ISO strings (nested too)", () => {
  const ts = { toDate: () => new Date("2026-10-04T10:00:00Z") };
  assert.deepEqual(toPlain({ updatedAt: ts, a: [ts], n: { x: ts }, s: "keep", z: null }),
    { updatedAt: "2026-10-04T10:00:00.000Z", a: ["2026-10-04T10:00:00.000Z"], n: { x: "2026-10-04T10:00:00.000Z" }, s: "keep", z: null });
});
test("Firestore errors become readable", () => {
  assert.match(friendlyFirestoreError({ code: "permission-denied" }).message, /permission/i);
  assert.match(friendlyFirestoreError({ code: "unavailable" }).message, /connection/i);
});
test("every relative import resolves to a real file", () => {
  const missing = [];
  for (const file of walk(root).filter(f => f.endsWith(".js"))) {
    const src = fs.readFileSync(file, "utf8");
    for (const [, spec] of src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      if (!fs.existsSync(path.resolve(path.dirname(file), spec))) missing.push(`${path.relative(root, file)} -> ${spec}`);
    }
  }
  assert.deepEqual(missing, []);
});
test("every service worker precache asset exists", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const assets = [...sw.matchAll(/"(\.\/[^"]*)"/g)].map(m => m[1]);
  assert.ok(assets.length > 30);
  assert.deepEqual(assets.filter(a => !fs.existsSync(path.join(root, a))), []);
});
test("manifest is valid and every icon file exists", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.ok(manifest.icons.length >= 2);
  for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)), icon.src);
});
test("Firestore rules: real admin UID, no placeholder, students cannot write", () => {
  const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
  const config = fs.readFileSync(path.join(root, "js/firebase/config.js"), "utf8");
  const uid = /adminUid:\s*"([^"]+)"/.exec(config)[1];
  assert.equal(uid, "xrZS4IcV9FNglMXn5ret53skmwD2");
  assert.ok(rules.includes(`request.auth.uid == "${uid}"`));
  assert.equal(rules.includes("ADMIN_UID_HERE"), false);
  // every write rule is gated by isAdmin()
  const writes = [...rules.matchAll(/allow (create, update|delete|write)[^;]*;/g)].map(m => m[0]);
  assert.ok(writes.length >= 4);
  for (const w of writes) assert.match(w, /isAdmin\(\)/);
  assert.equal(/allow (write|create|update|delete)\s*:\s*if\s+true/.test(rules), false);
});
test("no passwords or private keys in source", () => {
  const bad = walk(root).filter(f => /\.(js|json|html|md)$/.test(f)).filter(f => /private_key|BEGIN PRIVATE|password\s*[:=]\s*["'][^"']+["']/i.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(bad.map(f => path.relative(root, f)), []);
});
test("escaping and URL safety", () => {
  assert.equal(escapeHtml(`<img src=x onerror="a">`), "&lt;img src=x onerror=&quot;a&quot;&gt;");
  assert.equal(safeUrl("javascript:alert(1)", ), "");
});

test("mobile: safe-area insets handled for header and bottom nav", () => {
  const css = fs.readFileSync(path.join(root, "css/app.css"), "utf8");
  assert.match(css, /\.topbar \{[^}]*safe-area-inset-top/);
  assert.match(css, /\.app-shell \{[^}]*safe-area-inset-bottom/);
  assert.match(css, /:focus-visible/);
  assert.match(fs.readFileSync(path.join(root, "index.html"), "utf8"), /viewport-fit=cover/);
});
test("deploy workflow runs tests before deploying and ships only app files", () => {
  const wf = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
  assert.match(wf, /npm test/);
  assert.match(wf, /needs: test/);
  const copied = /cp -r ([^\n]+) _site\//.exec(wf)[1].split(/\s+/);
  for (const entry of copied) assert.ok(fs.existsSync(path.join(root, entry)), `workflow copies missing ${entry}`);
  for (const forbidden of ["tests", "node_modules", "firestore.rules"]) assert.equal(copied.includes(forbidden), false);
});
