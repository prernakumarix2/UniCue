// Student sign-in for UniCue: a DEMO. Accounts live only in this browser's storage and nothing is sent anywhere.
// It exists so the app feels like a real product (log in, sign up, log out). It is NOT real security:
// anyone with access to the phone's browser storage can read it. Never reuse a real password here.
const ACCOUNTS_KEY = "unicue_students";
const SESSION_KEY = "unicue_session";
const NEXT_KEY = "unicue_next";
const AUTH_ROUTE = /^#\/(login|signup|forgot)\b/;

export class AuthError extends Error {
  constructor(message, field = "") { super(message); this.name = "AuthError"; this.field = field; }
}

const local = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const session = () => { try { return globalThis.sessionStorage || null; } catch { return null; } };
const readJson = (store, key, fallback) => { try { const v = JSON.parse(store?.getItem(key) ?? "null"); return v ?? fallback; } catch { return fallback; } };

export const normalizeEmail = value => String(value || "").trim().toLowerCase();
export const validateEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(value)) && normalizeEmail(value).length <= 120;
export const validateName = value => { const n = String(value || "").trim(); return n.length >= 2 && n.length <= 60 && /\p{L}/u.test(n); };
export const cleanName = value => String(value || "").trim().replace(/\s+/g, " ");
export const firstName = value => cleanName(typeof value === "string" ? value : value?.name).split(" ")[0] || "";
export const initials = value => cleanName(typeof value === "string" ? value : value?.name).split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "U";

/** 0 = empty, 1 = too short / weak, 2 = okay, 3 = good, 4 = strong. `ok` means the password may be used. */
export function passwordStrength(password) {
  const pw = String(password || "");
  if (!pw) return { score: 0, label: "", ok: false };
  const ok = pw.length >= 8;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  score = Math.min(4, score);
  if (!ok) return { score: 1, label: "Too short", ok };
  score = Math.max(2, score);
  return { score, label: ["", "", "Okay", "Good", "Strong"][score], ok };
}

function fallbackHash(text) {            // used only where SubtleCrypto is unavailable (plain http, old webviews)
  let a = 0x811c9dc5, b = 0x01000193;
  for (let round = 0; round < 3; round += 1) for (let i = 0; i < text.length; i += 1) { a = Math.imul(a ^ text.charCodeAt(i), 16777619) >>> 0; b = (Math.imul(b + a, 2246822519) ^ (a >>> 13)) >>> 0; }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
async function hashPassword(password, salt) {
  const text = `${salt}:${password}`;
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const bytes = await subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, "0")).join("");
    }
  } catch { /* fall through */ }
  return fallbackHash(text);
}
const newSalt = () => { try { return [...globalThis.crypto.getRandomValues(new Uint8Array(8))].map(n => n.toString(16).padStart(2, "0")).join(""); } catch { return Math.random().toString(16).slice(2, 12); } };

const loadAccounts = () => { const v = readJson(local(), ACCOUNTS_KEY, {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; };
function saveAccounts(accounts) {
  try { local().setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); }
  catch { throw new AuthError("This browser won't let UniCue save your account. Turn off private browsing and try again."); }
}

function writeSession(user, remember) {
  const value = JSON.stringify({ name: user.name, email: user.email, at: Date.now() });
  try { local()?.removeItem(SESSION_KEY); session()?.removeItem(SESSION_KEY); } catch { /* ignore */ }
  try { (remember ? local() : session()).setItem(SESSION_KEY, value); }
  catch { throw new AuthError("This browser won't let UniCue keep you signed in. Turn off private browsing and try again."); }
}

export function getSession() {
  const s = readJson(session(), SESSION_KEY, null) || readJson(local(), SESSION_KEY, null);
  return s && typeof s.name === "string" && typeof s.email === "string" ? { name: cleanName(s.name), email: s.email } : null;
}
export const isLoggedIn = () => Boolean(getSession());
export function logOut() { try { local()?.removeItem(SESSION_KEY); session()?.removeItem(SESSION_KEY); } catch { /* ignore */ } }

function checkPasswordPair(password, confirm) {
  if (!passwordStrength(password).ok) throw new AuthError("Use at least 8 characters.", "password");
  if (password !== confirm) throw new AuthError("The two passwords don't match.", "confirm");
}

export async function signUp({ name, email, password, confirm }) {
  if (!validateName(name)) throw new AuthError("Enter your name (at least 2 letters).", "name");
  if (!validateEmail(email)) throw new AuthError("Enter a valid email, like you@example.com.", "email");
  checkPasswordPair(password, confirm);
  const accounts = loadAccounts();
  const key = normalizeEmail(email);
  if (accounts[key]) throw new AuthError("This email already has an account on this phone. Log in instead.", "email");
  const salt = newSalt();
  accounts[key] = { name: cleanName(name), salt, hash: await hashPassword(password, salt), created: Date.now() };
  saveAccounts(accounts);
  const user = { name: accounts[key].name, email: key };
  writeSession(user, true);
  return user;
}

export async function logIn({ email, password, remember = true }) {
  if (!validateEmail(email)) throw new AuthError("Enter a valid email, like you@example.com.", "email");
  if (!password) throw new AuthError("Enter your password.", "password");
  const key = normalizeEmail(email);
  const account = loadAccounts()[key];
  if (!account) throw new AuthError("No account with this email on this phone yet. Sign up to create one.", "email");
  if (await hashPassword(password, account.salt) !== account.hash) throw new AuthError("That password doesn't match. Try again or reset it.", "password");
  const user = { name: account.name, email: key };
  writeSession(user, Boolean(remember));
  return user;
}

export async function resetPassword({ email, password, confirm }) {
  if (!validateEmail(email)) throw new AuthError("Enter a valid email, like you@example.com.", "email");
  const accounts = loadAccounts();
  const key = normalizeEmail(email);
  if (!accounts[key]) throw new AuthError("No account with this email on this phone.", "email");
  checkPasswordPair(password, confirm);
  const salt = newSalt();
  accounts[key] = { ...accounts[key], salt, hash: await hashPassword(password, salt) };
  saveAccounts(accounts);
  const user = { name: accounts[key].name, email: key };
  writeSession(user, true);
  return user;
}

/** Remember where a signed-out visitor was heading (for example a shared link) and send them there after login. */
export function rememberNext(hash) {
  const h = String(hash || "");
  if (!/^#\/\S+/.test(h) || AUTH_ROUTE.test(h) || h.length > 4000) return;
  try { session()?.setItem(NEXT_KEY, h); } catch { /* ignore */ }
}
export function takeNext() {
  let h = "";
  try { h = session()?.getItem(NEXT_KEY) || ""; session()?.removeItem(NEXT_KEY); } catch { /* ignore */ }
  return /^#\/\S*/.test(h) && !AUTH_ROUTE.test(h) ? h : "";
}
