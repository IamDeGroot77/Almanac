import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { isWeb } from './platform';
import { registerNotificationHandler } from './notificationRouter';
import { SKIP_PROMPT } from './journal';
import { useRef } from 'react';

const CATEGORY = 'weekly-letter';
const ACTION_ANSWER = 'letter-answer';

export { composeWeeklyLetter } from './weeklyLetterText';

const ID = 'weekly-letter';

// Sunday 6 PM: "Your week in review" pointing at the Insights tab.
// (expo-notifications weekday: 1 = Sunday.)
export function useWeeklyLetterReminder(enabled, store) {
  const storeRef = useRef(store);
  storeRef.current = store;
  useEffect(
    () =>
      registerNotificationHandler('letter-', (response) => {
        const text = (response.userText || '').trim();
        if (text) storeRef.current?.addJournalEntry(text, { prompt: SKIP_PROMPT, source: 'letter' });
      }),
    []
  );
  useEffect(() => {
    if (isWeb) return;
    (async () => {
      try {
        await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
        if (!enabled) return;
        await Notifications.setNotificationCategoryAsync(CATEGORY, [
          { identifier: ACTION_ANSWER, buttonTitle: 'Answer', textInput: { submitButtonTitle: 'Save', placeholder: SKIP_PROMPT }, options: { opensAppToForeground: false } },
        ]);
        await Notifications.scheduleNotificationAsync({
          identifier: ID,
          content: { title: 'Your week in review', body: `The letter is on the Insights tab. One question: ${SKIP_PROMPT.toLowerCase()} Answer here and it goes in the journal.`, categoryIdentifier: CATEGORY },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0 },
        });
      } catch (err) {
        console.warn('Weekly letter reminder failed', err);
      }
    })();
  }, [enabled]);
}
