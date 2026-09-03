import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { dueDateTime } from './due';
import { cueFromPlan } from './cues';
import { isWeb } from './platform';

// Keeps one scheduled notification per task that has a due time and isn't
// done. Reconciles whenever tasks change: schedules new ones, reschedules
// changed ones, cancels the rest. Identifiers are deterministic per task so
// nothing leaks across restarts.

const reminderId = (task) => `due:${task.id}`;

// One reminder per task: the plan's cue ("after lunch", "Tuesday 2pm") if it
// names a time, else the due time.
function reminderFor(task) {
  if (task.done) return null;
  const cue = cueFromPlan(task.plan, { taskDue: task.due || null });
  if (cue && cue.at > Date.now()) return { key: `cue:${cue.at}`, when: new Date(cue.at), body: `Your plan: ${task.plan}` };
  const when = dueDateTime(task);
  if (task.due && task.dueTime && when && when.getTime() > Date.now()) return { key: `${task.due}T${task.dueTime}`, when, body: 'Due now.' };
  return null;
}
const reminderKey = (task) => reminderFor(task)?.key || null;

async function schedule(task) {
  const r = reminderFor(task);
  if (!r) return;
  await Notifications.scheduleNotificationAsync({
    identifier: reminderId(task),
    content: { title: task.text, body: r.body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.when },
  });
}

export default function useTaskReminders(tasks, loaded) {
  const known = useRef(new Map()); // task id -> reminderKey currently scheduled
  const reconciled = useRef(false);

  useEffect(() => {
    if (!loaded || isWeb || reconciled.current) return;
    reconciled.current = true;
    (async () => {
      try {
        const all = await Notifications.getAllScheduledNotificationsAsync();
        const ids = new Set(tasks.map((t) => `due:${t.id}`));
        for (const n of all) {
          const id = n.identifier || '';
          if (id.startsWith('due:') && !ids.has(id)) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        }
      } catch (err) {
        console.warn('Reminder cleanup failed', err?.message || err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    if (!loaded || isWeb) return;
    const wanted = new Map();
    for (const t of tasks) {
      const key = reminderKey(t);
      if (key) wanted.set(t.id, { key, task: t });
    }
    (async () => {
      try {
        // Cancel reminders for tasks that no longer need one.
        for (const [id, key] of known.current) {
          if (!wanted.has(id) || wanted.get(id).key !== key) {
            await Notifications.cancelScheduledNotificationAsync(`due:${id}`).catch(() => {});
            known.current.delete(id);
          }
        }
        // Schedule new or changed ones.
        for (const [id, { key, task }] of wanted) {
          if (known.current.get(id) === key) continue;
          await schedule(task);
          known.current.set(id, key);
        }
      } catch (err) {
        console.warn('Reminder reconcile failed', err);
      }
    })();
  }, [tasks, loaded]);
}
