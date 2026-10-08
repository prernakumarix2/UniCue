// Firebase Web SDK configuration is client-side configuration, not a secret.
// Never put a service-account private key or admin password here.
// Set enabled=true only after the Firebase project, Auth, Firestore, and Storage
// have been created and the matching values below are available.
export const firebaseConfig = {
  enabled: true,
  apiKey: "AIzaSyC_NHHz9RVywwNQcCFWUqxKi3vwaaRfjzw",
  authDomain: "unicue-x.firebaseapp.com",
  projectId: "unicue-x",
  storageBucket: "unicue-x.firebasestorage.app",
  messagingSenderId: "237314158463",
  appId: "1:237314158463:web:67538ddc5c01e62777b44a",
  adminUid: "xrZS4IcV9FNglMXn5ret53skmwD2"
};

export function getFirebaseConfigStatus() {
  const required = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
  const missing = required.filter(key => !String(firebaseConfig[key] || "").trim());
  if (!firebaseConfig.enabled) return { enabled: false, ready: false, missing };
  if (missing.length || !String(firebaseConfig.adminUid || "").trim()) {
    return { enabled: true, ready: false, missing: [...missing, ...(firebaseConfig.adminUid ? [] : ["adminUid"])] };
  }
  return { enabled: true, ready: true, missing: [] };
}
