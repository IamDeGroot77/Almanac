import { dayKey, dayFromOffset, parseDayKey } from './dates.js';

// Routines are lists that regenerate every period.
//   { id, name, cadence: 'daily' | 'weekly', personId, items: [...] }
// Items:
//   { id, type: 'task',  text, days?: number[] }   // days: 0=Sun..6=Sat, daily only
//   { id, type: 'quota', listId, count }           // "count tasks from listId"
// Plain items are ticked per period in state.routineDone[routineId][periodKey][itemId].
// Quota progress is derived from tasks finished in the period.

export const WEEK_START = 1; // Monday

export function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - WEEK_START + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function periodKey(routine, date = new Date()) {
  return routine.cadence === 'weekly' ? `w:${dayKey(weekStart(date))}` : `d:${dayKey(date)}`;
}

export function periodBounds(routine, date = new Date()) {
  if (routine.cadence === 'weekly') {
    const start = weekStart(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function periodLabel(routine, date = new Date()) {
  if (routine.cadence !== 'weekly') return 'Today';
  const { start, end } = periodBounds(routine, date);
  const last = new Date(end);
  last.setDate(last.getDate() - 1);
  const fmt = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(last)}`;
}

export function daysLeftInPeriod(routine, date = new Date()) {
  const { end } = periodBounds(routine, date);
  return Math.max(0, Math.ceil((end - date) / 86400000));
}

// Items that apply on `date` (weekday filters only matter for daily routines).
export function activeItems(routine, date = new Date()) {
  if (routine.cadence !== 'daily') return routine.items;
  const wd = date.getDay();
  return routine.items.filter((it) => it.type !== 'task' || !it.days?.length || it.days.includes(wd));
}

// Progress for one item in the period containing `date`.
export function itemProgress(routine, item, { tasks, routineDone }, date = new Date()) {
  if (item.type === 'task') {
    const key = periodKey(routine, date);
    const done = !!routineDone?.[routine.id]?.[key]?.[item.id];
    return { done: done ? 1 : 0, target: 1, complete: done };
  }
  const { start, end } = periodBounds(routine, date);
  const done = tasks.filter(
    (t) => t.listId === item.listId && t.done && t.doneAt >= start.getTime() && t.doneAt < end.getTime()
  ).length;
  return { done: Math.min(done, item.count), target: item.count, complete: done >= item.count };
}

export function routineProgress(routine, state, date = new Date()) {
  const items = activeItems(routine, date);
  let done = 0;
  let target = 0;
  for (const it of items) {
    const p = itemProgress(routine, it, state, date);
    done += p.done;
    target += p.target;
  }
  return { done, target, complete: target > 0 && done >= target, items };
}

export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function describeDays(days) {
  if (!days?.length || days.length === 7) return 'Every day';
  const sorted = [...days].sort();
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '0,6') return 'Weekends';
  return sorted.map((d) => WEEKDAY_NAMES[d].slice(0, 3)).join(', ');
}

// Convenience for tests and screens.
export const todayDate = () => dayFromOffset(0);
export { parseDayKey };
