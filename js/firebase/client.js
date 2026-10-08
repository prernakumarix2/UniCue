import { firebaseConfig } from "./config.js";
let appPromise;

export async function getFirebaseApp() {
  if (!firebaseConfig.enabled) throw new Error("Firebase is disabled.");
  if (!appPromise) {
    appPromise = import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js").then(({ initializeApp }) => {
      const { enabled, adminUid, ...firebaseOptions } = firebaseConfig;
      return initializeApp(firebaseOptions);
    });
  }
  return appPromise;
}
