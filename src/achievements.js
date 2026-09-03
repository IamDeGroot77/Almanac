import { dayKey, parseDayKey } from './dates.js';
import { routineProgress } from './routines.js';

// Streaks that forgive and achievements that only ever add up. Nothing here
// resets in red: a run that ends shows its best, and a skip token or one
// missed day in seven keeps a run alive (the Finch rule, not the Snapchat one).

const DAY = 86400000;

function keysBack(now, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(dayKey(new Date(now - i * DAY)));
  return out; // today first
}

// Longest current run of days satisfying `met(key)`, walking back from today
// (or yesterday if today isn't met yet), allowing one miss in any 7-day window.
export function forgivingRun(met, now = Date.now(), maxDays = 120) {
  const keys = keysBack(now, maxDays);
  let i = met(keys[0]) ? 0 : 1; // today may still be in progress
  let run = 0;
  let pending = 0; // a forgiven miss counts only if a hit follows it
  let missesInWindow = [];
  for (; i < keys.length; i++) {
    const hit = met(keys[i]);
    if (hit) {
      run += 1 + pending;
      pending = 0;
      continue;
    }
    missesInWindow = missesInWindow.filter((m) => i - m < 7);
    if (missesInWindow.length >= 1 || run === 0) break;
    missesInWindow.push(i);
    pending = 1;
  }
  return run;
}

export function bestRun(met, now = Date.now(), maxDays = 365) {
  const keys = keysBack(now, maxDays).reverse();
  let best = 0;
  let run = 0;
  let pending = 0;
  let lastMiss = -99;
  keys.forEach((k, i) => {
    if (met(k)) {
      run += 1 + pending;
      pending = 0;
    } else if (run > 0 && i - lastMiss >= 7 && !pending) {
      lastMiss = i;
      pending = 1;
    } else {
      run = 0;
      pending = 0;
    }
    if (run > best) best = run;
  });
  return best;
}

export function streaks(state, now = Date.now()) {
  const opened = (k) => (state.usage?.[k]?.opens || 0) > 0;
  const bracketed = (k) => !!state.days?.[k]?.wokeAt && !state.days[k].implicit;
  const out = [
    { id: 'opened', name: 'Opened Almanac', run: forgivingRun(opened, now), best: bestRun(opened, now) },
    { id: 'bracketed', name: 'Days with a start', run: forgivingRun(bracketed, now), best: bestRun(bracketed, now) },
  ];
  const rs = { tasks: state.tasks || [], routineDone: state.routineDone || {}, routineLog: state.routineLog || [] };
  for (const r of state.routines || []) {
    if (r.cadence !== 'daily') continue;
    const met = (k) => {
      const p = routineProgress(r, rs, parseDayKey(k));
      return p.target > 0 && p.complete;
    };
    out.push({ id: `routine:${r.id}`, name: r.name, run: forgivingRun(met, now, 60), best: bestRun(met, now, 120), routineId: r.id });
  }
  return out;
}

