import { localStorageRepository } from "./local-storage.js";
import { createId } from "../utils/ids.js";
import { getSemester } from "../domain/semester.js";
import { sanitizeSlots } from "../domain/timetable.js";

// Courses without their own last class day inherit the semester's (set by the admin). Read-time only:
// the stored course is never changed by this, so a later admin change reaches everyone.
const raw = () => localStorageRepository.getAttendance();
const withSemester = c => {
  const out = c.lastDate || !getSemester().lastDate ? c : { ...c, lastDate: getSemester().lastDate };
  return Array.isArray(c.slots) ? { ...out, slots: sanitizeSlots(c.slots) } : out; // a corrupt backup must never break Home
};

export const attendanceRepository = {
  getAll() { return raw().map(withSemester); },
  getById(id) { return this.getAll().find(item => item.id === id) || null; },
  create(input) { const now = new Date().toISOString(); const item = { ...input, id: createId(), createdAt: now, updatedAt: now }; localStorageRepository.saveAttendance([item, ...raw()]); return withSemester(item); },
  update(id, input) {
    const old = raw().find(x => x.id === id); if (!old) return null;
    const item = { ...old, ...input, updatedAt: new Date().toISOString() };
    localStorageRepository.saveAttendance(raw().map(x => (x.id === id ? item : x)));
    return withSemester(item);
  },
  delete(id) { localStorageRepository.saveAttendance(raw().filter(x => x.id !== id)); }
};
