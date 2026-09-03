import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
// Current class-based expo-calendar API. It only works in a development or
// production build (not Expo Go), which is what this app targets.
// Docs: https://docs.expo.dev/versions/v57.0.0/sdk/calendar/
import * as Calendar from 'expo-calendar';
import { parseDayKey, formatTime } from './dates';
import { isWeb } from './platform';

// A native call that never answers (a permission prompt asked while the
// activity was not on screen, a provider that stalls) must not pin the
// spinner and "Loading your calendar" forever.
const LOAD_TIMEOUT_MS = 15000;
const withTimeout = (p, label) =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), LOAD_TIMEOUT_MS))]);

// Loads the calendar events for the day at `offset` from the almanac day
// (`baseKey`, YYYY-MM-DD): 0 = today, 1 = tomorrow.
export default function useCalendarEvents(offset, baseKey) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | granted | denied | error
  const [refreshing, setRefreshing] = useState(false);
  const [calendarNames, setCalendarNames] = useState([]);
  const statusRef = useRef(status);
  statusRef.current = status;
  const seq = useRef(0);

  const load = useCallback(async (which, base = baseKey) => {
    if (isWeb) {
      setStatus('unavailable');
      setEvents([]);
      return;
    }
    const mine = ++seq.current;
    try {
      // Check first; only ask when the app is actually on screen, since a
      // prompt raised from the background never resolves.
      let perm = await withTimeout(Calendar.getCalendarPermissions(), 'Calendar permission check');
      if (perm.status !== 'granted') {
        if (AppState.currentState !== 'active') throw new Error('Calendar permission needs the app on screen');
        perm = await withTimeout(Calendar.requestCalendarPermissions(), 'Calendar permission request');
      }
      if (perm.status !== 'granted') {
        setStatus('denied');
        setEvents([]);
        return;
      }

      const calendars = await withTimeout(Calendar.getCalendars(Calendar.EntityTypes.EVENT), 'Calendar list');
      const start = parseDayKey(base);
      start.setDate(start.getDate() + which);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const found = await withTimeout(Calendar.listEvents(calendars, start, end), 'Event list');
      if (mine !== seq.current) return; // a newer load superseded this one
      setCalendarNames(calendars.map((c) => c.title || c.name || c.id));
      console.log(
        `Calendar: ${calendars.length} calendars, ${found.length} events for ${start.toDateString()}`
      );

      const sorted = [...found].sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return new Date(a.startDate) - new Date(b.startDate);
      });

      setEvents(
        sorted.map((ev) => ({
          id: ev.id,
          title: ev.title || '(Untitled)',
          allDay: !!ev.allDay,
          time: ev.allDay ? 'All day' : formatTime(ev.startDate),
          startMs: new Date(ev.startDate).getTime(),
          endMs: ev.endDate ? new Date(ev.endDate).getTime() : null,
          location: ev.location || null,
        }))
      );
      setStatus('granted');
    } catch (err) {
      if (mine !== seq.current) return;
      console.warn('Calendar load failed', err?.message || err);
      setStatus('error');
      setEvents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);

  useEffect(() => {
    load(offset, baseKey);
  }, [offset, baseKey, load]);

  // Coming back to the screen after a failed or stalled load tries again.
  useEffect(() => {
    if (isWeb) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && (statusRef.current === 'error' || statusRef.current === 'loading')) load(offset, baseKey);
    });
    return () => sub.remove();
  }, [offset, baseKey, load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(offset, baseKey);
    } finally {
      setRefreshing(false);
    }
  }, [offset, baseKey, load]);

  const retry = useCallback(() => load(offset, baseKey), [offset, baseKey, load]);

  return { events, status, refreshing, refresh, retry, calendarNames };
}
