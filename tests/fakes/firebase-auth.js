import { state } from "./state.js";
export const getAuth = () => ({ onAuthStateChanged(callback) { queueMicrotask(() => callback(state.user)); return () => {}; } });
export async function signInWithEmailAndPassword(auth, email, password) {
  const account = state.accounts[email];
  if (!account || account.password !== password) throw Object.assign(new Error("Firebase: Error (auth/invalid-credential)."), { code: "auth/invalid-credential" });
  state.user = { uid: account.uid, email };
  return { user: state.user };
}
export async function signOut() { state.user = null; }
