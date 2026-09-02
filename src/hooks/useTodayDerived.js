import { useMemo } from 'react';
import { pastUnfinished, dayListIdForOffset, tasksForList, isDayList, dayOfList } from '../store';
import { describeDayKey, parseDayKey } from '../dates';
import { formatDuration } from '../durations';
import { dueStatus } from '../due';
import { routineProgress } from '../routines';

// Everything the Today tab derives from the visible tasks: the review,
// due sections, the day summary, and the wrap-up numbers.
export default function useTodayDerived({ store, visibleTasks, visibleRoutines, dayOffset, today }) {
  const dayListId = dayListIdForOffset(dayOffset);
  const todayListId = dayListIdForOffset(0);

  const reviewTasks = useMemo(() => pastUnfinished(visibleTasks), [visibleTasks]);

  const dueOverdue = visibleTasks.filter((t) => t.listId !== todayListId && dueStatus(t) === 'overdue');
  const dueToday = visibleTasks.filter((t) => t.listId !== todayListId && dueStatus(t) === 'today');
  const contextFor = (t) =>
    isDayList(t.listId) ? describeDayKey(dayOfList(t.listId)) : store.lists.find((l) => l.id === t.listId)?.name || null;

  const daySummary = useMemo(() => {
    const { done } = tasksForList(visibleTasks, dayListId);
    if (done.length === 0) return null;
    const tracked = done.reduce((sum, t) => sum + (t.durationMs || 0), 0);
    const parts = [`${done.length} done`];
    if (tracked > 0) parts.push(`${formatDuration(tracked)} tracked`);
    return parts.join(' · ');
  }, [visibleTasks, dayListId]);

  // Numbers for the end-of-day card, from the almanac day's midnight until now.
  const wrapUpStats = useMemo(() => {
    const start = parseDayKey(today).getTime();
    const end = Date.now() + 1;
    const doneToday = visibleTasks.filter((t) => t.done && t.doneAt >= start && t.doneAt < end);
    const open = tasksForList(visibleTasks, todayListId).open;
    const routineState = { tasks: store.tasks, routineDone: store.routineDone };
    return {
      doneCount: doneToday.length,
      openCount: open.length,
      trackedMs: doneToday.reduce((s, t) => s + (t.durationMs || 0), 0),
      estimateMs: doneToday.filter((t) => t.durationMs).reduce((s, t) => s + (t.estimateMs || 0), 0),
      routines: visibleRoutines.map((r) => ({ name: r.name, ...routineProgress(r, routineState) })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTasks, visibleRoutines, store.routineDone, today]);

  return { dayListId, todayListId, reviewTasks, dueOverdue, dueToday, contextFor, daySummary, wrapUpStats };
}
