import { dayKey } from '../dates.js';
import { openDayKey } from '../clock.js';

// What the assistant is allowed to see: enough to file a line in the right
// place, no more. Lists, categories, people, routines, the tasks that matter
// this week, and what is held in working memory. Never the journal.

const DAY = 86400000;
const MAX_TASKS = 80;

const weekday = (d) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];

export function buildSnapshot(state, now = Date.now()) {
  const d = new Date(now);
  const today = dayKey(d);
  const tomorrow = dayKey(new Date(now + DAY));
  const weekOut = dayKey(new Date(now + 7 * DAY));
  const open = openDayKey(state.days);
  const lists = (state.lists || []).filter((l) => !l.id.startsWith('day:'));
  const categories = state.categories || [];
  const people = state.people || [];
  const listName = (id) => {
    if (!id) return null;
    if (id.startsWith('day:')) return id.slice(4) === today ? 'today' : id.slice(4) === tomorrow ? 'tomorrow' : id.slice(4);
    return lists.find((l) => l.id === id)?.name || id;
  };
  const keep = (t) => {
    if (t.parentId) return false;
    if (t.startedAt && !t.done) return true;
    if (t.listId === `day:${today}` || t.listId === `day:${tomorrow}`) return !t.done || t.doneAt >= now - DAY;
    if (t.done) return false;
    return !!t.due && t.due <= weekOut;
  };
  const tasks = (state.tasks || [])
    .filter(keep)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.createdAt || 0) - (b.createdAt || 0))
    .slice(0, MAX_TASKS)
    .map((t) => {
      const o = { id: t.id, text: t.text, list: listName(t.listId) };
      if (t.due) o.due = t.due;
      if (t.dueTime) o.due_time = t.dueTime;
      if (t.done) o.done = true;
      if (t.startedAt && !t.done) o.running = true;
      if (t.slot) o.slot = t.slot;
      if (t.estimateMs) o.estimate_minutes = Math.round(t.estimateMs / 60000);
      return o;
    });
  return {
    now: `${weekday(d)} ${today} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    today,
    tomorrow,
    day_open: open ? { key: open, up_since: new Date(state.days[open].wokeAt).toTimeString().slice(0, 5) } : null,
    one_thing: state.days?.[today]?.oneThing || null,
    lists: lists.map((l) => {
      const o = { name: l.name };
      const c = categories.find((x) => x.id === l.categoryId);
      if (c) o.category = c.name;
      const p = people.find((x) => x.id === l.personId);
      if (p) o.person = p.name;
      if (l.horizonDays) o.horizon_days = l.horizonDays;
      return o;
    }),
    categories: categories.map((c) => c.name),
    people: people.map((p) => p.name),
    routines: (state.routines || []).map((r) => {
      const o = { name: r.name, items: (r.items || []).map((i) => i.text) };
      if (r.minutesPerDay) o.minutes_per_day = r.minutesPerDay;
      return o;
    }),
    tasks,
    working_memory: (state.scratch || []).map((s) => ({ id: s.id, text: s.text })),
  };
}
