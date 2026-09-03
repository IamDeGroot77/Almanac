import { pickNext } from '../pickNext.js';
import { currentBlock, categoryTasks, describeBlockTime } from '../blocks.js';
import { capacityFor } from '../capacity.js';
import { dayKey } from '../dates.js';
import { openDayKey } from '../clock.js';

// What the home-screen widget shows, computed from the saved state alone so
// it can run without the app open: the running task, else the best next
// thing (block-aware), plus the day's numbers.
export function widgetModel(state, now = Date.now()) {
  const tasks = state?.tasks || [];
  const lists = state?.lists || [];
  const today = openDayKey(state?.days) || dayKey(new Date(now));
  const running = tasks.find((t) => !t.done && t.startedAt) || null;
  const runningIds = tasks.filter((t) => !t.done && t.startedAt).map((t) => t.id);
  const block = currentBlock(state?.prefs?.dayBlocks, now);
  const category = block ? (state?.categories || []).find((c) => c.id === block.categoryId) : null;
  const pool = block ? categoryTasks(tasks, lists, block.categoryId) : [];
  const pinned = tasks.find((t) => t.id === state?.days?.[today]?.oneThing && !t.done) || null;
  const next = pinned || (pool.length ? pickNext(pool, { today, running: runningIds }) : null) || pickNext(tasks.filter((t) => !t.parentId), { today, running: runningIds });
  const openToday = tasks.filter((t) => !t.done && !t.parentId && t.listId === `day:${today}`);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const doneToday = tasks.filter((t) => t.done && t.doneAt >= dayStart.getTime()).length;
  const capacity = capacityFor(openToday, { now, bedtimeHour: state?.prefs?.bedtimeHour ?? 23 });
  const fmt = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return {
    kicker: running ? 'Now' : pinned ? 'The one thing' : block ? `${category?.name || 'Block'} time · ${describeBlockTime(block)}` : 'Next',
    title: running ? running.text : next ? next.text : 'Nothing lined up',
    sub: running
      ? `running${running.estimateMs ? ` · ~${Math.round(running.estimateMs / 60000)} min` : ''}`
      : next?.firstStep
        ? `Start with: ${next.firstStep}`
        : next
          ? lists.find((l) => l.id === next.listId)?.name || ''
          : 'Open Almanac to add one small thing',
    doneToday,
    openToday: openToday.length,
    finish: capacity ? `${capacity.over ? 'past bed · ' : ''}${fmt(capacity.finishAt)}` : null,
    taskId: running?.id || next?.id || null,
    running: !!running,
  };
}
