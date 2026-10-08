import { getFirebaseApp } from "./client.js";

const SDK_URL = "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
const REQUEST_TIMEOUT_MS = 12000;

let sdkPromise;
let dbPromise;

function sdk() {
  if (!sdkPromise) sdkPromise = import(SDK_URL).catch(error => { sdkPromise = undefined; throw error; });
  return sdkPromise;
}

export async function getFirestoreClient() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const app = await getFirebaseApp();
      const { getFirestore } = await sdk();
      return getFirestore(app);
    })().catch(error => { dbPromise = undefined; throw error; });
  }
  return dbPromise;
}

// Firestore returns Timestamp objects for serverTimestamp() fields. The rest of
// the app works with ISO strings, so convert everything to plain data here.
export function toPlain(value) {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlain(item)]));
  }
  return value;
}

// Firestore rejects `undefined`; strip it so one empty field can't fail a save.
function clean(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

export function friendlyFirestoreError(error) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) return new Error("You don't have permission to view or change this content.");
  if (code.includes("unavailable") || code.includes("network") || error?.message === "timeout") {
    return new Error("Can't reach the server. Check your internet connection and try again.");
  }
  if (code.includes("unauthenticated")) return new Error("Your admin session has expired. Sign in again.");
  return error instanceof Error ? error : new Error("Something went wrong.");
}

async function guarded(promise) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), REQUEST_TIMEOUT_MS); });
  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    throw friendlyFirestoreError(error);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * statuses: when provided, only documents whose `status` is one of these are
 * requested (this must match what the security rules allow students to read).
 */
export async function collectionDocs(db, collectionName, { statuses = null } = {}) {
  return guarded((async () => {
    const { collection, getDocs, query, where } = await sdk();
    const ref = collection(db, collectionName);
    const q = !statuses ? ref
      : statuses.length === 1 ? query(ref, where("status", "==", statuses[0]))
      : query(ref, where("status", "in", statuses));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...toPlain(doc.data()) }));
  })());
}

export async function getDocument(db, collectionName, id) {
  return guarded((async () => {
    const { doc, getDoc } = await sdk();
    const snapshot = await getDoc(doc(db, collectionName, id));
    return snapshot.exists() ? { id: snapshot.id, ...toPlain(snapshot.data()) } : null;
  })());
}

export async function createDocument(db, collectionName, data) {
  return guarded((async () => {
    const { addDoc, collection, serverTimestamp } = await sdk();
    const now = serverTimestamp();
    const ref = await addDoc(collection(db, collectionName), clean({ ...data, createdAt: now, updatedAt: now }));
    return { id: ref.id, ...data };
  })());
}

export async function updateDocument(db, collectionName, id, data) {
  return guarded((async () => {
    const { doc, serverTimestamp, updateDoc } = await sdk();
    await updateDoc(doc(db, collectionName, id), clean({ ...data, updatedAt: serverTimestamp() }));
    return { id, ...data };
  })());
}

export async function deleteDocument(db, collectionName, id) {
  return guarded((async () => {
    const { deleteDoc, doc } = await sdk();
    await deleteDoc(doc(db, collectionName, id));
  })());
}

// ---- Content version (read-saving sync) ----------------------------------
// One tiny doc students read instead of re-downloading whole collections.
// Lets the app read extra settings (semester) from the SAME document, so they cost no extra reads.
let metaListener = null;
export function onContentMeta(fn) { metaListener = fn; }

export async function readContentVersion(db) {
  return guarded((async () => {
    const { doc, getDoc } = await sdk();
    const snapshot = await getDoc(doc(db, "meta", "content"));
    if (snapshot.exists()) { try { metaListener?.(snapshot.data()); } catch { /* settings must never break the version check */ } }
    return snapshot.exists() ? (snapshot.data().version ?? null) : null;
  })());
}

// Admin only. Called after every create/update/delete of a message or placement.
export async function bumpContentVersion(db) {
  return guarded((async () => {
    const { doc, setDoc, serverTimestamp } = await sdk();
    const version = Date.now();
    await setDoc(doc(db, "meta", "content"), { version, updatedAt: serverTimestamp() }, { merge: true });
    return version;
  })());
}

// Admin only. Saves the semester settings and bumps the version in one write.
export async function saveSemesterDoc(db, semester) {
  return guarded((async () => {
    const { doc, setDoc, serverTimestamp } = await sdk();
    await setDoc(doc(db, "meta", "content"), { version: Date.now(), updatedAt: serverTimestamp(), semester: { ...semester, updated: new Date().toISOString() } }, { merge: true });
  })());
}
