import { dayKey, parseDayKey } from './dates.js';
import { almanacToday, almanacDayKeyFromOffset, almanacDayFromOffset } from './clock.js';

// Due dates are YYYY-MM-DD strings; due times are "HH:MM" (24h) or null.
// "Today" means the almanac day (see clock.js), so a task due Wednesday is
// still "due today" at 1 AM if Wednesday hasn't been closed.

export function dueStatus(task, today = almanacToday()) {
  if (!task.due || task.done) return null;
  if (task.due < today) return 'overdue';
  if (task.due === today) return 'today';
  return 'upcoming';
}

export function describeDue(task, today = almanacToday()) {
  if (!task.due) return null;
  const tomorrow = almanacDayKeyFromOffset(1);
  let day;
  if (task.due === today) day = 'Today';
  else if (task.due === tomorrow) day = 'Tomorrow';
  else {
    const d = parseDayKey(task.due);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    day = d.toLocaleDateString(
      [],
      sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
    );
  }
  return task.dueTime ? `${day} ${formatTime24(task.dueTime)}` : day;
}

export function formatTime24(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Parse loose user input into a day key: "9/15", "9/15/26", "2026-09-15",
// "15" (day of this month), "tomorrow", "mon".. "sun" (next occurrence).
export function parseDueInput(text) {
  const s = (text || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'today') return almanacToday();
  if (s === 'tomorrow' || s === 'tmrw') return almanacDayKeyFromOffset(1);
  const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].findIndex((w) => s.startsWith(w));
  if (wd >= 0) {
    const d = almanacDayFromOffset(0);
    let diff = (wd - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    return dayKey(d);
  }
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return build(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/))) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return build(year, +m[1], +m[2]);
  }
  if ((m = s.match(/^(\d{1,2})$/))) {
    const now = new Date();
    return build(now.getFullYear(), now.getMonth() + 1, +m[1]);
  }
  return null;
}

function build(y, mo, d) {
  const date = new Date(y, mo - 1, d);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return dayKey(date);
}

// "8", "8am", "8:30", "17:00", "5pm", "5:30 pm" -> "HH:MM" or null
export function parseTimeInput(text) {
  const s = (text || '').trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function dueDateTime(task) {
  if (!task.due) return null;
  const d = parseDayKey(task.due);
  if (task.dueTime) {
    const [h, m] = task.dueTime.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}
