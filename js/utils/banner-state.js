// Which emergency banners this student has dismissed (on this phone only).
const KEY = "unicue_dismissed_banners";
export function dismissedBanners() { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
export function dismissBanner(id) { try { localStorage.setItem(KEY, JSON.stringify([id, ...dismissedBanners().filter(x => x !== id)].slice(0, 30))); } catch { /* ignore */ } }