// Achievements: id, name, blurb, and a progress function -> { done, target }.
export const ACHIEVEMENTS = [
  { id: 'first-light', name: 'First light', blurb: 'A day started, by you or by the phone noticing you were up.', progress: (s) => ({ done: Object.values(s.days || {}).some((d) => d?.wokeAt && !d.implicit) ? 1 : 0, target: 1 }) },
  { id: 'first-finish', name: 'One down', blurb: 'Finished a task.', progress: (s) => ({ done: Math.min(1, doneCount(s)), target: 1 }) },
  { id: 'ten-finished', name: 'Ten down', blurb: 'Ten tasks finished.', progress: (s) => ({ done: Math.min(10, doneCount(s)), target: 10 }) },
  { id: 'fifty-finished', name: 'Fifty down', blurb: 'Fifty tasks finished.', progress: (s) => ({ done: Math.min(50, doneCount(s)), target: 50 }) },
  { id: 'first-timed', name: 'On the clock', blurb: 'Timed a task from start to finish.', progress: (s) => ({ done: Math.min(1, (s.timeLog || []).length), target: 1 }) },
  { id: 'calibrated', name: 'Calibrated', blurb: 'Five timed tasks within 20% of their estimate.', progress: (s) => ({ done: Math.min(5, (s.timeLog || []).filter((e) => e.estimateMs && e.durationMs && Math.abs(e.durationMs / e.estimateMs - 1) <= 0.2).length), target: 5 }) },
  { id: 'comeback', name: 'Comeback', blurb: 'Finished something you had dodged three days or more.', progress: (s) => ({ done: (s.tasks || []).some((t) => t.done && (t.carriedCount || 0) >= 3) ? 1 : 0, target: 1 }) },
  { id: 'stretch-first', name: 'Warmed up', blurb: 'Stretched before a workout.', progress: (s) => ({ done: (s.routineLog || []).some((e) => e.itemId === 'warmup') ? 1 : 0, target: 1 }) },
  { id: 'three-hundred-minutes', name: 'Three hundred minutes', blurb: '300 minutes logged on routines.', progress: (s) => ({ done: Math.min(300, Math.round((s.routineLog || []).reduce((a, e) => a + (e.durationMs || 0), 0) / 60000)), target: 300 }) },
  { id: 'journal-first', name: 'Dear diary', blurb: 'Wrote a journal entry.', progress: (s) => ({ done: Math.min(1, journalCount(s)), target: 1 }) },
  { id: 'journal-ten', name: 'Ten pages', blurb: 'Ten journal entries.', progress: (s) => ({ done: Math.min(10, journalCount(s)), target: 10 }) },
  { id: 'honest-skip', name: 'Honest skip', blurb: 'Used a skip token instead of pretending.', progress: (s) => ({ done: Object.values(s.routineDone || {}).some((periods) => Object.values(periods).some((items) => Object.values(items || {}).includes(-1))) ? 1 : 0, target: 1 }) },
  { id: 'named-it', name: 'Named it', blurb: 'Answered "why am I stuck?"', progress: (s) => ({ done: Math.min(1, (s.stuckLog || []).length), target: 1 }) },
  { id: 'week-opened', name: 'A week of showing up', blurb: 'Opened Almanac seven days running.', progress: (s, now) => ({ done: Math.min(7, forgivingRun((k) => (s.usage?.[k]?.opens || 0) > 0, now)), target: 7 }) },
  { id: 'week-bracketed', name: 'Seven mornings', blurb: 'Started the day seven days running.', progress: (s, now) => ({ done: Math.min(7, forgivingRun((k) => !!s.days?.[k]?.wokeAt && !s.days[k].implicit, now)), target: 7 }) },
  { id: 'routine-week', name: 'Routine week', blurb: 'A daily routine met seven days running.', progress: (s, now) => ({ done: Math.min(7, Math.max(0, ...streaks(s, now).filter((x) => x.routineId).map((x) => x.run))), target: 7 }) },
  { id: 'early-bird', name: 'Early bird', blurb: 'Up before seven, five times.', progress: (s) => ({ done: Math.min(5, Object.values(s.days || {}).filter((d) => d?.wokeAt && !d.implicit && new Date(d.wokeAt).getHours() < 7).length), target: 5 }) },
  { id: 'clean-slate', name: 'Clean slate', blurb: 'Closed a day with nothing left over.', progress: (s) => ({ done: Object.values(s.days || {}).some((d) => d?.cleanSlate) ? 1 : 0, target: 1 }) },
];

function doneCount(s) {
  return (s.tasks || []).filter((t) => t.done && !t.parentId).length + (s.timeLog || []).filter((e) => !(s.tasks || []).some((t) => t.id === e.taskId)).length;
}
function journalCount(s) {
  return Object.values(s.journal || {}).reduce((a, es) => a + (es || []).filter((e) => !e.deleted).length, 0);
}

// Every achievement with progress and earned time (if any).
export function evaluateAchievements(state, now = Date.now()) {
  return ACHIEVEMENTS.map((a) => {
    const p = a.progress(state, now);
    const earnedAt = state.achievements?.[a.id] || null;
    return { ...a, done: p.done, target: p.target, complete: p.done >= p.target, earnedAt };
  });
}

// Ids newly complete but not yet recorded.
export function newlyEarned(state, now = Date.now()) {
  return evaluateAchievements(state, now).filter((a) => a.complete && !a.earnedAt).map((a) => a.id);
}
