import { dayKey, parseDayKey } from './dates.js';

// The "almanac day" is the day you started with "I'm up" and haven't closed
// with "Good night", even after midnight. When no day is open it's the
// calendar date. App sets it each render; helpers read it as their default.

let override = null; // YYYY-MM-DD or null

export function setAlmanacToday(key) {
  override = key || null;
}

export function almanacToday() {
  return override || dayKey(new Date());
}

// Start of the almanac day (local midnight of its date).
export function almanacDayStart() {
  return parseDayKey(almanacToday());
}

export function almanacDayFromOffset(offset) {
  const d = almanacDayStart();
  d.setDate(d.getDate() + offset);
  return d;
}

export function almanacDayKeyFromOffset(offset) {
  return dayKey(almanacDayFromOffset(offset));
}

// Given the days record, which day (if any) is open right now?
export function openDayKey(days) {
  const open = Object.entries(days || {})
    .filter(([, v]) => v?.wokeAt && !v.sleptAt)
    .map(([k]) => k)
    .sort();
  return open.length ? open[open.length - 1] : null;
}

// The day that was open at a moment in the past: started before it, within
// a day of it, and either still open or closed only by a guess (auto-close).
// Used to apply a "Going to bed" tap replayed hours after the fact.
export function dayOpenAt(days, at) {
  let best = null;
  for (const [k, v] of Object.entries(days || {})) {
    if (!v?.wokeAt || v.wokeAt > at || at - v.wokeAt > 24 * 3600000) continue;
    if (v.sleptAt && !v.implicitClose) continue; // closed on purpose, leave it
    if (!best || v.wokeAt > best.wokeAt) best = { key: k, ...v };
  }
  return best ? best.key : null;
}

// Most recently closed day, for "reopen" after an accidental Good night.
export function lastClosedDay(days) {
  let best = null;
  for (const [k, v] of Object.entries(days || {})) {
    if (v?.sleptAt && (!best || v.sleptAt > best.sleptAt)) best = { key: k, ...v };
  }
  return best;
}
