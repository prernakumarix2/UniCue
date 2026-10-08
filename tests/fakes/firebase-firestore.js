// In-memory Firestore that mirrors firestore.rules:
//  information: read if admin || status in [published, expired]; write if admin && status in [draft, published, expired]
//  placements : read if admin || status in [published, closed];  write if admin && status in [draft, published, closed]
// Like real Firestore, a non-admin LIST query is only allowed if its where() constraints
// guarantee every possible result is readable.
import { state } from "./state.js";

const READABLE = { information: ["published", "expired"], placements: ["published", "closed"], meta: null };
const WRITABLE = { information: ["draft", "published", "expired"], placements: ["draft", "published", "closed"], meta: null };
const canRead = (name, data) => READABLE[name] === null || (data && READABLE[name].includes(data.status));
const canWrite = (name, data) => WRITABLE[name] === null || WRITABLE[name].includes(data.status);
const isAdmin = () => state.user?.uid === state.adminUid;
const denied = () => Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });

class Timestamp { constructor(date) { this.date = date; } toDate() { return this.date; } }
const resolveTimestamps = value => {
  if (value && value.__serverTimestamp) return new Timestamp(new Date());
  if (Array.isArray(value)) return value.map(resolveTimestamps);
  if (value && typeof value === "object" && !(value instanceof Timestamp)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveTimestamps(v)]));
  return value;
};
// Deep copy that keeps Timestamp instances intact (real Firestore returns Timestamp objects).
const clone = value => {
  if (value instanceof Timestamp) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
  return value;
};

export const getFirestore = () => ({ fake: true });
export const serverTimestamp = () => ({ __serverTimestamp: true });
export const collection = (db, name) => ({ type: "collection", name });
export const doc = (db, name, id) => ({ type: "doc", name, id });
export const where = (field, op, value) => ({ field, op, value });
export const query = (ref, ...constraints) => ({ type: "query", ref, constraints });

export async function getDocs(target) {
  const ref = target.type === "query" ? target.ref : target;
  const constraints = target.type === "query" ? target.constraints : [];
  if (!isAdmin()) {
    const statusConstraint = constraints.find(c => c.field === "status");
    const allowed = statusConstraint && (statusConstraint.op === "==" ? [statusConstraint.value] : statusConstraint.op === "in" ? statusConstraint.value : null);
    if (READABLE[ref.name] !== null && (!allowed || !allowed.every(v => READABLE[ref.name].includes(v)))) throw denied();
  }
  const docs = [...state.docs[ref.name].entries()]
    .filter(([, data]) => constraints.every(c => c.op === "==" ? data[c.field] === c.value : c.value.includes(data[c.field])))
    .map(([id, data]) => ({ id, data: () => clone(data) }));
  state.reads += docs.length;
  return { docs };
}
export async function getDoc(ref) {
  const data = state.docs[ref.name].get(ref.id);
  if (!isAdmin() && READABLE[ref.name] !== null && (!data || !canRead(ref.name, data))) throw denied();
  state.reads += 1;
  return { exists: () => Boolean(data), id: ref.id, data: () => clone(data) };
}
export async function addDoc(ref, data) {
  if (!isAdmin() || !canWrite(ref.name, data)) throw denied();
  const id = `${ref.name}-${++state.counter}`;
  state.docs[ref.name].set(id, resolveTimestamps(clone(data)));
  return { id };
}
export async function updateDoc(ref, patch) {
  const existing = state.docs[ref.name].get(ref.id);
  if (!existing) throw Object.assign(new Error("No document to update"), { code: "not-found" });
  const merged = { ...existing, ...resolveTimestamps(clone(patch)) };
  if (!isAdmin() || !canWrite(ref.name, merged)) throw denied();
  state.docs[ref.name].set(ref.id, merged);
}
export async function deleteDoc(ref) {
  if (!isAdmin()) throw denied();
  state.docs[ref.name].delete(ref.id);
}
export async function setDoc(ref, data, options = {}) {
  if (!isAdmin()) throw denied();
  const existing = state.docs[ref.name].get(ref.id);
  const next = resolveTimestamps(clone(data));
  state.docs[ref.name].set(ref.id, options.merge && existing ? { ...existing, ...next } : next);
}
