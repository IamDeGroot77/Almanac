import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey, dayFromOffset, todayKey } from './dates';
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
export const dayListIdForOffset = (offset) => dayListId(dayKey(dayFromOffset(offset)));

const emptySync = () => ({ lastSyncAt: null, syncedVersion: 0, deletedTasks: [], deletedLists: [] });
const emptyState = () => ({
  version: 2,
  lists: [],
  tasks: [],
  timeLog: [], // finished, timed tasks: { id, taskId, text, listId, startedAt, doneAt, durationMs }
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
    return prune({ ...emptyState(), ...parsed, sync: { ...emptySync(), ...(parsed.sync || {}) } });
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
  const edit = useCallback(
    (fn) =>
      setState((prev) => ({ ...prev, ...fn(prev), localVersion: prev.localVersion + 1 })),
    []
  );

  const actions = useMemo(
    () => ({
      addTask(text, listId) {
        const trimmed = text.trim();
        if (!trimmed) return;
        const now = Date.now();
        edit((s) => ({
          tasks: [
            ...s.tasks,
            { id: newId('t'), text: trimmed, done: false, listId, createdAt: now, doneAt: null, updatedAt: now },
          ],
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
      addList(name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        const now = Date.now();
        edit((s) => ({
          lists: [...s.lists, { id: newId('l'), name: trimmed, createdAt: now, updatedAt: now }],
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
        const today = dayListId(todayKey());
        const yesterday = dayListId(dayKey(dayFromOffset(-1)));
        edit((s) => ({
          tasks: s.tasks.map((t) =>
            t.listId === today && !t.done ? { ...t, listId: yesterday } : t
          ),
        }));
      },
      // Morning review: carry the given tasks to today, drop the rest.
      applyReview(carryIds, dropIds) {
        const today = dayListId(todayKey());
        const carry = new Set(carryIds);
        const drop = new Set(dropIds);
        const now = Date.now();
        edit((s) => ({
          tasks: s.tasks
            .filter((t) => !drop.has(t.id))
            // A timer left running overnight is meaningless; carried tasks start fresh.
            .map((t) =>
              carry.has(t.id) ? { ...t, listId: today, startedAt: null, updatedAt: now } : t
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
export function pastUnfinished(tasks) {
  const today = todayKey();
  return tasks
    .filter((t) => !t.done && isDayList(t.listId) && dayOfList(t.listId) < today)
    .sort(
      (a, b) =>
        dayOfList(a.listId).localeCompare(dayOfList(b.listId)) || a.createdAt - b.createdAt
    );
}

export function tasksForList(tasks, listId) {
  const inList = tasks.filter((t) => t.listId === listId);
  const open = inList.filter((t) => !t.done);
  const done = inList.filter((t) => t.done);
  return { open, done, all: [...open, ...done] };
}
