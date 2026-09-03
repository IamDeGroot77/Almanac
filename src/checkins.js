import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { formatTime } from './dates';
import { registerNotificationHandler } from './notificationRouter';
import { isWeb } from './platform';

// "Still working on this?" While a task is running, a repeating notification
// checks in every N minutes with three replies: Still on it, Pause, Finish.
// They work from the shade and from a Wear OS watch. Scheduled per running
// task; cancelled when it pauses or finishes.

export const CHECKIN_CATEGORY = 'task-checkin';
const ACTION_PREFIX = 'checkin-';
const ACTION_STILL = 'checkin-still';
const ACTION_PAUSE = 'checkin-pause';
const ACTION_FINISH = 'checkin-finish';
const idFor = (taskId) => `checkin:${taskId}`;

export async function ensureCheckinCategory() {
  await Notifications.setNotificationCategoryAsync(CHECKIN_CATEGORY, [
    { identifier: ACTION_STILL, buttonTitle: 'Still on it', options: { opensAppToForeground: false } },
    { identifier: ACTION_PAUSE, buttonTitle: 'Pause', options: { opensAppToForeground: false } },
    { identifier: ACTION_FINISH, buttonTitle: 'Finish', options: { opensAppToForeground: false } },
  ]);
}

export default function useTaskCheckins(store, { minutes }) {
  const answered = useRef({});
  const storeRef = useRef(store);
  storeRef.current = store;
  const scheduled = useRef(new Map()); // taskId -> `${startedAt}:${minutes}`

  useEffect(
    () =>
      registerNotificationHandler(ACTION_PREFIX, (response) => {
        const taskId = response.notification?.request?.content?.data?.taskId;
        if (!taskId) return;
        const s = storeRef.current;
        answered.current[taskId] = Date.now();
        if (response.actionIdentifier === ACTION_PAUSE) s.pauseTask(taskId);
        else if (response.actionIdentifier === ACTION_FINISH) s.finishTask(taskId);
        // "Still on it" needs nothing: the repeat keeps going.
      }),
    []
  );

  const running = store.tasks.filter((t) => !t.done && t.startedAt);
  const signature = running.map((t) => `${t.id}:${t.startedAt}`).join(';');

  // A timer nobody has answered in three check-ins is a timer left running;
  // pause it (auto-pause) so the log stays honest and the nagging stops.
  useEffect(() => {
    if (!store.loaded || isWeb || !minutes) return;
    const timer = setInterval(() => {
      const s = storeRef.current;
      const limit = 3 * minutes * 60000;
      const now = Date.now();
      for (const t of s.tasks) {
        if (!t.startedAt || t.done) continue;
        const since = Math.max(t.startedAt, answered.current[t.id] || 0);
        if (now - since > limit) {
          s.pauseTask(t.id);
          console.warn('Auto-paused after unanswered check-ins:', t.text);
        }
      }
    }, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loaded, minutes]);

  useEffect(() => {
    if (!store.loaded || isWeb) return;
    (async () => {
      try {
        const want = new Map();
        if (minutes > 0) for (const t of running) want.set(t.id, `${t.startedAt}:${minutes}`);

        for (const [taskId, key] of scheduled.current) {
          if (want.get(taskId) !== key) {
            await Notifications.cancelScheduledNotificationAsync(idFor(taskId)).catch(() => {});
            scheduled.current.delete(taskId);
          }
        }
        if (want.size === 0) return;
        await ensureCheckinCategory();
        for (const t of running) {
          const key = want.get(t.id);
          if (!key || scheduled.current.get(t.id) === key) continue;
          await Notifications.scheduleNotificationAsync({
            identifier: idFor(t.id),
            content: {
              title: `Still working on ${t.text}?`,
              body: `Started ${formatTime(t.startedAt)}. Tap if you've moved on.`,
              categoryIdentifier: CHECKIN_CATEGORY,
              data: { taskId: t.id },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: Math.max(60, Math.round(minutes * 60)),
              repeats: true,
            },
          });
          scheduled.current.set(t.id, key);
        }
      } catch (err) {
        console.warn('Check-in scheduling failed', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, minutes, store.loaded]);
}
