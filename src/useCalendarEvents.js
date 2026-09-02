import { useCallback, useEffect, useState } from 'react';
// Current class-based expo-calendar API. It only works in a development or
// production build (not Expo Go), which is what this app targets.
// Docs: https://docs.expo.dev/versions/v57.0.0/sdk/calendar/
import * as Calendar from 'expo-calendar';
import { dayBounds, formatTime } from './dates';

// Loads the calendar events for the day at `offset` (0 = today, 1 = tomorrow).
export default function useCalendarEvents(offset) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | granted | denied | error
  const [refreshing, setRefreshing] = useState(false);
  const [calendarNames, setCalendarNames] = useState([]);

  const load = useCallback(async (which) => {
    try {
      const perm = await Calendar.requestCalendarPermissions();
      if (perm.status !== 'granted') {
        setStatus('denied');
        setEvents([]);
        return;
      }

      const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
      setCalendarNames(calendars.map((c) => c.title || c.name || c.id));
      const { start, end } = dayBounds(which);
      const found = await Calendar.listEvents(calendars, start, end);
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
          location: ev.location || null,
        }))
      );
      setStatus('granted');
    } catch (err) {
      console.warn('Calendar load failed', err);
      setStatus('error');
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    load(offset);
  }, [offset, load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(offset);
    setRefreshing(false);
  }, [offset, load]);

  const retry = useCallback(() => load(offset), [offset, load]);

  return { events, status, refreshing, refresh, retry, calendarNames };
}
