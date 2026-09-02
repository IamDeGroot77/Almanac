import { useCallback, useEffect, useRef } from 'react';
import * as Calendar from 'expo-calendar';
import { parseDayKey } from './dates';
import { isWeb } from './platform';

// Mirrors Canvas assignments into a calendar of your choosing on the phone
// (normally your Google account's calendar, so it reaches Google Calendar and
// anything that reads it). One event per assignment with a due date; kept in
// step as names, dates, and completion change; removed when the assignment
// goes away. Links between tasks and events live in state.calendarEvents.

const DEBOUNCE_MS = 4000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MONTH_MS = 30 * DAY;

// Alerts, in minutes before the event: a day and an hour before everything,
// and a week before anything that was more than a month out when it was
// first put on the calendar (remembered on the link so it doesn't vanish
// once the date gets closer).
const ALERT_DAY = -24 * 60;
const ALERT_HOUR = -60;
const ALERT_WEEK = -7 * 24 * 60;

function eventKey(task) {
  return [task.text, task.canvasCourse || '', task.canvasDueAt || task.due, task.dueTime || '', task.done ? 1 : 0].join('|');
}

// When the deadline actually is, as a Date. Canvas gives an exact instant;
// a hand-set due date without a time is treated as end of that day.
function deadlineOf(task) {
  if (task.canvasDueAt) return new Date(task.canvasDueAt);
  const d = parseDayKey(task.due);
  if (task.dueTime) {
    const [h, m] = task.dueTime.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(23, 59, 0, 0);
  }
  return d;
}

function eventDetails(task, { weekAlert }) {
  const deadline = deadlineOf(task);
  // A timed hour ending at the deadline, so "one hour before" is unambiguous.
  const end = deadline;
  const start = new Date(deadline.getTime() - HOUR);
  const title = `${task.done ? '✓ ' : ''}Due: ${task.text}${task.canvasCourse ? ` · ${task.canvasCourse}` : ''}`;
  const notes = [
    task.canvasPoints != null ? `${task.canvasPoints} points` : null,
    task.canvasUrl || null,
    'Added by Almanac from Canvas.',
  ]
    .filter(Boolean)
    .join('\n');
  // Alerts are relative to the event start (one hour before the deadline).
  const alarms = [{ relativeOffset: ALERT_DAY + 60 }, { relativeOffset: ALERT_HOUR + 60 }];
  if (weekAlert) alarms.push({ relativeOffset: ALERT_WEEK + 60 });
  return { title, startDate: start, endDate: end, allDay: false, notes, alarms };
}

const isFarOut = (task) => deadlineOf(task).getTime() - Date.now() > MONTH_MS;

export default function useAssignmentCalendar(store, { enabled, calendarId }) {
  const storeRef = useRef(store);
  storeRef.current = store;
  const inFlight = useRef(false);
  const queued = useRef(false);

  const reconcile = useCallback(async () => {
    const current = storeRef.current;
    if (isWeb || !current.loaded || !enabled || !calendarId) return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
      const cal = calendars.find((c) => c.id === calendarId);
      if (!cal) return;

      const links = current.calendarEvents || {};
      const wanted = current.tasks.filter((t) => t.canvasId && t.due);
      const wantedIds = new Set(wanted.map((t) => t.id));

      // Remove events for tasks that are gone or lost their date.
      for (const [taskId, link] of Object.entries(links)) {
        if (wantedIds.has(taskId)) continue;
        try {
          const ev = await Calendar.ExpoCalendarEvent.get(link.eventId);
          await ev.delete();
        } catch {}
        current.unlinkCalendarEvent(taskId);
      }

      // Create or update the rest.
      for (const t of wanted) {
        const key = eventKey(t);
        const link = links[t.id];
        if (link && link.key === key) continue;
        const weekAlert = link ? !!link.weekAlert : isFarOut(t);
        const details = eventDetails(t, { weekAlert });
        if (link) {
          try {
            const ev = await Calendar.ExpoCalendarEvent.get(link.eventId);
            await ev.update(details);
            current.linkCalendarEvent(t.id, link.eventId, key, weekAlert);
            continue;
          } catch {
            // Deleted by hand in the calendar app; fall through and recreate.
          }
        }
        const created = await cal.createEvent(details);
        current.linkCalendarEvent(t.id, created.id, key, weekAlert);
      }
    } catch (err) {
      console.warn('Assignment calendar sync failed', err);
    } finally {
      inFlight.current = false;
      if (queued.current) {
        queued.current = false;
        reconcile();
      }
    }
  }, [enabled, calendarId]);

  // Signature of everything that should trigger a pass.
  const signature = store.tasks
    .filter((t) => t.canvasId && t.due)
    .map((t) => `${t.id}:${eventKey(t)}`)
    .join(';');

  useEffect(() => {
    if (!enabled || !calendarId || !store.loaded) return;
    const timer = setTimeout(reconcile, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [signature, enabled, calendarId, store.loaded, reconcile]);

  // Turning the feature off removes what it added.
  const removeAll = useCallback(async () => {
    const current = storeRef.current;
    for (const [taskId, link] of Object.entries(current.calendarEvents || {})) {
      try {
        const ev = await Calendar.ExpoCalendarEvent.get(link.eventId);
        await ev.delete();
      } catch {}
      current.unlinkCalendarEvent(taskId);
    }
  }, []);

  return { reconcile, removeAll };
}

// Calendars you can write to, primary first.
export async function listWritableCalendars() {
  if (isWeb) return [];
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return calendars
    .filter((c) => c.allowsModifications)
    .map((c) => ({ id: c.id, title: c.title, owner: c.ownerAccount || c.source?.name || '', isPrimary: !!c.isPrimary }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.title.localeCompare(b.title));
}
