import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey, todayKey } from './dates';
import { almanacToday, almanacDayKeyFromOffset, openDayKey } from './clock.js';
import { newId, DONE_RETENTION_MS } from './ids';
import { dueForHorizon } from './consider';
import { capacityFor } from './capacity';
import { dedupeLists } from './lists';
import { periodKey as periodKeyFor } from './routines';

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
const BACKUP_KEY = 'almanac:v2.bak';
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
  categories: [], // { id, name, color?, createdAt, updatedAt } — lists carry categoryId; see blocks.js
  routineDone: {}, // routineId -> periodKey -> itemId -> true
  routineLog: [], // timed routine items, see routines.js (shared)
  routineActive: null, // { routineId, itemId, text, startedAt } while a routine item is being timed (this device)
  dayNotes: {}, // dayKey -> end-of-day note
  journal: {}, // dayKey -> [{ id, at, text, prompt?, source, updatedAt? }], see journal.js
  scratch: [], // working memory, see scratch.js
  stuckLog: [], // { taskId, text, reason, at } from "Why am I stuck?" (shared)
  achievements: {}, // id -> earnedAt, see achievements.js (shared)
  days: {}, // dayKey -> { wokeAt, sleptAt, implicit?, autoClosed?, lastActiveAt?, sleep?: { start, end } }
  sleepApplied: [], // detected sleep segments already folded in ("start-end")
  canvas: { courses: [], lastSyncAt: null }, // course grades from Canvas, see canvas/sync.js
  calendarEvents: {}, // taskId -> { eventId, key } for assignments mirrored to the calendar
  deleted: { tasks: {}, lists: {}, routines: {} }, // id -> deletedAt, for device-to-device sync
  dayNoteMeta: {}, // dayKey -> updatedAt
  prefsUpdatedAt: 0, // when a shared preference last changed
  driveRevision: 0, // revision of the Drive file this device last wrote
  usage: {}, // dayKey -> { opens } — this device only, never synced
  eventTasks: {}, // 'eventId:ruleId' -> taskId, tasks made by calendar rules (phone only)
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
function prune(input) {
  const state = dedupeLists(input);
  const cutoff = Date.now() - DONE_RETENTION_MS;
  return {
    ...state,
    tasks: state.tasks.filter((t) => !(t.done && t.doneAt && t.doneAt < cutoff && !t.canvasId)),
  };
}

async function load() {
  let raw = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Store read failed, trying the backup', err?.message || err);
    raw = await AsyncStorage.getItem(BACKUP_KEY);
  }
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn('Store parse failed, trying the backup', err?.message || err);
      parsed = JSON.parse((await AsyncStorage.getItem(BACKUP_KEY)) || 'null');
      if (!parsed) throw err;
    }
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

