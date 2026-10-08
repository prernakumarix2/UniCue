const PREFIX = "unicue_";
const KEYS = { attendance: `${PREFIX}attendance`, deadlines: `${PREFIX}deadlines`, preferences: `${PREFIX}preferences`, version: `${PREFIX}data_version` };
function read(key, fallback) { try { const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function write(key,value){ localStorage.setItem(key, JSON.stringify(value)); }
export const localStorageRepository = {
  initialize(){ if(!localStorage.getItem(KEYS.version)) localStorage.setItem(KEYS.version,"1"); },
  getAttendance(){return read(KEYS.attendance,[]);}, saveAttendance(value){write(KEYS.attendance,value);},
  getDeadlines(){return read(KEYS.deadlines,[]);}, saveDeadlines(value){write(KEYS.deadlines,value);},
  getPreferences(){return read(KEYS.preferences,{theme:"system"});}, savePreferences(value){write(KEYS.preferences,value);}
};
