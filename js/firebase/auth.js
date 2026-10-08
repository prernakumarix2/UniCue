import { getFirebaseApp } from "./client.js";
let authPromise;

export async function getAuthClient() {
  const app = await getFirebaseApp();
  if (!authPromise) authPromise = import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js").then(({ getAuth }) => getAuth(app));
  return authPromise;
}

export async function signInAdmin(email, password) {
  const auth = await getAuthClient();
  const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js");
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutAdmin() {
  const auth = await getAuthClient();
  const { signOut } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js");
  return signOut(auth);
}
