// Timeline lists: a named list with a horizon (1, 3, or 6 months) gives every
// task a due date that far out, and after a quieter stretch (the nudge) the
// task surfaces on Today as "worth considering" with two answers: do it
// today, or not yet (which waits another nudge before asking again).

const DAY = 86400000;

export const HORIZONS = [
  { id: 'none', name: 'None', days: null, nudgeDays: null },
  { id: '30', name: '1 month', days: 30, nudgeDays: 7 },
  { id: '90', name: '3 months', days: 90, nudgeDays: 21 },
  { id: '180', name: '6 months', days: 180, nudgeDays: 30 },
];

export function horizonFor(list) {
  return HORIZONS.find((h) => h.days === (list?.horizonDays || null)) || HORIZONS[0];
}

export function dueForHorizon(list, now = Date.now()) {
  const h = horizonFor(list);
  if (!h.days) return null;
  const d = new Date(now + h.days * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Up to `limit` tasks on horizon lists that have sat unasked for a nudge
// period, oldest first.
export function considerations(state, now = Date.now(), limit = 3) {
  const lists = new Map((state.lists || []).map((l) => [l.id, l]));
  const out = [];
  for (const t of state.tasks || []) {
    if (t.done || t.parentId) continue;
    const list = lists.get(t.listId);
    const h = horizonFor(list);
    if (!h.nudgeDays) continue;
    const since = t.nudgedAt || t.createdAt || 0;
    if (since + h.nudgeDays * DAY > now) continue;
    out.push({ task: t, list, waitedDays: Math.floor((now - (t.createdAt || now)) / DAY), horizon: h });
  }
  out.sort((a, b) => (a.task.createdAt || 0) - (b.task.createdAt || 0));
  return out.slice(0, limit);
}

export function describeConsideration(c) {
  const left = c.task.due ? Math.ceil((new Date(c.task.due + 'T00:00:00') - Date.now()) / DAY) : null;
  const parts = [`${c.list.name}`, `${c.waitedDays} ${c.waitedDays === 1 ? 'day' : 'days'} on the list`];
  if (left != null) parts.push(left >= 0 ? `${left} left` : `${-left} over`);
  return parts.join(' · ');
}
