import { formatDuration } from './durations.js';

// Kept dependency-free of the store so this file runs in plain Node for tests.
const isDayList = (listId) => typeof listId === 'string' && listId.startsWith('day:');

// Turns the raw records into the numbers behind the Insights tab. Pure
// functions over state so they're easy to test.

const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const avg = (arr, f) => (arr.length ? sum(arr, f) / arr.length : 0);

// Reality vs perception: how actuals compare with estimates.
export function estimateAccuracy(timeLog) {
  const withEst = timeLog.filter((e) => e.estimateMs > 0 && e.durationMs > 0);
  if (withEst.length === 0) return null;
  const ratios = withEst.map((e) => e.durationMs / e.estimateMs);
  const median = [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
  const over = withEst.filter((e) => e.durationMs > e.estimateMs * 1.25).length;
  const under = withEst.filter((e) => e.durationMs < e.estimateMs * 0.75).length;
  const misses = [...withEst]
    .map((e) => ({ ...e, ratio: e.durationMs / e.estimateMs }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);
  return { count: withEst.length, median, over, under, misses };
}

// Where the hours go.
export function timeByList(timeLog, lists) {
  const buckets = new Map();
  for (const e of timeLog) {
    const key = isDayList(e.listId) ? 'day' : e.listId;
    buckets.set(key, (buckets.get(key) || 0) + (e.durationMs || 0));
  }
  return [...buckets.entries()]
    .map(([key, ms]) => ({
      key,
      name: key === 'day' ? 'Day lists' : lists.find((l) => l.id === key)?.name || 'Deleted list',
      ms,
    }))
    .filter((b) => b.ms > 0)
    .sort((a, b) => b.ms - a.ms);
}

export function timeByPerson(timeLog, people) {
  const buckets = new Map();
  for (const e of timeLog) {
    const key = e.personId || 'me';
    buckets.set(key, (buckets.get(key) || 0) + (e.durationMs || 0));
  }
  return [...buckets.entries()]
    .map(([key, ms]) => ({ key, name: people.find((p) => p.id === key)?.name || 'Me', ms }))
    .filter((b) => b.ms > 0)
    .sort((a, b) => b.ms - a.ms);
}

// What keeps slipping: tasks carried across days.
export function carryOvers(tasks) {
  const carried = tasks.filter((t) => (t.carriedCount || 0) > 0);
  const repeat = carried.filter((t) => t.carriedCount >= 2).length;
  const worst = [...carried].sort((a, b) => b.carriedCount - a.carriedCount).slice(0, 5);
  return { count: carried.length, repeat, worst };
}

// Days: awake hours, tracked share, sleep.
export function dayStats(days) {
  const rows = Object.entries(days)
    .map(([key, d]) => ({ key, ...d }))
    .filter((d) => d.wokeAt && d.sleptAt && d.sleptAt > d.wokeAt)
    .sort((a, b) => a.key.localeCompare(b.key));
  if (rows.length === 0) return null;
  const awake = rows.map((d) => d.sleptAt - d.wokeAt);
  const sleeps = rows.filter((d) => d.sleep).map((d) => d.sleep.end - d.sleep.start);
  return {
    count: rows.length,
    avgAwakeMs: avg(awake, (x) => x),
    avgSleepMs: sleeps.length ? avg(sleeps, (x) => x) : null,
    latestBed: rows[rows.length - 1].sleptAt,
    recent: rows.slice(-7),
  };
}

// Tracked time per awake hour, for the days we have both.
export function trackedShare(days, timeLog) {
  const rows = Object.entries(days)
    .map(([key, d]) => ({ key, ...d }))
    .filter((d) => d.wokeAt && d.sleptAt && d.sleptAt > d.wokeAt);
  if (rows.length === 0) return null;
  let awake = 0;
  let tracked = 0;
  for (const d of rows) {
    awake += d.sleptAt - d.wokeAt;
    tracked += sum(
      timeLog.filter((e) => e.doneAt >= d.wokeAt && e.doneAt <= d.sleptAt),
      (e) => e.durationMs
    );
  }
  return { awakeMs: awake, trackedMs: tracked, share: awake ? tracked / awake : 0 };
}

export function routineCompletion(routines, routineDone, tasks, progressFn) {
  return routines.map((r) => {
    const periods = Object.keys(routineDone?.[r.id] || {});
    return { id: r.id, name: r.name, periodsTouched: periods.length };
  });
}

export const fmt = formatDuration;
