let shared = [];

export function setHolidays(list) {
  shared = (Array.isArray(list) ? list : []).filter(h => h && /^\d{4}-\d{2}-\d{2}$/.test(h.date));
}
export const getHolidays = () => shared;
export const holidayDates = () => shared.map(h => h.date);

// Loaded once at startup. If it fails (offline, first visit), the planner just uses the course's own holidays.
export async function loadHolidays(fetcher = fetch) {
  try {
    const res = await fetcher("./data/holidays.json", { cache: "no-cache" });
    if (!res.ok) return;
    setHolidays((await res.json()).holidays);
  } catch { /* keep whatever was loaded before */ }
}
