import { dayKey, parseDayKey } from './dates.js';
import { almanacToday } from './clock.js';

// Routines are lists that regenerate every period.
//   { id, name, cadence: 'daily' | 'weekly', personId, items: [...] }
// Items:
//   { id, type: 'task',  text, days?: number[] }   // days: 0=Sun..6=Sat, daily only
//   { id, type: 'quota', listId, count }           // "count tasks from listId"
//   { id, type: 'quota', routineId, count }        // "count items ticked on routineId" (e.g. 1 workout a day)
//   { id, type: 'minutes', routineId, minutes }    // "minutes logged today on routineId" (a minute is a point)
// A routine may carry minutesPerDay (a points goal) and warmup (suggest a
// stretch before the first timed item in an hour). Timed items are logged in
// state.routineLog: { id, routineId, itemId, text, startedAt, endedAt, durationMs }.
// Plain items are ticked per period in state.routineDone[routineId][periodKey][itemId].
// Quota progress is derived from tasks finished in the period.
//
// Periods follow the almanac day (see clock.js): a daily routine started on
// Wednesday is still Wednesday's at 1 AM if you haven't said Good night.

export const WEEK_START = 1; // Monday

// The calendar day a period is anchored on. Explicit `date` wins (tests);
// otherwise the almanac day.
const anchor = (date) => (date ? new Date(date) : parseDayKey(almanacToday()));

export function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - WEEK_START + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function periodKey(routine, date) {
  const a = anchor(date);
  return routine.cadence === 'weekly' ? `w:${dayKey(weekStart(a))}` : `d:${dayKey(a)}`;
}

// Bounds run from the period's midnight start until its nominal end, or the
// present moment if the almanac day has spilled past that end (late nights).
export function periodBounds(routine, date) {
  const a = anchor(date);
  const start = routine.cadence === 'weekly' ? weekStart(a) : new Date(a.setHours(0, 0, 0, 0));
  const end = new Date(start);
  end.setDate(end.getDate() + (routine.cadence === 'weekly' ? 7 : 1));
  const spill = Date.now() + 1;
  return { start, end: end.getTime() > spill || date ? end : new Date(spill) };
}

export function periodLabel(routine, date) {
  if (routine.cadence !== 'weekly') return 'Today';
  const { start } = periodBounds(routine, date);
  const last = new Date(start);
  last.setDate(last.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(last)}`;
}

export function daysLeftInPeriod(routine, date) {
  const { start } = periodBounds(routine, date);
  const nominalEnd = new Date(start);
  nominalEnd.setDate(nominalEnd.getDate() + (routine.cadence === 'weekly' ? 7 : 1));
  return Math.max(0, Math.ceil((nominalEnd - Date.now()) / 86400000));
}

// Items that apply on the anchored day (weekday filters only matter for daily routines).
export function activeItems(routine, date) {
  if (routine.cadence !== 'daily') return routine.items;
  const wd = anchor(date).getDay();
  return routine.items.filter((it) => it.type !== 'task' || !it.days?.length || it.days.includes(wd));
}

// Progress for one item in the period containing the anchored day.
export function minutesToday(routineId, routineLog, date) {
  const a = anchor(date);
  const start = new Date(a).setHours(0, 0, 0, 0);
  const end = start + 86400000;
  let ms = 0;
  for (const e of routineLog || []) {
    if (e.routineId !== routineId) continue;
    const at = e.endedAt || e.startedAt || 0;
    if (at >= start && at < end) ms += e.durationMs || 0;
  }
  return Math.round(ms / 60000);
}

// Stretch first when nothing on this routine finished in the last hour.
export function needsWarmup(routineId, routineLog, now = Date.now()) {
  const last = (routineLog || []).filter((e) => e.routineId === routineId).reduce((m, e) => Math.max(m, e.endedAt || 0), 0);
  return now - last > 3600000;
}

export function itemProgress(routine, item, { tasks, routineDone, routineLog }, date) {
  if (item.type === 'task') {
    const key = periodKey(routine, date);
    const done = !!routineDone?.[routine.id]?.[key]?.[item.id];
    return { done: done ? 1 : 0, target: 1, complete: done };
  }
  if (item.type === 'minutes') {
    const done = minutesToday(item.routineId, routineLog, date);
    const complete = done >= item.minutes;
    return { done: complete ? 1 : 0, target: 1, complete, minutes: { done: Math.min(done, item.minutes), target: item.minutes } };
  }
  const { start, end } = periodBounds(routine, date);
  let done = 0;
  if (item.routineId) {
    // Ticks on the other routine, whatever period they were filed under.
    for (const period of Object.values(routineDone?.[item.routineId] || {})) {
      for (const at of Object.values(period)) if (at >= start.getTime() && at < end.getTime()) done += 1;
    }
  } else {
    done = tasks.filter(
      (t) => t.listId === item.listId && t.done && t.doneAt >= start.getTime() && t.doneAt < end.getTime()
    ).length;
  }
  return { done: Math.min(done, item.count), target: item.count, complete: done >= item.count };
}

export function routineProgress(routine, state, date) {
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
