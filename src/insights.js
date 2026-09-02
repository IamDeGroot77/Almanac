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
// One row per week (Monday start), newest last: did the app get used?
export function usageStats(state, weeks = 4, now = Date.now()) {
  const DAY = 86400000;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // this Monday
  const rows = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const from = start.getTime() - w * 7 * DAY;
    const to = from + 7 * DAY;
    const keys = Array.from({ length: 7 }, (_, i) => dayKeyOf(new Date(from + i * DAY)));
    const opened = keys.filter((k) => (state.usage?.[k]?.opens || 0) > 0).length;
    const bracketed = keys.filter((k) => state.days?.[k]?.wokeAt && !state.days[k].implicit).length;
    const inWeek = (t) => t >= from && t < to;
    const captured = state.tasks.filter((t) => !t.parentId && inWeek(t.createdAt || 0)).length;
    const startedIds = new Set();
    for (const t of state.tasks) for (const s of t.sessions || []) if (inWeek(s.start || s.startedAt || 0)) startedIds.add(t.id);
    for (const e of state.timeLog || []) if (inWeek(e.startedAt || 0)) startedIds.add(e.taskId);
    const finished = state.tasks.filter((t) => t.done && inWeek(t.doneAt || 0)).length + (state.timeLog || []).filter((e) => inWeek(e.doneAt || 0) && !state.tasks.some((t) => t.id === e.taskId)).length;
    const d = new Date(from);
    rows.push({
      key: keys[0],
      label: w === 0 ? 'This week' : w === 1 ? 'Last week' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      opened,
      bracketed,
      captured,
      started: startedIds.size,
      finished,
    });
  }
  return rows;
}

function dayKeyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

// Energy against output: for each morning energy level, what an average day
// looked like (tasks finished, time tracked, sleep the night before).
export function energyStats(days, timeLog, tasks) {
  const rows = Object.entries(days)
    .map(([key, d]) => ({ key, ...d }))
    .filter((d) => d.energy?.wake && d.wokeAt);
  if (rows.length < 2) return null;
  const byLevel = { 1: [], 2: [], 3: [] };
  for (const d of rows) {
    const start = d.wokeAt;
    const end = d.sleptAt || start + 18 * 3600000;
    const done = tasks.filter((t) => t.done && t.doneAt >= start && t.doneAt < end).length;
    const tracked = sum(timeLog.filter((e) => e.doneAt >= start && e.doneAt < end), (e) => e.durationMs);
    const slept = d.sleep ? d.sleep.end - d.sleep.start : null;
    byLevel[d.energy.wake].push({ done, tracked, slept, bed: d.energy.bed ?? null });
  }
  const levels = [1, 2, 3].map((level) => {
    const list = byLevel[level];
    return {
      level,
      days: list.length,
      avgDone: avg(list, (x) => x.done),
      avgTrackedMs: avg(list, (x) => x.tracked),
      avgSleepMs: list.some((x) => x.slept) ? avg(list.filter((x) => x.slept), (x) => x.slept) : null,
    };
  });
  const answered = rows.length;
  return { answered, levels };
}

export const fmt = formatDuration;
