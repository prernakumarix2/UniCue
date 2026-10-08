import { firebaseConfig } from "../firebase/config.js";
import { getAuthClient, signInAdmin, signOutAdmin } from "../firebase/auth.js";

export function assertFirebaseConfigured() {
  if (!firebaseConfig.enabled || !firebaseConfig.adminUid) {
    throw new Error("Firebase and the admin UID must be configured before admin access is enabled.");
  }
}

export async function adminLogin(email, password) {
  assertFirebaseConfigured();
  const credential = await signInAdmin(email, password);
  if (credential.user.uid !== firebaseConfig.adminUid) {
    await signOutAdmin();
    throw new Error("This account is not authorized as the UniCue administrator.");
  }
  return credential;
}

export async function adminLogout() {
  return signOutAdmin();
}

export async function getCurrentAdmin() {
  if (!firebaseConfig.enabled || !firebaseConfig.adminUid) return null;

  try {
    const auth = await getAuthClient();
    return await new Promise(resolve => {
      let settled = false;
      let unsubscribe = () => {};
      const finish = user => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(user?.uid === firebaseConfig.adminUid ? user : null);
      };

      unsubscribe = auth.onAuthStateChanged(finish);
      window.setTimeout(() => finish(null), 8000);
    });
  } catch {
    return null;
  }
}
