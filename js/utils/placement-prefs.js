// Private, on-device placement data: the student's CGPA/backlogs and their saved drives. Never sent anywhere.
import { localStorageRepository } from "../repositories/local-storage.js";

const prefs = () => localStorageRepository.getPreferences();
const save = patch => localStorageRepository.savePreferences({ ...prefs(), ...patch });

export const getProfile = () => ({ cgpa: "", backlogs: "", ...(prefs().placementProfile || {}) });
export const saveProfile = profile => save({ placementProfile: { cgpa: profile.cgpa ?? "", backlogs: profile.backlogs ?? "" } });
export const savedDriveIds = () => (Array.isArray(prefs().savedDrives) ? prefs().savedDrives : []);
export const isSavedDrive = id => savedDriveIds().includes(id);
export function toggleSavedDrive(id) {
  const ids = savedDriveIds();
  const next = ids.includes(id) ? ids.filter(x => x !== id) : [id, ...ids].slice(0, 100);
  save({ savedDrives: next });
  return next.includes(id);
}
