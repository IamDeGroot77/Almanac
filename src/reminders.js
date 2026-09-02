import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { dueDateTime } from './due';

// Keeps one scheduled notification per task that has a due time and isn't
// done. Reconciles whenever tasks change: schedules new ones, reschedules
// changed ones, cancels the rest. Identifiers are deterministic per task so
// nothing leaks across restarts.

const reminderId = (task) => `due:${task.id}`;
const reminderKey = (task) => (task.due && task.dueTime && !task.done ? `${task.due}T${task.dueTime}` : null);

async function schedule(task) {
  const when = dueDateTime(task);
  if (!when || when.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: reminderId(task),
    content: { title: task.text, body: 'Due now.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
  });
}

export default function useTaskReminders(tasks, loaded) {
  const known = useRef(new Map()); // task id -> reminderKey currently scheduled

  useEffect(() => {
    if (!loaded) return;
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
