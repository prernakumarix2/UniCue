// When to gently remind a student to back up. Their data lives only on their phone.
const DAY = 86400000;
export const FIRST_REMINDER_DAYS = 14, REPEAT_DAYS = 30, SNOOZE_DAYS = 7;

/** hasData: they have courses or deadlines. Times are ms timestamps (0 / null when unknown). */
export function backupDue({ hasData = false, firstSeen = 0, lastBackup = 0, snoozedUntil = 0, now = Date.now() } = {}) {
  if (!hasData) return false;
  if (snoozedUntil && now < snoozedUntil) return false;
  if (lastBackup) return now - lastBackup >= REPEAT_DAYS * DAY;
  return Boolean(firstSeen) && now - firstSeen >= FIRST_REMINDER_DAYS * DAY;
}
