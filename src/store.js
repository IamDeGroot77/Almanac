import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey, todayKey } from './dates';
import { almanacToday, almanacDayKeyFromOffset, openDayKey } from './clock.js';
import { newId, DONE_RETENTION_MS } from './ids';

export { newId, DONE_RETENTION_MS };

// Storage layout (version 2):
// {
//   version: 2,
//   lists: [{ id, name, createdAt, updatedAt, googleListId? }],
//   tasks: [{ id, text, done, listId, createdAt, doneAt, updatedAt,
//             googleId?, googleListId?, googleUpdated? }],
//   localVersion: number,              // bumps on every user edit
//   sync: { lastSyncAt, syncedVersion, deletedTasks: [], deletedLists: [] },
// }
// A task's listId is either "day:YYYY-MM-DD" (a day list, created on demand)
// or the id of a standing list. Only standing lists sync with Google Tasks.

const STORAGE_KEY = 'almanac:v2';
const LEGACY_TASKS_KEY = 'tasks';
export const DAY_PREFIX = 'day:';
export const dayListId = (key) => `${DAY_PREFIX}${key}`;
export const isDayList = (listId) => listId.startsWith(DAY_PREFIX);
export const dayOfList = (listId) => listId.slice(DAY_PREFIX.length);
// Day lists follow the almanac day (clock.js): still Wednesday at 1 AM until Good night.
export const dayListIdForOffset = (offset) => dayListId(almanacDayKeyFromOffset(offset));

const LONG_DAY_MS = 20 * 60 * 60 * 1000;

const emptySync = () => ({ lastSyncAt: null, syncedVersion: 0, deletedTasks: [], deletedLists: [] });
const emptyState = () => ({
  version: 2,
  lists: [],
  tasks: [],
  timeLog: [], // finished, timed tasks: { id, taskId, text, listId, startedAt, doneAt, durationMs }
  // Who a task or list is for. Tasks/lists carry personId; null means "me".
  people: [
    { id: 'me', name: 'Me' },
    { id: 'zeke', name: 'Zeke' },
  ],
  routines: [], // see routines.js
  routineDone: {}, // routineId -> periodKey -> itemId -> true
  dayNotes: {}, // dayKey -> end-of-day note
  days: {}, // dayKey -> { wokeAt, sleptAt, implicit?, autoClosed?, lastActiveAt?, sleep?: { start, end } }
  sleepApplied: [], // detected sleep segments already folded in ("start-end")
  canvas: { courses: [], lastSyncAt: null }, // course grades from Canvas, see canvas/sync.js
  calendarEvents: {}, // taskId -> { eventId, key } for assignments mirrored to the calendar
  prefs: {
    focusApp: 'focusFriend', // hand-off apps, see apps.js
    timerApp: null,
    assignmentsToCalendar: false, // mirror Canvas assignments into a calendar
    assignmentCalendarId: null,
  },
  localVersion: 0,
  sync: emptySync(),
});

function migrateLegacy(saved) {
  const today = dayListId(todayKey());
  const list = Array.isArray(saved) ? saved : [];
  return {
    ...emptyState(),
    tasks: list.map((t) => ({
      id: String(t.id),
      text: t.text,
      done: !!t.done,
      listId: today,
      createdAt: Number(t.id) || Date.now(),
      doneAt: t.done ? Date.now() : null,
      updatedAt: 0,
    })),
  };
}

// Drop completed day-list tasks older than the retention window so storage
// doesn't grow forever. Unfinished tasks are never pruned; the morning review
// handles those. Synced tasks are left alone here; sync applies the same
// window when pulling from Google.
function prune(state) {
  const cutoff = Date.now() - DONE_RETENTION_MS;
  return {
    ...state,
    tasks: state.tasks.filter((t) => !(t.done && t.doneAt && t.doneAt < cutoff && isDayList(t.listId))),
  };
}

