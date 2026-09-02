import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { formatTime } from './dates';

// Timed focus sessions (25 or 50 minutes, the body-doubling formats), with
// a "working alongside" notification that mirrors to the watch and a chime
// when the block ends. Also the hand-off link to Focusmate for the real,
// person-on-video version.

const END_ID = 'focus-session-end';
const LIVE_ID = 'focus-session-live';
export const FOCUSMATE_URL = 'https://www.focusmate.com/';

export default function useFocusSession() {
  const [session, setSession] = useState(null); // { taskId, text, minutes, endsAt }
  const timer = useRef(null);

  const clear = useCallback(async () => {
    setSession(null);
    if (timer.current) clearTimeout(timer.current);
    await Notifications.cancelScheduledNotificationAsync(END_ID).catch(() => {});
    await Notifications.dismissNotificationAsync(LIVE_ID).catch(() => {});
  }, []);

  const start = useCallback(
    async (task, minutes) => {
      await clear();
      const endsAt = Date.now() + minutes * 60000;
      setSession({ taskId: task.id, text: task.text, minutes, endsAt });
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: LIVE_ID,
          content: {
            title: `Focus: ${task.text}`,
            body: `${minutes} minutes, until ${formatTime(endsAt)}. Phone down.`,
            sticky: true,
            autoDismiss: false,
            sound: false,
          },
          trigger: null,
        });
        await Notifications.scheduleNotificationAsync({
          identifier: END_ID,
          content: { title: 'Session over', body: `${minutes} minutes on ${task.text}. Take five, then decide: again, or finish.` },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt) },
        });
      } catch (err) {
        console.warn('Focus session notification failed', err);
      }
      timer.current = setTimeout(() => {
        Notifications.dismissNotificationAsync(LIVE_ID).catch(() => {});
        setSession((s) => (s ? { ...s, ended: true } : s));
      }, minutes * 60000);
    },
    [clear]
  );

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const openFocusmate = () => Linking.openURL(FOCUSMATE_URL).catch(() => {});

  return { session, start, clear, openFocusmate };
}
