import { dayKey } from './dates.js';

// Categories group lists (Work: GFD, Reporter, School). Day blocks reserve a
// stretch of the day for a category ("Work 1–4 PM on weekdays"); during a
// block, "Just one thing" and the block card draw from every list in that
// category. Blocks live in prefs.dayBlocks so both devices share them:
//   { id, categoryId, start: 'HH:MM', end: 'HH:MM', days: [0..6] }  (days empty = every day)

export const CATEGORY_COLORS = ['#1F5FA8', '#2E7D32', '#B45309', '#7B1FA2', '#C2185B', '#00838F'];

export function colorForCategory(categories, id) {
  const i = (categories || []).findIndex((c) => c.id === id);
  return (categories || [])[i]?.color || CATEGORY_COLORS[Math.max(0, i) % CATEGORY_COLORS.length];
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function blocksForDay(blocks, date = new Date()) {
  const wd = date.getDay();
  return (blocks || [])
    .filter((b) => b.categoryId && b.start && b.end && (!b.days?.length || b.days.includes(wd)))
    .map((b) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const startMs = d.getTime() + toMinutes(b.start) * 60000;
      let endMs = d.getTime() + toMinutes(b.end) * 60000;
      if (endMs <= startMs) endMs += 24 * 3600000; // past midnight
      return { ...b, startMs, endMs, dayKey: dayKey(date) };
    })
    .sort((a, b) => a.startMs - b.startMs);
}

export function currentBlock(blocks, now = Date.now()) {
  const today = blocksForDay(blocks, new Date(now));
  return today.find((b) => b.startMs <= now && now < b.endMs) || null;
}

export function nextBlock(blocks, now = Date.now()) {
  const today = blocksForDay(blocks, new Date(now)).filter((b) => b.startMs > now);
  if (today.length) return today[0];
  const tomorrow = blocksForDay(blocks, new Date(now + 24 * 3600000));
  return tomorrow[0] || null;
}

// Open tasks on any list in the category (steps excluded).
export function categoryTasks(tasks, lists, categoryId) {
  const ids = new Set((lists || []).filter((l) => l.categoryId === categoryId).map((l) => l.id));
  return (tasks || []).filter((t) => !t.done && !t.parentId && ids.has(t.listId));
}

export function describeBlockTime(b) {
  const f = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  return `${f(b.startMs)} – ${f(b.endMs)}`;
}

export function describeBlockDays(days) {
  if (!days?.length || days.length === 7) return 'Every day';
  const s = [...days].sort().join();
  if (s === '1,2,3,4,5') return 'Weekdays';
  if (s === '0,6') return 'Weekends';
  return [...days].sort().map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
}