async function load() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    const base = emptyState();
    return prune({
      ...base,
      ...parsed,
      sync: { ...emptySync(), ...(parsed.sync || {}) },
      prefs: { ...base.prefs, ...(parsed.prefs || {}) },
    });
  }
  const legacy = await AsyncStorage.getItem(LEGACY_TASKS_KEY);
  if (legacy) {
    const migrated = migrateLegacy(JSON.parse(legacy));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    await AsyncStorage.removeItem(LEGACY_TASKS_KEY);
    return migrated;
  }
  return emptyState();
}

const tombstone = (t) => (t.googleId ? { googleListId: t.googleListId, googleId: t.googleId } : null);

const TIME_LOG_MAX = 2000;

// Mark a task done at `now`. If it had been started, record how long it took
// and append an entry to the time log for later analysis.
function finishIn(s, id, now) {
  const target = s.tasks.find((t) => t.id === id);
  if (!target || target.done) return {};
  const durationMs = target.startedAt ? Math.max(0, now - target.startedAt) : null;
  const tasks = s.tasks.map((t) =>
    t.id === id ? { ...t, done: true, doneAt: now, durationMs, updatedAt: now } : t
  );
  if (durationMs == null) return { tasks };
  const entry = {
    id: newId('log'),
    taskId: target.id,
    text: target.text,
    listId: target.listId,
    startedAt: target.startedAt,
    doneAt: now,
    durationMs,
    estimateMs: target.estimateMs ?? null,
    personId: target.personId || null,
    carriedCount: target.carriedCount || 0,
  };
  return { tasks, timeLog: [...(s.timeLog || []), entry].slice(-TIME_LOG_MAX) };
}

