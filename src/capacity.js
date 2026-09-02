// Does today fit? Sum the estimates still open, add them to now, and compare
// with bedtime. Time blindness is optimism about the last few items; this is
// the arithmetic that says "finishing at 11:40 PM" before you commit.

const DAY = 86400000;
const DEFAULT_ESTIMATE_MS = 20 * 60000; // an unestimated task still takes time

export function capacityFor(openTasks, { now = Date.now(), bedtimeHour = 23, wokeAt = null } = {}) {
  const tasks = (openTasks || []).filter((t) => !t.done && !t.parentId);
  if (tasks.length === 0) return null;
  let remainingMs = 0;
  let unestimated = 0;
  for (const t of tasks) {
    const est = t.estimateMs || DEFAULT_ESTIMATE_MS;
    if (!t.estimateMs) unestimated += 1;
    remainingMs += Math.max(0, est - (t.spentMs || 0));
  }
  const finishAt = now + remainingMs;
  const bed = new Date(now);
  bed.setHours(bedtimeHour < 0 ? 23 : bedtimeHour, 0, 0, 0);
  // A bedtime hour before the wake hour means "past midnight" (e.g. 1 AM).
  if (bed.getTime() < now - 6 * 3600000 || (wokeAt && bed.getTime() < wokeAt)) bed.setTime(bed.getTime() + DAY);
  const over = finishAt > bed.getTime();
  return { count: tasks.length, remainingMs, unestimated, finishAt, bedAt: bed.getTime(), over, overByMs: Math.max(0, finishAt - bed.getTime()) };
}

export function describeCapacity(c) {
  if (!c) return null;
  const f = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const h = Math.floor(c.remainingMs / 3600000);
  const m = Math.round((c.remainingMs % 3600000) / 60000);
  const left = h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
  const base = `~${left} left · finishing ${f(c.finishAt)}`;
  return c.over ? `${base}, past bedtime by ${Math.round(c.overByMs / 60000)}m` : base;
}