const SHARED_PREF_KEYS = ['weatherPlace', 'checkinMinutes', 'energyCheckins', 'weeklyLetter', 'focusApp', 'timerApp', 'healthSleep', 'bedtimeHour', 'calendarRules', 'dayBlocks', 'dopamenu', 'quotes', 'wakeTarget'];

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
  const [loadFailed, setLoadFailed] = useState(false);
  const lastSaved = useRef(null);

  useEffect(() => {
    load()
      .then(setState)
      .catch((err) => {
        // Never let an empty default replace data we could not read.
        console.error('Store load failed; saving is off until the app restarts', err?.message || err);
        setLoadFailed(true);
      })
      .finally(() => setLoaded(true));
  }, []);

  // Persist after the initial load only, and never after a failed load. The
  // previous blob is kept as a backup so a bad write cannot take the data.
  useEffect(() => {
    if (!loaded || loadFailed) return;
    const json = JSON.stringify(state);
    if (json === lastSaved.current) return;
    (async () => {
      try {
        if (lastSaved.current) await AsyncStorage.setItem(BACKUP_KEY, lastSaved.current);
        await AsyncStorage.setItem(STORAGE_KEY, json);
        lastSaved.current = json;
      } catch (err) {
        console.error('Store save failed', err?.message || err);
      }
    })();
  }, [state, loaded, loadFailed]);

  // A user edit: apply the partial and bump localVersion so sync notices.
  // Also keeps the day bracket honest when buttons get forgotten: an edit
  // with no open day starts today implicitly, and any edit stamps the open
  // day's lastActiveAt (used as the bedtime if Good night never comes).
  const stateRef = useRef(state);
  stateRef.current = state;

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
        edit((s) => {
          const list = s.lists.find((l) => l.id === listId);
          const due = dueForHorizon(list, now);
          return {
            tasks: [
              ...s.tasks,
              {
                id,
                text: trimmed,
                done: false,
                listId,
                personId: personId === 'me' ? null : personId,
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
      // ----- categories -----
      addCategory(name) {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const now = Date.now();
        const id = newId('c');
        edit((s) => (s.categories?.some((c) => c.name.toLowerCase() === trimmed.toLowerCase()) ? {} : { categories: [...(s.categories || []), { id, name: trimmed, createdAt: now, updatedAt: now }] }));
        return id;
      },
      renameCategory(id, name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        edit((s) => ({ categories: (s.categories || []).map((c) => (c.id === id ? { ...c, name: trimmed, updatedAt: Date.now() } : c)) }));
      },
      deleteCategory(id) {
        const now = Date.now();
        edit((s) => ({
          categories: (s.categories || []).filter((c) => c.id !== id),
          lists: s.lists.map((l) => (l.categoryId === id ? { ...l, categoryId: null, updatedAt: now } : l)),
          prefs: { ...s.prefs, dayBlocks: (s.prefs.dayBlocks || []).filter((b) => b.categoryId !== id) },
          prefsUpdatedAt: now,
        }));
      },
      setListCategory(id, categoryId) {
        edit((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, categoryId: categoryId || null, updatedAt: Date.now() } : l)) }));
      },
      // Timeline lists: 30/90/180-day horizon (null clears it). Open tasks
      // without a date get one at the horizon.
      setListHorizon(id, horizonDays) {
        const now = Date.now();
        edit((s) => {
          const list = { ...s.lists.find((l) => l.id === id), horizonDays: horizonDays || null, updatedAt: now };
          return {
            lists: s.lists.map((l) => (l.id === id ? list : l)),
            tasks: s.tasks.map((t) => (t.listId === id && !t.done && !t.due && horizonDays ? { ...t, due: dueForHorizon(list, now), updatedAt: now } : t)),
          };
        });
      },
      // "Not yet" on a consideration: ask again after another nudge period.
      snoozeConsideration(id) {
        edit((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, nudgedAt: Date.now() } : t)) }));
      },
      // Tasks made by calendar rules (src/calendarRules.js), remembered by event.
      addEventTasks(made) {
        const now = Date.now();
        edit((s) => {
          const tasks = [...s.tasks];
          const eventTasks = { ...(s.eventTasks || {}) };
          let order = now;
          for (const m of made) {
            if (eventTasks[m.key]) continue;
            const id = newId('t');
            tasks.push({ id, text: m.text, done: false, listId: m.listId, personId: null, due: m.due || null, dueTime: null, notes: m.notes || null, createdAt: order, doneAt: null, updatedAt: now });
            eventTasks[m.key] = id;
            order += 1;
          }
          return { tasks, eventTasks };
        });
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
      // ----- tomorrow's one thing, replan, rest days -----
      setOneThing(key, taskId) {
        edit((s) => ({ days: { ...s.days, [key]: { ...(s.days[key] || {}), oneThing: taskId || null, lastActiveAt: Date.now() } } }));
      },
      // Moves today's open tasks to tomorrow, biggest estimates first and never
      // a running or due-today task, until the projected finish fits before
      // bedtime. Returns the ids moved, for undo.
      replanRestOfToday(todayKey, { bedtimeHour = 23 } = {}) {
        const from = dayListId(todayKey);
        const to = dayListId(almanacDayKeyFromOffset(1));
        const now = Date.now();
        const moved = [];
        edit((s) => {
          const open = s.tasks.filter((t) => t.listId === from && !t.done && !t.parentId);
          const movable = open.filter((t) => !t.startedAt && t.due !== todayKey).sort((a, b) => (b.estimateMs || 20 * 60000) - (a.estimateMs || 20 * 60000));
          let remaining = [...open];
          for (const t of movable) {
            const cap = capacityFor(remaining, { now, bedtimeHour });
            if (!cap || !cap.over) break;
            moved.push(t.id);
            remaining = remaining.filter((x) => x.id !== t.id);
          }
          if (!moved.length) return {};
          const set = new Set(moved);
          return {
            tasks: s.tasks.map((t) => (set.has(t.id) || set.has(t.parentId) ? { ...t, listId: to, carriedCount: t.parentId ? t.carriedCount : (t.carriedCount || 0) + 1, updatedAt: now } : t)),
          };
        });
        return moved;
      },
      toggleRestDay(key) {
        edit((s) => ({ days: { ...s.days, [key]: { ...(s.days[key] || {}), rest: !s.days[key]?.rest, lastActiveAt: Date.now() } } }));
      },
      // ----- working memory -----
      addScratch(text, source = 'typed') {
        const trimmed = (text || '').trim();
        if (!trimmed) return null;
        const now = Date.now();
        const id = newId('s');
        edit((s) => ({ scratch: [...(s.scratch || []), { id, text: trimmed, at: now, updatedAt: now, source }] }));
        return id;
      },
      editScratch(id, text) {
        const trimmed = (text || '').trim();
        if (!trimmed) return;
        edit((s) => ({ scratch: (s.scratch || []).map((n) => (n.id === id ? { ...n, text: trimmed, updatedAt: Date.now() } : n)) }));
      },
      removeScratch(id) {
        edit((s) => ({ scratch: (s.scratch || []).map((n) => (n.id === id ? { ...n, deleted: true, updatedAt: Date.now() } : n)) }));
      },
      clearStaleScratch() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const now = Date.now();
        edit((s) => ({ scratch: (s.scratch || []).map((n) => (!n.deleted && n.at < start.getTime() ? { ...n, deleted: true, updatedAt: now } : n)) }));
      },
      // ----- journal -----
      addJournalEntry(text, { prompt = null, source = 'typed', at = Date.now() } = {}) {
        const trimmed = (text || '').trim();
        if (!trimmed) return null;
        const key = almanacToday();
        const entry = { id: newId('j'), at, text: trimmed, prompt, source, updatedAt: at };
        edit((s) => ({ journal: { ...(s.journal || {}), [key]: [...((s.journal || {})[key] || []), entry] } }));
        return entry.id;
      },
      editJournalEntry(key, id, text) {
        const trimmed = (text || '').trim();
        edit((s) => ({
          journal: { ...(s.journal || {}), [key]: ((s.journal || {})[key] || []).map((e) => (e.id === id ? { ...e, text: trimmed || e.text, updatedAt: Date.now() } : e)) },
        }));
      },
      deleteJournalEntry(key, id) {
        edit((s) => ({
          journal: { ...(s.journal || {}), [key]: ((s.journal || {})[key] || []).map((e) => (e.id === id ? { ...e, deleted: true, updatedAt: Date.now() } : e)) },
        }));
      },
      awardAchievements(ids) {
        if (!ids?.length) return;
        const now = Date.now();
        edit((s) => {
          const next = { ...(s.achievements || {}) };
          for (const id of ids) if (!next[id]) next[id] = now;
          return { achievements: next };
        });
      },
      // Spend a skip token on an item (or take it back).
      skipRoutineItem(routineId, periodKey, itemId) {
        edit((s) => {
          const forRoutine = s.routineDone?.[routineId] || {};
          const forPeriod = { ...(forRoutine[periodKey] || {}) };
          if (forPeriod[itemId] === -1) delete forPeriod[itemId];
          else forPeriod[itemId] = -1;
          return { routineDone: { ...s.routineDone, [routineId]: { ...forRoutine, [periodKey]: forPeriod } } };
        });
      },
      // "Why am I stuck?" answer, kept on the task and in a log for patterns.
      setTaskStuck(id, reason) {
        const now = Date.now();
        edit((s) => {
          const t = s.tasks.find((x) => x.id === id);
          return {
            tasks: s.tasks.map((x) => (x.id === id ? { ...x, stuck: { reason, at: now }, updatedAt: now } : x)),
            stuckLog: [...(s.stuckLog || []), { taskId: id, text: t?.text || '', reason, at: now }].slice(-500),
          };
        });
      },
      // ----- timed routine items -----
      startRoutineItem(routineId, itemId, text) {
        setState((s) => ({ ...s, routineActive: { routineId, itemId, text, startedAt: Date.now() } }));
      },
      // Minutes reported after the fact ("did 20 minutes of exercise"), logged
      // as one entry ending now.
      logRoutineMinutes(routineId, minutes, text) {
        const ms = Math.max(1, Math.round(minutes)) * 60000;
        const now = Date.now();
        const entry = { id: newId('rl'), routineId, itemId: 'reported', text: text || 'Reported', startedAt: now - ms, endedAt: now, durationMs: ms, reported: true };
        edit((s) => ({ routineLog: [...(s.routineLog || []), entry].slice(-2000) }));
        return entry;
      },
      cancelRoutineItem() {
        setState((s) => ({ ...s, routineActive: null }));
      },
      // Logs the elapsed time, ticks the item, and returns the entry. Under a
      // minute logs nothing; over three hours is a forgotten timer, also nothing.
      finishRoutineItem({ minMs = 60000, maxMs = 3 * 3600000 } = {}) {
        const active = stateRef.current.routineActive;
        if (!active) return null;
        const now = Date.now();
        const durationMs = now - active.startedAt;
        if (durationMs < minMs || durationMs > maxMs) {
          setState((s) => ({ ...s, routineActive: null }));
          return { ...active, durationMs, skipped: true };
        }
        const entry = { id: newId('rl'), routineId: active.routineId, itemId: active.itemId, text: active.text, startedAt: active.startedAt, endedAt: now, durationMs };
        edit((s) => {
          const routine = s.routines.find((r) => r.id === active.routineId);
          const next = { routineLog: [...(s.routineLog || []), entry].slice(-2000), routineActive: null };
          if (routine && active.itemId !== 'warmup') {
            const key = periodKeyFor(routine);
            const forRoutine = s.routineDone?.[routine.id] || {};
            next.routineDone = { ...s.routineDone, [routine.id]: { ...forRoutine, [key]: { ...(forRoutine[key] || {}), [active.itemId]: now } } };
          }
          return next;
        });
        return entry;
      },
      // ----- day bracket -----
      // These bypass `edit` so they don't stamp activity or implicitly start days.
      startDay(key, at = Date.now()) {
        setState((s) => ({
          ...s,
          days: { ...s.days, [key]: { ...(s.days[key] || {}), wokeAt: at, sleptAt: null, implicit: false, autoStarted: false } },
        }));
      },
      // From planAutoStart: close a stale day and open today, bypassing edit.
      applyAutoStart(plan) {
        setState((s) => {
          const days = { ...s.days };
          if (plan.closeKey && days[plan.closeKey] && !days[plan.closeKey].sleptAt) {
            days[plan.closeKey] = { ...days[plan.closeKey], sleptAt: plan.closeAt, autoClosed: true, implicitClose: true };
          }
          days[plan.startKey] = {
            ...(days[plan.startKey] || {}),
            wokeAt: plan.wokeAt,
            sleptAt: null,
            implicit: false,
            autoStarted: true,
            wakeSource: plan.source === 'sleep' ? days[plan.startKey]?.sleep?.source || 'phone' : 'open',
            lastActiveAt: Date.now(),
          };
          return { ...s, days };
        });
      },
      // `at` is the bedtime: now for a tap in the app, or when the bedtime
      // notification was shown for a tap replayed the next morning.
      endDay(key, at = Date.now()) {
        setState((s) => {
          const now = Date.now();
          const openLeft = s.tasks.some((t) => !t.done && !t.parentId && t.listId === dayListId(key));
          // A timer left running at bedtime is banked, not left ticking all night.
          const tasks = s.tasks.map((t) =>
            t.startedAt && !t.done && t.startedAt < at
              ? { ...t, spentMs: (t.spentMs || 0) + Math.max(0, at - t.startedAt), sessions: [...(t.sessions || []), { start: t.startedAt, end: at }], startedAt: null, updatedAt: now }
              : t
          );
          return {
            ...s,
            tasks,
            days: { ...s.days, [key]: { ...(s.days[key] || {}), sleptAt: at, autoClosed: false, implicitClose: false, cleanSlate: !openLeft } },
          };
        });
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
            !morning.wokeAt || ((morning.implicit || morning.autoStarted) && far(morning.wokeAt, seg.end)) ||
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
            t.listId === from && !t.done ? { ...t, listId: to, startedAt: null, carriedCount: t.parentId ? t.carriedCount : (t.carriedCount || 0) + 1, updatedAt: now } : t
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
      setTaskSlot(id, slot) {
        edit((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, slot: slot || null, updatedAt: Date.now() } : t)) }));
      },
      setTaskFirstStep(id, firstStep) {
        edit((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, firstStep: (firstStep || '').trim() || null, updatedAt: Date.now() } : t)) }));
      },
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
          tasks: s.tasks.map((t) => {
            if (t.id !== id && t.parentId !== id) return t;
            // Moving an open task from one day list to a later one is a carry.
            const carried = t.id === id && !t.done && isDayList(t.listId) && isDayList(listId) && dayOfList(listId) > dayOfList(t.listId);
            return { ...t, listId, startedAt: carried ? null : t.startedAt, carriedCount: carried ? (t.carriedCount || 0) + 1 : t.carriedCount, updatedAt: now };
          }),
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
      addList(name, personId = null, categoryId = null) {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const now = Date.now();
        const id = newId('l');
        edit((s) => ({
          lists: [
            ...s.lists,
            {
              id,
              name: trimmed,
              personId: personId === 'me' ? null : personId,
              categoryId: categoryId || null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return id;
      },
      // Applies a plan from src/importText.js in one edit: creates any new
      // lists, then the tasks and their steps. Returns what it added.
      importPlan(plan) {
        const now = Date.now();
        const added = { lists: 0, tasks: 0, steps: 0, routines: 0 };
        edit((s) => {
          const lists = [...s.lists];
          const tasks = [...s.tasks];
          const routines = [...s.routines];
          let order = now;
          const byName = (arr, name) => arr.find((x) => x.name.trim().toLowerCase() === (name || '').trim().toLowerCase());
          const categories = [...(s.categories || [])];
          const categoryIdFor = (name) => {
            if (!name) return null;
            let c = byName(categories, name);
            if (!c) {
              c = { id: newId('c'), name, createdAt: now, updatedAt: now };
              categories.push(c);
              added.categories = (added.categories || 0) + 1;
            }
            return c.id;
          };
          // Categories and lists first (routines may quota from lists), then routines, then tasks.
          for (const l of plan.lists) {
            if (l.id) continue;
            const categoryId = categoryIdFor(l.categoryName);
            const existing = byName(lists, l.name);
            if (existing) {
              const patchExisting = {};
              if (l.horizonDays && !existing.horizonDays) patchExisting.horizonDays = l.horizonDays;
              if (categoryId && !existing.categoryId) patchExisting.categoryId = categoryId;
              if (Object.keys(patchExisting).length) lists[lists.indexOf(existing)] = { ...existing, ...patchExisting, updatedAt: now };
              continue;
            }
            lists.push({ id: newId('l'), name: l.name, personId: l.personId || null, horizonDays: l.horizonDays || null, categoryId, createdAt: now, updatedAt: now });
            added.lists += 1;
          }
          for (const r of plan.routines || []) {
            const existing = byName(routines, r.name);
            const target = existing || { id: newId('r'), name: r.name, cadence: r.cadence, personId: r.personId || null, minutesPerDay: r.minutesPerDay || null, warmup: !!r.warmup, items: [], createdAt: now };
            if (existing) {
              if (r.minutesPerDay && !existing.minutesPerDay) existing.minutesPerDay = r.minutesPerDay;
              if (r.warmup && !existing.warmup) existing.warmup = true;
            }
            if (!existing) {
              routines.push(target);
              added.routines += 1;
            }
            const items = [...target.items];
            for (const it of r.items) {
              if (it.type === 'task') {
                if (!items.some((x) => x.type === 'task' && x.text.toLowerCase() === it.text.toLowerCase())) items.push({ id: newId('ri'), type: 'task', text: it.text, days: [] });
              } else if (it.type === 'minutes') {
                const routine = byName(routines, it.fromName);
                if (!routine) continue;
                if (!items.some((x) => x.type === 'minutes' && x.routineId === routine.id)) items.push({ id: newId('ri'), type: 'minutes', routineId: routine.id, minutes: it.minutes });
              } else {
                const list = byName(lists, it.fromName);
                const routine = !list && byName(routines, it.fromName);
                if (!list && !routine) continue;
                const dup = items.some((x) => x.type === 'quota' && (list ? x.listId === list.id : x.routineId === routine.id));
                if (!dup) items.push(list ? { id: newId('ri'), type: 'quota', listId: list.id, count: it.count } : { id: newId('ri'), type: 'quota', routineId: routine.id, count: it.count });
              }
            }
            target.items = items;
            target.updatedAt = now;
          }
          for (const l of plan.lists) {
            const listId = l.id || byName(lists, l.name)?.id;
            if (!listId) continue;
            const listObj = lists.find((x) => x.id === listId);
            for (const t of l.tasks) {
              const existsAlready = tasks.some((x) => x.listId === listId && !x.done && !x.parentId && x.text.toLowerCase() === t.text.toLowerCase());
              if (existsAlready) continue;
              const id = newId('t');
              tasks.push({
                id,
                text: t.text,
                done: false,
                listId,
                personId: t.personId || l.personId || null,
                canvasCourse: t.course || null,
                week: t.week || null,
                due: t.due || dueForHorizon(listObj, now) || null,
                dueTime: t.due ? t.dueTime || null : null,
                notes: t.notes || null,
                createdAt: order,
                doneAt: null,
                updatedAt: now,
              });
              added.tasks += 1;
              order += 1;
              for (const st of t.steps || []) {
                tasks.push({
                  id: newId('t'),
                  text: st.text,
                  done: false,
                  listId,
                  parentId: id,
                  personId: t.personId || null,
                  due: st.due || null,
                  dueTime: st.due ? st.dueTime || null : null,
                  notes: st.notes || null,
                  createdAt: order,
                  doneAt: null,
                  updatedAt: now,
                });
                added.steps += 1;
                order += 1;
              }
            }
          }
          return dedupeLists({ ...s, lists, tasks, routines, categories });
        });
        return added;
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

  return { ...state, loaded, loadFailed, ...actions };
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
