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
  deleted: { tasks: {}, lists: {}, routines: {} }, // id -> deletedAt, for device-to-device sync
  dayNoteMeta: {}, // dayKey -> updatedAt
  prefsUpdatedAt: 0, // when a shared preference last changed
  driveRevision: 0, // revision of the Drive file this device last wrote
  usage: {}, // dayKey -> { opens } — this device only, never synced
  prefs: {
    focusApp: 'focusFriend', // hand-off apps, see apps.js
    timerApp: null,
    assignmentsToCalendar: false, // mirror Canvas assignments into a calendar
    assignmentCalendarId: null,
    quickAddNotification: false, // keep a "speak a task / note" notification in the shade
    checkinMinutes: 30, // "still working on this?" interval while a task runs; 0 = off
    energyCheckins: true, // midday energy notification
    healthSleep: false, // read watch sleep from Health Connect
    weeklyLetter: true, // Sunday 6 PM letter reminder
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

// Deletion markers for device-to-device sync (see drive/merge.js).
function markDeleted(deleted, kind, ids) {
  if (!ids.length) return deleted || { tasks: {}, lists: {}, routines: {} };
  const base = deleted || { tasks: {}, lists: {}, routines: {} };
  const now = Date.now();
  const next = { ...(base[kind] || {}) };
  for (const id of ids) next[id] = now;
  return { ...base, [kind]: next };
}

const SHARED_PREF_KEYS = ['weatherPlace', 'checkinMinutes', 'energyCheckins', 'weeklyLetter', 'focusApp', 'timerApp', 'healthSleep', 'bedtimeHour'];

const TIME_LOG_MAX = 2000;

// Mark a task done at `now`. If it had been started, record how long it took
// and append an entry to the time log for later analysis.
function finishIn(s, id, now) {
  const target = s.tasks.find((t) => t.id === id);
  if (!target || target.done) return {};
  // Time spent = earlier sessions (spentMs) plus the running one, if any.
  const running = target.startedAt ? Math.max(0, now - target.startedAt) : 0;
  const total = (target.spentMs || 0) + running;
  const durationMs = target.startedAt || target.spentMs ? total : null;
  const sessions = target.startedAt
    ? [...(target.sessions || []), { start: target.startedAt, end: now }]
    : target.sessions || [];
  const tasks = s.tasks.map((t) =>
    t.id === id
      ? { ...t, done: true, doneAt: now, durationMs, spentMs: total, startedAt: null, sessions, updatedAt: now }
      : t
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
      // Returns the new task's id.
      addTask(text, listId, personId = null) {
        const trimmed = text.trim();
        if (!trimmed) return null;
        const now = Date.now();
        const id = newId('t');
        edit((s) => ({
          tasks: [
            ...s.tasks,
            {
              id,
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
        return id;
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
          const clean = { ...routine, personId: routine.personId === 'me' ? null : routine.personId || null, updatedAt: Date.now() };
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
          return { routines: s.routines.filter((r) => r.id !== id), routineDone: rest, deleted: markDeleted(s.deleted, 'routines', [id]) };
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
      applyDetectedSleep(seg, tolerance, explicitId = null) {
        setState((s) => {
          const id = explicitId || `${seg.start}-${seg.end}`;
          if (s.sleepApplied?.includes(id)) return s;
          // Watch data (Health Connect) is measured; it may replace what the
          // phone inferred, but never a deliberate tap.
          const fromWatch = seg.source === 'health';
          const days = { ...s.days };
          const wakeDate = new Date(seg.end);
          const wakeKey = dayKey(wakeDate);
          const bedDate = new Date(seg.start);
          if (bedDate.getHours() < 6) bedDate.setDate(bedDate.getDate() - 1);
          const bedKey = dayKey(bedDate);
          const far = (a, b) => a == null || Math.abs(a - b) > tolerance;

          const night = days[bedKey];
          const nightOverridable =
            night?.autoClosed || !night?.sleptAt || (night?.implicitClose && far(night.sleptAt, seg.start)) ||
            (fromWatch && night?.sleepDetected && night?.sleepSource !== 'health');
          if (night?.wokeAt && nightOverridable) {
            days[bedKey] = { ...night, sleptAt: seg.start, autoClosed: false, sleepDetected: true, sleepSource: seg.source || 'phone' };
          }
          const morning = days[wakeKey] || {};
          const morningOverridable =
            !morning.wokeAt || (morning.implicit && far(morning.wokeAt, seg.end)) ||
            (fromWatch && morning.wakeDetected && morning.wakeSource !== 'health');
          if (morningOverridable) {
            days[wakeKey] = {
              ...morning,
              wokeAt: seg.end,
              sleptAt: morning.sleptAt ?? null,
              implicit: false,
              wakeDetected: true,
              wakeSource: seg.source || 'phone',
            };
          }
          const existing = days[wakeKey]?.sleep;
          if (!existing || fromWatch || existing.source !== 'health') {
            days[wakeKey] = { ...(days[wakeKey] || {}), sleep: { start: seg.start, end: seg.end, source: seg.source || 'phone' } };
          }
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
        setState((s) => ({
          ...s,
          prefs: { ...s.prefs, [key]: value },
          prefsUpdatedAt: SHARED_PREF_KEYS.includes(key) ? Date.now() : s.prefsUpdatedAt || 0,
          localVersion: SHARED_PREF_KEYS.includes(key) ? s.localVersion + 1 : s.localVersion,
        }));
      },
      // Stamps an app open on today's calendar date without bumping
      // localVersion, so opening the app never triggers a sync by itself.
      noteAppOpen() {
        const key = dayKey(new Date());
        setState((s) => {
          const usage = s.usage || {};
          const cur = usage[key] || { opens: 0 };
          return { ...s, usage: { ...usage, [key]: { ...cur, opens: cur.opens + 1, lastAt: Date.now() } } };
        });
      },
      setDriveRevision(revision) {
        setState((s) => ({ ...s, driveRevision: revision }));
      },
      // Result of merging with the Drive file. Replaces the shared slice;
      // device-only state (Google/Canvas/calendar bookkeeping, prefs that
      // aren't shared) stays. Tasks that vanished in the merge and had a
      // Google id get a tombstone so the phone removes them from Google too.
      applyDriveMerge(merged) {
        setState((s) => {
          const mergedIds = new Set(merged.tasks.map((t) => t.id));
          const stones = s.tasks.filter((t) => !mergedIds.has(t.id)).map(tombstone).filter(Boolean);
          const mergedListIds = new Set(merged.lists.map((l) => l.id));
          const listStones = s.lists.filter((l) => !mergedListIds.has(l.id) && l.googleListId).map((l) => l.googleListId);
          return {
            ...s,
            tasks: merged.tasks,
            lists: merged.lists,
            routines: merged.routines,
            people: merged.people,
            routineDone: merged.routineDone,
            timeLog: merged.timeLog,
            days: merged.days,
            dayNotes: merged.dayNotes,
            dayNoteMeta: merged.dayNoteMeta,
            deleted: merged.deleted,
            prefs: { ...s.prefs, ...(merged.sharedPrefs || {}) },
            prefsUpdatedAt: merged.prefsUpdatedAt || s.prefsUpdatedAt || 0,
            driveRevision: merged.revision || s.driveRevision || 0,
            sync: {
              ...s.sync,
              deletedTasks: [...s.sync.deletedTasks, ...stones],
              deletedLists: [...s.sync.deletedLists, ...listStones],
            },
          };
        });
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
        edit((s) => ({ dayNotes: { ...s.dayNotes, [key]: text }, dayNoteMeta: { ...(s.dayNoteMeta || {}), [key]: Date.now() } }));
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
                  ? { ...t, done: false, doneAt: null, startedAt: null, durationMs: null, spentMs: 0, sessions: [], updatedAt: now }
                  : t
              ),
            };
          }
          return finishIn(s, id, now);
        });
      },
      // Start, or resume after a pause. Earlier time is kept in spentMs.
      startTask(id) {
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id && !t.done && !t.startedAt ? { ...t, startedAt: now, updatedAt: now } : t
          ),
        }));
      },
      // Pause: bank the running session and stop the clock.
      pauseTask(id) {
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id && t.startedAt
              ? {
                  ...t,
                  spentMs: (t.spentMs || 0) + Math.max(0, now - t.startedAt),
                  sessions: [...(t.sessions || []), { start: t.startedAt, end: now }],
                  startedAt: null,
                  updatedAt: now,
                }
              : t
          ),
        }));
      },
      // Returns { parentReady: parentId } when this was the last open step.
      finishTask(id) {
        let result = { parentReady: null };
        edit((s) => {
          const target = s.tasks.find((t) => t.id === id);
          const partial = finishIn(s, id, Date.now());
          if (target?.parentId && partial.tasks) {
            const siblingsOpen = partial.tasks.some((t) => t.parentId === target.parentId && !t.done);
            const parent = partial.tasks.find((t) => t.id === target.parentId);
            if (!siblingsOpen && parent && !parent.done) result = { parentReady: parent.id };
          }
          return partial;
        });
        return result;
      },
      // Returns the removed task so it can be restored (Undo).
      // Deleting a task deletes its steps. Returns the removed tasks (Undo).
      deleteTask(id) {
        let removed = [];
        edit((s) => {
          const gone = s.tasks.filter((t) => t.id === id || t.parentId === id);
          removed = gone;
          const stones = gone.map(tombstone).filter(Boolean);
          const ids = new Set(gone.map((t) => t.id));
          return {
            tasks: s.tasks.filter((t) => !ids.has(t.id)),
            sync: stones.length ? { ...s.sync, deletedTasks: [...s.sync.deletedTasks, ...stones] } : s.sync,
            deleted: markDeleted(s.deleted, 'tasks', [...ids]),
          };
        });
        return removed;
      },
      // Put deleted tasks back and drop their pending Google deletions.
      restoreTasks(tasks) {
        if (!tasks?.length) return;
        const ids = new Set(tasks.map((t) => t.id));
        const googleIds = new Set(tasks.map((t) => t.googleId).filter(Boolean));
        edit((s) => ({
          tasks: [...s.tasks.filter((t) => !ids.has(t.id)), ...tasks],
          sync: { ...s.sync, deletedTasks: s.sync.deletedTasks.filter((d) => !googleIds.has(d.googleId)) },
        }));
      },
      // Implementation intention: when and where this will happen.
      setTaskPlan(id, plan) {
        edit((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, plan: (plan || '').trim() || null } : t)) }));
      },
      setTaskNotes(id, notes) {
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, notes: notes || '', updatedAt: now } : t)),
        }));
      },
      // Energy check-in: slot is 'wake' | 'midday' | 'bed', value 1..3.
      setEnergy(key, slot, value) {
        setState((s) => ({
          ...s,
          days: { ...s.days, [key]: { ...(s.days[key] || {}), energy: { ...(s.days[key]?.energy || {}), [slot]: value } } },
        }));
      },
      // Moving a task takes its steps along.
      moveTask(id, listId) {
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks.map((t) => (t.id === id || t.parentId === id ? { ...t, listId, updatedAt: now } : t)),
        }));
      },
      // ----- steps (sub-tasks) -----
      // Adds a step under a task; returns its id. Steps live on the parent's
      // list and person. Optional due date for backward-planned steps.
      addStep(parentId, text, due = null) {
        const trimmed = (text || '').trim();
        if (!trimmed) return null;
        const now = Date.now();
        const id = newId('t');
        edit((s) => {
          const parent = s.tasks.find((t) => t.id === parentId);
          if (!parent) return {};
          return {
            tasks: [
              ...s.tasks,
              {
                id,
                text: trimmed,
                done: false,
                listId: parent.listId,
                parentId,
                personId: parent.personId || null,
                due,
                dueTime: null,
                createdAt: now,
                doneAt: null,
                updatedAt: now,
              },
            ],
          };
        });
        return id;
      },
      // Returns the removed tasks so they can be restored (Undo).
      clearCompleted(listId) {
        let removed = [];
        edit((s) => {
          const doneTop = s.tasks.filter((t) => t.listId === listId && t.done && !t.parentId);
          const topIds = new Set(doneTop.map((t) => t.id));
          const gone = s.tasks.filter((t) => topIds.has(t.id) || topIds.has(t.parentId));
          removed = gone;
          const stones = gone.map(tombstone).filter(Boolean);
          return {
            tasks: s.tasks.filter((t) => !(topIds.has(t.id) || topIds.has(t.parentId))),
            sync: { ...s.sync, deletedTasks: [...s.sync.deletedTasks, ...stones] },
            deleted: markDeleted(s.deleted, 'tasks', gone.map((t) => t.id)),
          };
        });
        return removed;
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
          const goneTasks = s.tasks.filter((t) => t.listId === id).map((t) => t.id);
          return {
            lists: s.lists.filter((l) => l.id !== id),
            tasks: s.tasks.filter((t) => t.listId !== id),
            sync: list?.googleListId
              ? { ...s.sync, deletedLists: [...s.sync.deletedLists, list.googleListId] }
              : s.sync,
            deleted: markDeleted(markDeleted(s.deleted, 'lists', [id]), 'tasks', goneTasks),
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
          deleted: markDeleted(s.deleted, 'tasks', s.tasks.filter((t) => drop.has(t.id) || drop.has(t.parentId)).map((t) => t.id)),
          tasks: s.tasks
            .filter((t) => !drop.has(t.id) && !drop.has(t.parentId))
            .map((t) => (carry.has(t.parentId) ? { ...t, listId: today, startedAt: null, updatedAt: now } : t))
            // A timer left running overnight is meaningless; carried tasks start
            // fresh. carriedCount feeds the "what keeps slipping" insight.
            .map((t) =>
              carry.has(t.id)
                ? {
                    ...t,
                    listId: today,
                    // A clock left running overnight is dropped, but time banked
                    // before that (spentMs) carries with the task.
                    startedAt: null,
                    updatedAt: now,
                    carriedCount: (t.carriedCount || 0) + 1,
                  }
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
    .filter((t) => !t.done && !t.parentId && isDayList(t.listId) && dayOfList(t.listId) < today)
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


// Top-level tasks on a list (steps are rendered under their parent).
export function tasksForList(tasks, listId) {
  const inList = tasks.filter((t) => t.listId === listId && !t.parentId);
  const open = inList.filter((t) => !t.done);
  const done = inList.filter((t) => t.done);
  return { open, done, all: [...open, ...done] };
}
