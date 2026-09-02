import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { registerNotificationHandler } from './notificationRouter';
import { openDayKey } from './clock';
import { dayKey } from './dates';
import { isWeb } from './platform';

// The phone opens and closes the day, so the bracket taps you forget become
// taps you were handed. The morning brief carries "I'm up" and "Just one
// thing"; a bedtime nudge carries "Going to bed" and "Not yet". Every button
// works from the shade and from the watch.

export const BRIEF_CATEGORY = 'daybracket-morning';
export const BED_CATEGORY = 'daybracket-night';
const PREFIX = 'daybracket-';
const BED_ID = 'daybracket-bedtime';
const SNOOZE_ID = 'daybracket-bedtime-later';
const SNOOZE_MINUTES = 30;
export const DEFAULT_BEDTIME_HOUR = 23;

export async function ensureDayBracketCategories() {
  await Notifications.setNotificationCategoryAsync(BRIEF_CATEGORY, [
    { identifier: 'daybracket-up', buttonTitle: "I'm up", options: { opensAppToForeground: false } },
    { identifier: 'daybracket-one', buttonTitle: 'Just one thing', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync(BED_CATEGORY, [
    { identifier: 'daybracket-bed', buttonTitle: 'Going to bed', options: { opensAppToForeground: false } },
    { identifier: 'daybracket-later', buttonTitle: 'Not yet', options: { opensAppToForeground: false } },
  ]);
}

export function bedtimeBody(openCount) {
  if (openCount > 0) return `${openCount} still open. Tap Going to bed and Almanac carries them to tomorrow's review.`;
  return 'Nothing left open. Tap Going to bed to close the day.';
}

// bedtimeHour: -1 turns the nudge off; 0..23 schedules it daily.
export default function useDayBracketNotifications(store, { bedtimeHour, onJustOneThing }) {
  const storeRef = useRef(store);
  storeRef.current = store;
  const jotRef = useRef(onJustOneThing);
  jotRef.current = onJustOneThing;

  useEffect(
    () =>
      registerNotificationHandler(PREFIX, (response) => {
        const s = storeRef.current;
        const action = response.actionIdentifier;
        const open = openDayKey(s.days);
        const today = dayKey(new Date());
        if (action === 'daybracket-up' || action === 'daybracket-one') {
          if (!open) s.startDay(today);
          if (action === 'daybracket-one') setTimeout(() => jotRef.current?.(), 300);
        } else if (action === 'daybracket-bed') {
          if (open) s.endDay(open);
          else if (s.days[today]?.wokeAt && !s.days[today]?.sleptAt) s.endDay(today);
        } else if (action === 'daybracket-later') {
          Notifications.scheduleNotificationAsync({
            identifier: SNOOZE_ID,
            content: { title: 'Still up?', body: bedtimeBody(openCountOf(s)), categoryIdentifier: BED_CATEGORY },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: SNOOZE_MINUTES * 60 },
          }).catch(() => {});
        }
      }),
    []
  );

  const openCount = openCountOf(store);
  useEffect(() => {
    if (!store.loaded || isWeb) return;
    (async () => {
      try {
        await Notifications.cancelScheduledNotificationAsync(BED_ID).catch(() => {});
        if (bedtimeHour == null || bedtimeHour < 0) return;
        await ensureDayBracketCategories();
        await Notifications.scheduleNotificationAsync({
          identifier: BED_ID,
          content: { title: 'Wrapping up?', body: bedtimeBody(openCount), categoryIdentifier: BED_CATEGORY },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: bedtimeHour, minute: 0 },
        });
      } catch (err) {
        console.warn('Bedtime nudge scheduling failed', err);
      }
    })();
  }, [bedtimeHour, store.loaded, openCount]);
}

function openCountOf(s) {
  const key = openDayKey(s.days) || dayKey(new Date());
  return s.tasks.filter((t) => !t.done && !t.parentId && t.listId === `day:${key}`).length;
}
