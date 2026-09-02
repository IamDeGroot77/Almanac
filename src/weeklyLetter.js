import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

export { composeWeeklyLetter } from './weeklyLetterText';

const ID = 'weekly-letter';

// Sunday 6 PM: "Your week in review" pointing at the Insights tab.
// (expo-notifications weekday: 1 = Sunday.)
export function useWeeklyLetterReminder(enabled) {
  useEffect(() => {
    (async () => {
      try {
        await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
        if (!enabled) return;
        await Notifications.scheduleNotificationAsync({
          identifier: ID,
          content: { title: 'Your week in review', body: 'The almanac wrote you a short letter. It is on the Insights tab.' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0 },
        });
      } catch (err) {
        console.warn('Weekly letter reminder failed', err);
      }
    })();
  }, [enabled]);
}
