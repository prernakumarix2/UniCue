// Tiny on-device timestamps for the backup reminder.
const K = { first: "unicue_first_seen", last: "unicue_last_backup", snooze: "unicue_backup_snooze" };
const read = key => { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } };
const write = (key, value) => { try { localStorage.setItem(key, String(value)); } catch { /* private mode */ } };

export const touchFirstSeen = () => { if (!read(K.first)) write(K.first, Date.now()); };
export const getBackupState = () => ({ firstSeen: read(K.first), lastBackup: read(K.last), snoozedUntil: read(K.snooze) });
export const markBackedUp = () => write(K.last, Date.now());
export const snoozeBackup = (days = 7) => write(K.snooze, Date.now() + days * 86400000);
