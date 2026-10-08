import { firebaseConfig } from "../firebase/config.js";
import { getFirestoreClient, saveSemesterDoc } from "../firebase/firestore.js";
import { invalidateContentCache } from "./content-sync.js";
import { applySemester } from "../domain/semester.js";

export const semesterRepository = {
  /** Admin only. value: { lastDate, holidays: [{date,name}] } */
  async save(value) {
    if (!firebaseConfig.enabled) throw new Error("Firebase is not configured yet.");
    const db = await getFirestoreClient();
    await saveSemesterDoc(db, value);
    invalidateContentCache();
    applySemester(value); // the admin's own phone updates immediately
  }
};
