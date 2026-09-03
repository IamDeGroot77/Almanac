import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Calendar from 'expo-calendar';
import { matchRules } from './calendarRules';
import { isWeb } from './platform';

// Phone side of calendar rules: whenever the app comes forward, look at the
// last three days of events and make tasks for any finished event that
// matches a rule. Docs: https://docs.expo.dev/versions/v57.0.0/sdk/calendar/
const DAY = 86400000;
const MIN_INTERVAL_MS = 15 * 60 * 1000;
let lastRun = 0;

export default function useCalendarRules(store) {
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    if (!store.loaded || isWeb) return;
    const run = async () => {
      const s = storeRef.current;
      const rules = s.prefs.calendarRules || [];
      if (!rules.length) return;
      if (Date.now() - lastRun < MIN_INTERVAL_MS) return;
      lastRun = Date.now();
      try {
        const perm = await Calendar.getCalendarPermissions();
        if (perm.status !== 'granted') return;
        const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
        const now = Date.now();
        const found = await Calendar.listEvents(calendars, new Date(now - 3 * DAY), new Date(now));
        const events = found.map((ev) => ({
          id: ev.id,
          title: ev.title || '',
          startMs: new Date(ev.startDate).getTime(),
          endMs: ev.endDate ? new Date(ev.endDate).getTime() : null,
          location: ev.location || null,
        }));
        const made = matchRules(events, rules, s.eventTasks || {}, now);
        if (made.length) s.addEventTasks(made);
      } catch (err) {
        console.warn('Calendar rules failed', err);
      }
    };
    run();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    return () => sub.remove();
  }, [store.loaded, store.prefs.calendarRules]);
}
