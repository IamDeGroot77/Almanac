import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { registerNotificationHandler } from './notificationRouter';
import { almanacToday } from './clock';

// Midday energy check-in as a notification with three buttons, so the answer
// takes one tap from the shade or the watch. Wake and bed check-ins live on
// the Today screen (DayBracket and the wrap-up card).

const CATEGORY = 'energy';
const PREFIX = 'energy-';
const ID = 'energy-midday';
const MIDDAY_HOUR = 13;

export async function ensureEnergyCategory() {
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: 'energy-1', buttonTitle: 'Low', options: { opensAppToForeground: false } },
    { identifier: 'energy-2', buttonTitle: 'Okay', options: { opensAppToForeground: false } },
    { identifier: 'energy-3', buttonTitle: 'Good', options: { opensAppToForeground: false } },
  ]);
}

export default function useEnergyCheckins(store, { enabled }) {
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(
    () =>
      registerNotificationHandler(PREFIX, (response) => {
        const value = Number(response.actionIdentifier.slice(PREFIX.length));
        if (![1, 2, 3].includes(value)) return;
        storeRef.current.setEnergy(almanacToday(), 'midday', value);
      }),
    []
  );

  useEffect(() => {
    if (!store.loaded) return;
    (async () => {
      try {
        if (!enabled) {
          await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
          return;
        }
        await ensureEnergyCategory();
        await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
        await Notifications.scheduleNotificationAsync({
          identifier: ID,
          content: { title: 'Midday check', body: "How's your energy right now?", categoryIdentifier: CATEGORY },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: MIDDAY_HOUR, minute: 0 },
        });
      } catch (err) {
        console.warn('Energy check-in scheduling failed', err);
      }
    })();
  }, [enabled, store.loaded]);
}
