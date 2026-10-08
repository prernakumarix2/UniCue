import { localStorageRepository } from "./local-storage.js";
import { createId } from "../utils/ids.js";

function normalize(input, existing = {}) {
  const now = new Date().toISOString();
  return { ...existing, ...input, id: existing.id || createId(), completed: Boolean(input.completed ?? existing.completed ?? false), createdAt: existing.createdAt || now, updatedAt: now };
}
export const deadlineRepository = {
  getAll() { return localStorageRepository.getDeadlines(); },
  getById(id) { return this.getAll().find(x => x.id === id) || null; },
  create(input) { const item=normalize(input); localStorageRepository.saveDeadlines([item, ...this.getAll()]); return item; },
  update(id,input) { const old=this.getById(id); if(!old) return null; const item=normalize(input,old); localStorageRepository.saveDeadlines(this.getAll().map(x=>x.id===id?item:x)); return item; },
  delete(id) { localStorageRepository.saveDeadlines(this.getAll().filter(x=>x.id!==id)); },
  toggleComplete(id) { const old=this.getById(id); return old ? this.update(id,{completed:!old.completed}) : null; }
};
