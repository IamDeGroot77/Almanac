import { dayKey, parseDayKey } from './dates.js';
import { almanacToday } from './clock.js';

// Lists that are really a syllabus: tasks carrying a week (from a pasted
// syllabus) or a course and a due date (from Canvas) are shown week by week,
// each week split by course. Returns null when the list is not that kind.

const DAY = 86400000;

function weekStartOf(key) {
  const d = parseDayKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function groupByWeek(tasks, today = almanacToday()) {
  const withWeek = tasks.filter((t) => t.week?.label);
  const dated = tasks.filter((t) => !t.week?.label && t.canvasCourse && t.due);
  if (withWeek.length + dated.length < 4) return null;

  const groups = new Map();
  const add = (key, title, order, t) => {
    if (!groups.has(key)) groups.set(key, { key, title, order, tasks: [] });
    groups.get(key).tasks.push(t);
  };
  for (const t of withWeek) add(`w:${t.week.n}`, t.week.label, t.week.n, t);
  for (const t of dated) {
    const ws = weekStartOf(t.due);
    const we = new Date(ws.getTime() + 6 * DAY);
    add(`d:${dayKey(ws)}`, `Week of ${ws.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString([], { month: 'short', day: 'numeric' })}`, 1000 + ws.getTime() / DAY, t);
  }
  const rest = tasks.filter((t) => !withWeek.includes(t) && !dated.includes(t));
  for (const t of rest) add('rest', 'Other', 999999, t);

  const todayWeek = dayKey(weekStartOf(today));
  return [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map((g) => {
      const byCourse = new Map();
      for (const t of g.tasks) {
        const name = t.canvasCourse || null;
        if (!byCourse.has(name)) byCourse.set(name, []);
        byCourse.get(name).push(t);
      }
      const dues = g.tasks.map((t) => t.due).filter(Boolean).sort();
      const current = dues.length ? dayKey(weekStartOf(dues[0])) === todayWeek || (dues[0] >= today && dayKey(weekStartOf(dues[dues.length - 1])) === todayWeek) : false;
      return {
        key: g.key,
        title: g.title,
        current,
        openCount: g.tasks.filter((t) => !t.done).length,
        courses: [...byCourse.entries()].sort((a, b) => (a[0] || '').localeCompare(b[0] || '')).map(([name, list]) => ({ name, tasks: list })),
      };
    });
}