export function useAlmanacStore() {
  const [state, setState] = useState(emptyState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    load()
      .then(setState)
      .catch((err) => console.warn('Store load failed', err))
      .finally(() => setLoaded(true));
  }, []);

  // Persist after the initial load only, so the empty default never
  // overwrites saved data.
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((err) =>
      console.warn('Store save failed', err)
    );
  }, [state, loaded]);

  // A user edit: apply the partial and bump localVersion so sync notices.
  // Also keeps the day bracket honest when buttons get forgotten: an edit
  // with no open day starts today implicitly, and any edit stamps the open
  // day's lastActiveAt (used as the bedtime if Good night never comes).
  const edit = useCallback(
    (fn) =>
      setState((prev) => {
        const next = { ...prev, ...fn(prev), localVersion: prev.localVersion + 1 };
        const now = Date.now();
        const open = openDayKey(next.days);
        if (open) {
          next.days = { ...next.days, [open]: { ...next.days[open], lastActiveAt: now } };
        } else {
          // No open day: reopen today's if it was closed earlier (back up
          // after Good night), otherwise start it now.
          const key = dayKey(new Date());
          const existing = next.days[key];
          next.days = {
            ...next.days,
            [key]: existing?.wokeAt
              ? { ...existing, sleptAt: null, lastActiveAt: now }
              : { wokeAt: now, sleptAt: null, implicit: true, lastActiveAt: now },
          };
        }
        return next;
      }),
    []
  );

  const actions = useMemo(
    () => ({
      addTask(text, listId, personId = null) {
        const trimmed = text.trim();
        if (!trimmed) return;
        const now = Date.now();
        edit((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: newId('t'),
              text: trimmed,
              done: false,
              listId,
              personId: personId === 'me' ? null : personId,
              createdAt: now,
              doneAt: null,
              updatedAt: now,
            },
          ],
        }));
      },
      setTaskPerson(id, personId) {
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, personId: personId === 'me' ? null : personId, updatedAt: now } : t
          ),
        }));
      },
      setListPerson(id, personId) {
        edit((s) => ({
          lists: s.lists.map((l) =>
            l.id === id ? { ...l, personId: personId === 'me' ? null : personId } : l
          ),
        }));
      },
      addPerson(name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        edit((s) => ({ people: [...s.people, { id: newId('p'), name: trimmed }] }));
      },
      // ----- due dates & estimates -----
      setTaskDue(id, due, dueTime) {
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, due: due || null, dueTime: due ? dueTime || null : null, updatedAt: now } : t
          ),
        }));
      },
      setTaskEstimate(id, estimateMs) {
        edit((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, estimateMs: estimateMs || null } : t)),
        }));
      },
      // ----- routines -----
      saveRoutine(routine) {
        edit((s) => {
          const exists = s.routines.some((r) => r.id === routine.id);
          const clean = { ...routine, personId: routine.personId === 'me' ? null : routine.personId || null };
          return {
            routines: exists
              ? s.routines.map((r) => (r.id === routine.id ? clean : r))
              : [...s.routines, { ...clean, id: clean.id || newId('r'), createdAt: Date.now() }],
          };
        });
      },
      deleteRoutine(id) {
        edit((s) => {
          const { [id]: _gone, ...rest } = s.routineDone || {};
          return { routines: s.routines.filter((r) => r.id !== id), routineDone: rest };
        });
      },
      toggleRoutineItem(routineId, periodKey, itemId) {
        edit((s) => {
          const forRoutine = s.routineDone?.[routineId] || {};
          const forPeriod = { ...(forRoutine[periodKey] || {}) };
          if (forPeriod[itemId]) delete forPeriod[itemId];
          else forPeriod[itemId] = Date.now();
          return {
            routineDone: { ...s.routineDone, [routineId]: { ...forRoutine, [periodKey]: forPeriod } },
          };
        });
      },
      // ----- day bracket -----
      // These bypass `edit` so they don't stamp activity or implicitly start days.
      startDay(key) {
        setState((s) => ({
          ...s,
          days: { ...s.days, [key]: { ...(s.days[key] || {}), wokeAt: Date.now(), sleptAt: null, implicit: false } },
        }));
      },
      endDay(key) {
        setState((s) => ({
          ...s,
          days: { ...s.days, [key]: { ...(s.days[key] || {}), sleptAt: Date.now(), autoClosed: false } },
        }));
      },
      reopenDay(key) {
        setState((s) => ({ ...s, days: { ...s.days, [key]: { ...(s.days[key] || {}), sleptAt: null } } }));
      },
      // A detected sleep segment from the phone. Sets the bedtime on the
      // night's day and the wake time on the morning's day, but only where
      // the existing value was guessed or missing, or is far from the
      // detection. Also records the segment on the wake day for insights.
      applyDetectedSleep(seg, tolerance) {
        setState((s) => {
          const id = `${seg.start}-${seg.end}`;
          if (s.sleepApplied?.includes(id)) return s;
          const days = { ...s.days };
          const wakeDate = new Date(seg.end);
          const wakeKey = dayKey(wakeDate);
          const bedDate = new Date(seg.start);
          if (bedDate.getHours() < 6) bedDate.setDate(bedDate.getDate() - 1);
          const bedKey = dayKey(bedDate);
          const far = (a, b) => a == null || Math.abs(a - b) > tolerance;

          const night = days[bedKey];
          if (night?.wokeAt && (night.autoClosed || !night.sleptAt || (far(night.sleptAt, seg.start) && night.implicitClose))) {
            days[bedKey] = { ...night, sleptAt: seg.start, autoClosed: false, sleepDetected: true };
          }
          const morning = days[wakeKey] || {};
          if (!morning.wokeAt || (morning.implicit && far(morning.wokeAt, seg.end))) {
            days[wakeKey] = { ...morning, wokeAt: seg.end, sleptAt: morning.sleptAt ?? null, implicit: false, wakeDetected: true };
          }
          days[wakeKey] = { ...(days[wakeKey] || {}), sleep: { start: seg.start, end: seg.end } };
          return { ...s, days, sleepApplied: [...(s.sleepApplied || []), id].slice(-200) };
        });
      },
      // Result of a Canvas pull computed from an earlier snapshot; same merge
      // rules as applySyncResult. Counts as a local edit so Google sync
      // carries the School list across.
      applyCanvasResult(result) {
        const snapTasks = new Set(result.snapshotTaskIds);
        const snapLists = new Set(result.snapshotListIds);
        edit((prev) => ({
          lists: [...result.lists, ...prev.lists.filter((l) => !snapLists.has(l.id))],
          tasks: [...result.tasks, ...prev.tasks.filter((t) => !snapTasks.has(t.id))],
          canvas: result.canvas,
        }));
      },
      setPref(key, value) {
        setState((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));
      },
      linkCalendarEvent(taskId, eventId, key, weekAlert = false) {
        setState((s) => ({
          ...s,
          calendarEvents: { ...(s.calendarEvents || {}), [taskId]: { eventId, key, weekAlert } },
        }));
      },
      unlinkCalendarEvent(taskId) {
        setState((s) => {
          const { [taskId]: _gone, ...rest } = s.calendarEvents || {};
          return { ...s, calendarEvents: rest };
        });
      },
      setTaskPhoneFree(id, phoneFree) {
        setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, phoneFree: !!phoneFree } : t)) }));
      },
      // Forgot Good night: close a day that's been open 20h+ once the date
      // has moved on, using the last activity as the bedtime.
      autoCloseStaleDay() {
        setState((s) => {
          const open = openDayKey(s.days);
          if (!open) return s;
          const d = s.days[open];
          const now = Date.now();
          if (now - d.wokeAt < LONG_DAY_MS || open >= dayKey(new Date())) return s;
          const sleptAt = Math.max(d.lastActiveAt || 0, d.wokeAt + 60000);
          return { ...s, days: { ...s.days, [open]: { ...d, sleptAt, autoClosed: true, implicitClose: true } } };
        });
      },
      // ----- end of day -----
      setDayNote(key, text) {
        edit((s) => ({ dayNotes: { ...s.dayNotes, [key]: text } }));
      },
      pushOpenToTomorrow(fromKey) {
        const from = dayListId(fromKey);
        const to = dayListId(almanacDayKeyFromOffset(1));
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks.map((t) =>
            t.listId === from && !t.done ? { ...t, listId: to, startedAt: null, updatedAt: now } : t
          ),
        }));
      },
      // Instant check-off (or undo). Works whether or not the task was started.
      toggleTask(id) {
        const now = Date.now();
        edit((s) => {
          const target = s.tasks.find((t) => t.id === id);
          if (!target) return {};
          if (target.done) {
            return {
              tasks: s.tasks.map((t) =>
                t.id === id
                  ? { ...t, done: false, doneAt: null, startedAt: null, durationMs: null, updatedAt: now }
                  : t
              ),
            };
          }
          return finishIn(s, id, now);
        });
      },
      startTask(id) {
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id && !t.done ? { ...t, startedAt: now, updatedAt: now } : t
          ),
        }));
      },
      finishTask(id) {
        edit((s) => finishIn(s, id, Date.now()));
      },
      deleteTask(id) {
        edit((s) => {
          const gone = s.tasks.find((t) => t.id === id);
          const stone = gone && tombstone(gone);
          return {
            tasks: s.tasks.filter((t) => t.id !== id),
            sync: stone ? { ...s.sync, deletedTasks: [...s.sync.deletedTasks, stone] } : s.sync,
          };
        });
      },
      moveTask(id, listId) {
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, listId, updatedAt: now } : t)),
        }));
      },
      clearCompleted(listId) {
        edit((s) => {
          const gone = s.tasks.filter((t) => t.listId === listId && t.done);
          const stones = gone.map(tombstone).filter(Boolean);
          return {
            tasks: s.tasks.filter((t) => !(t.listId === listId && t.done)),
            sync: { ...s.sync, deletedTasks: [...s.sync.deletedTasks, ...stones] },
          };
        });
      },
      addList(name, personId = null) {
        const trimmed = name.trim();
        if (!trimmed) return;
        const now = Date.now();
        edit((s) => ({
          lists: [
            ...s.lists,
            {
              id: newId('l'),
              name: trimmed,
              personId: personId === 'me' ? null : personId,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
      },
      renameList(id, name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        const now = Date.now();
        edit((s) => ({
          lists: s.lists.map((l) => (l.id === id ? { ...l, name: trimmed, updatedAt: now } : l)),
        }));
      },
      deleteList(id) {
        edit((s) => {
          const list = s.lists.find((l) => l.id === id);
          return {
            lists: s.lists.filter((l) => l.id !== id),
            tasks: s.tasks.filter((t) => t.listId !== id),
            sync: list?.googleListId
              ? { ...s.sync, deletedLists: [...s.sync.deletedLists, list.googleListId] }
              : s.sync,
          };
        });
      },
      // Developer helper: pretend today's open tasks were left over from
      // yesterday so the start-of-day review can be exercised on demand.
      devBackdateOpenTasks() {
        const today = dayListId(almanacToday());
        const yesterday = dayListId(almanacDayKeyFromOffset(-1));
        edit((s) => ({
          tasks: s.tasks.map((t) =>
            t.listId === today && !t.done ? { ...t, listId: yesterday } : t
          ),
        }));
      },
      // Morning review: carry the given tasks to today, drop the rest.
      applyReview(carryIds, dropIds) {
        const today = dayListId(almanacToday());
        const carry = new Set(carryIds);
        const drop = new Set(dropIds);
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks
            .filter((t) => !drop.has(t.id))
            // A timer left running overnight is meaningless; carried tasks start
            // fresh. carriedCount feeds the "what keeps slipping" insight.
            .map((t) =>
              carry.has(t.id)
                ? { ...t, listId: today, startedAt: null, updatedAt: now, carriedCount: (t.carriedCount || 0) + 1 }
                : t
            ),
        }));
      },
      // Result of a Google sync computed from an earlier snapshot. Anything
      // the user created while the sync ran is kept; edits to snapshot items
      // during the sync are re-synced on the next pass via localVersion.
      applySyncResult(result) {
        const snapTasks = new Set(result.snapshotTaskIds);
        const snapLists = new Set(result.snapshotListIds);
        setState((prev) => ({
          ...prev,
          lists: [...result.lists, ...prev.lists.filter((l) => !snapLists.has(l.id))],
          tasks: [...result.tasks, ...prev.tasks.filter((t) => !snapTasks.has(t.id))],
          sync: {
            ...result.sync,
            // Keep tombstones created while the sync was running: the sync
            // consumed the first N, anything after those is still pending.
            deletedTasks: prev.sync.deletedTasks.slice(result.consumedDeletedTasks),
            deletedLists: prev.sync.deletedLists.slice(result.consumedDeletedLists),
          },
        }));
      },
    }),
    [edit]
  );

  return { ...state, loaded, ...actions };
}

// Unfinished tasks on day lists dated before today, oldest day first.
export function pastUnfinished(tasks, today = almanacToday()) {
  return tasks
    .filter((t) => !t.done && isDayList(t.listId) && dayOfList(t.listId) < today)
    .sort(
      (a, b) =>
        dayOfList(a.listId).localeCompare(dayOfList(b.listId)) || a.createdAt - b.createdAt
    );
}

// Effective person id for a task or list (null means "me").
export const personOf = (item) => item.personId || 'me';

export function personName(people, personId) {
  const p = people.find((x) => x.id === (personId || 'me'));
  return p ? p.name : 'Me';
}

// Guess a person from a list name, e.g. "Zeke School" -> zeke. Used for lists
// that arrive from Google, where there's no other signal.
export function guessPersonFromName(people, name) {
  const lower = (name || '').toLowerCase();
  const hit = people.find((p) => p.id !== 'me' && lower.includes(p.name.toLowerCase()));
  return hit ? hit.id : null;
}

export function tasksForList(tasks, listId) {
  const inList = tasks.filter((t) => t.listId === listId);
  const open = inList.filter((t) => !t.done);
  const done = inList.filter((t) => t.done);
  return { open, done, all: [...open, ...done] };
}
