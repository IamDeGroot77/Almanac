import { almanacToday } from './clock.js';
import { slotDistance } from './slots.js';

// "Just one thing": choose the single task most worth starting now.
// Overdue and due-today first, then things that keep slipping, then the
// smallest estimate (easier to start), then oldest.
export function pickNext(tasks, { today = almanacToday(), running = [], hour = new Date().getHours() } = {}) {
  const candidates = tasks.filter((t) => !t.done && !t.parentId && !running.includes(t.id));
  if (candidates.length === 0) return null;
  const score = (t) => {
    let s = 0;
    if (t.due && t.due < today) s += 1000;
    else if (t.due === today) s += 500;
    if (t.listId === `day:${today}`) s += 200;
    s += Math.min(3, t.carriedCount || 0) * 50;
    if (t.spentMs || t.startedAt) s += 40; // already begun: momentum
    if (t.estimateMs) s += Math.max(0, 30 - Math.round(t.estimateMs / 600000)); // shorter first
    const d = slotDistance(t.slot, hour);
    if (d === 0) s += 80; // its time of day
    else if (d > 0) s -= 300 * d; // later today: not yet
    else if (d < 0) s += 20; // its slot passed: still worth doing
    return s;
  };
  return [...candidates].sort((a, b) => score(b) - score(a) || a.createdAt - b.createdAt)[0];
}

// First open step under a parent, in creation order.
export function nextStepOf(tasks, parentId) {
  return tasks.filter((t) => t.parentId === parentId && !t.done).sort((a, b) => a.createdAt - b.createdAt)[0] || null;
}

export function childrenOf(tasks, parentId) {
  const kids = tasks.filter((t) => t.parentId === parentId).sort((a, b) => a.createdAt - b.createdAt);
  return { all: kids, open: kids.filter((t) => !t.done), done: kids.filter((t) => t.done) };
}
