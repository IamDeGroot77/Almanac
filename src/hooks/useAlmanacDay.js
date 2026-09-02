import { useEffect } from 'react';
import { AppState } from 'react-native';
import { dayKey, parseDayKey } from '../dates';
import { setAlmanacToday, openDayKey, lastClosedDay } from '../clock';

// The day you're in: the one opened with "I'm up" and not yet closed, even
// past midnight; otherwise the calendar date. Publishes it to clock.js for
// every helper that needs "today", and keeps a forgotten Good night from
// leaving a day open forever.
export default function useAlmanacDay(store) {
  const calendarToday = dayKey(new Date());
  const openKey = openDayKey(store.days);
  const today = openKey && openKey <= calendarToday ? openKey : calendarToday;
  setAlmanacToday(today);

  useEffect(() => {
    store.autoCloseStaleDay();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && store.autoCloseStaleDay());
    const timer = setInterval(store.autoCloseStaleDay, 5 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loaded]);

  return {
    today,
    calendarToday,
    pastMidnight: today !== calendarToday,
    openKey,
    openDay: openKey ? { key: openKey, ...store.days[openKey] } : null,
    lastClosed: lastClosedDay(store.days),
    dayLabel: parseDayKey(today).toLocaleDateString([], { weekday: 'long' }),
  };
}
