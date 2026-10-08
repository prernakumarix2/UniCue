// "Add to Home Screen" logic. Pure decision function + tiny storage helpers.
const DISMISS_DAYS = 14;
const IN_APP = /(FBAN|FBAV|Instagram|Snapchat|Line\/)/i;

/**
 * "none" | "prompt" (Android/desktop Chrome can install in one tap) | "ios" (Share > Add to Home Screen)
 * | "ios-safari" (iPhone in-app browser: open in Safari first).
 * Shown from the 2nd visit, never when already installed, and not again for 14 days after dismissal.
 */
export function installMode({ standalone = false, userAgent = "", hasPrompt = false, visits = 0, dismissedAt = 0, now = Date.now() } = {}) {
  if (standalone) return "none";
  if (dismissedAt && now - dismissedAt < DISMISS_DAYS * 86400000) return "none";
  if (visits < 2) return "none";
  if (hasPrompt) return "prompt";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return IN_APP.test(userAgent) ? "ios-safari" : "ios";
  return "none";
}

const KEY_VISITS = "unicue_visits", KEY_DISMISS = "unicue_install_dismissed";
const read = key => { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } };
const write = (key, value) => { try { localStorage.setItem(key, String(value)); } catch { /* private mode: banner just shows again */ } };

export const bumpVisits = () => { const n = read(KEY_VISITS) + 1; write(KEY_VISITS, n); return n; };
export const getVisits = () => read(KEY_VISITS);
export const getDismissedAt = () => read(KEY_DISMISS);
export const dismissInstall = () => write(KEY_DISMISS, Date.now());
export const isStandalone = () => Boolean(window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone);
