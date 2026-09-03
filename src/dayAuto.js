import { dayKey } from './dates.js';
import { openDayKey } from './clock.js';

// The start of day happens the first time the app opens after a clear
// stretch of sleep, so nobody has to remember "I'm up". A clear stretch is
// either a detected sleep segment that ended after the last thing you did,
// or simply no activity for a few hours. Pure: given state and a clock it
// returns what to change, or null. App applies it and runs the sequence
// (review, energy, refresh).

export const MIN_SLEEP_GAP_MS = 4 * 60 * 60 * 1000;
const LONG_DAY_MS = 20 * 60 * 60 * 1000; // a day open this long is yesterday's, whatever the activity says
const DETECTION_FRESH_MS = 12 * 60 * 60 * 1000;

// Latest moment the person demonstrably used the phone or the app.
export function lastActivityAt(state) {
  let best = 0;
  for (const d of Object.values(state.days || {})) {
    for (const t of [d?.lastActiveAt, d?.wokeAt, d?.sleptAt]) if (t && t > best) best = t;
  }
  for (const u of Object.values(state.usage || {})) if (u?.lastAt && u.lastAt > best) best = u.lastAt;
  return best || null;
}

export function planAutoStart(state, now = Date.now()) {
  const todayKey = dayKey(new Date(now));
  const open = openDayKey(state.days);
  if (open === todayKey) return null; // already up today

  const today = state.days?.[todayKey] || {};
  if (today.wokeAt && today.sleptAt) return null; // today was started and closed already

  const last = lastActivityAt(state);
  const detected = today.sleep && now - today.sleep.end < DETECTION_FRESH_MS ? today.sleep : null;
  const sleptSince = detected && (!last || detected.end > last);
  const gap = last ? now - last : Infinity;
  // A day from an earlier calendar date that has been open 20 hours is over,
  // even if something kept stamping activity on it overnight (a sync, a
  // laptop left open, a background edit). Morning means after 4 AM.
  const openDay = open ? state.days[open] : null;
  const overlong = openDay && open < todayKey && now - openDay.wokeAt >= LONG_DAY_MS && new Date(now).getHours() >= 4;
  if (!sleptSince && gap < MIN_SLEEP_GAP_MS && !overlong) return null;

  const plan = { startKey: todayKey, wokeAt: detected ? detected.end : now, source: detected ? 'sleep' : 'open', closeKey: null, closeAt: null };
  if (open) {
    const d = state.days[open];
    const bedtime = detected && detected.start > d.wokeAt ? detected.start : Math.max(d.lastActiveAt || 0, d.wokeAt + 60000);
    plan.closeKey = open;
    plan.closeAt = Math.min(bedtime, plan.wokeAt - 1);
  }
  return plan;
}

export function describeAutoStart(plan) {
  return plan.source === 'sleep' ? 'Good morning. Your day started when the phone saw you wake up.' : 'Good morning. Your day started when you opened Almanac.';
}
