const KEY = "unicue_read_messages";
const load = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
export const isRead = id => load().has(id);
const notify = () => { try { window.dispatchEvent(new Event("unicue:read")); } catch { /* no window (tests) */ } };
export function markRead(id) { try { const s = load(); s.add(id); localStorage.setItem(KEY, JSON.stringify([...s].slice(-300))); } catch { /* storage unavailable */ } notify(); }
export function markAllRead(ids) { try { const s = load(); ids.forEach(id => s.add(id)); localStorage.setItem(KEY, JSON.stringify([...s].slice(-300))); } catch { /* storage unavailable */ } notify(); }
export const unreadCount = items => { const s = load(); return items.filter(i => !s.has(i.id)).length; };
