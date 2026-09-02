import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey, dayFromOffset, todayKey } from './dates';

// Storage layout (version 2):
// {
//   version: 2,
//   lists: [{ id, name, createdAt }],           // standing lists the user names
//   tasks: [{ id, text, done, listId, createdAt, doneAt }],
// }
// A task's listId is either "day:YYYY-MM-DD" (a day list, created on demand)
// or the id of a standing list.

const STORAGE_KEY = 'almanac:v2';
const LEGACY_TASKS_KEY = 'tasks';
const DONE_RETENTION_DAYS = 60;

export const DAY_PREFIX = 'day:';
export const dayListId = (key) => `${DAY_PREFIX}${key}`;
export const isDayList = (listId) => listId.startsWith(DAY_PREFIX);
export const dayOfList = (listId) => listId.slice(DAY_PREFIX.length);
export const dayListIdForOffset = (offset) => dayListId(dayKey(dayFromOffset(offset)));

const newId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const emptyState = () => ({ version: 2, lists: [], tasks: [] });

function migrateLegacy(saved) {
  const today = dayListId(todayKey());
  const list = Array.isArray(saved) ? saved : [];
  return {
    version: 2,
    lists: [],
    tasks: list.map((t) => ({
      id: String(t.id),
      text: t.text,
      done: !!t.done,
      listId: today,
      createdAt: Number(t.id) || Date.now(),
      doneAt: t.done ? Date.now() : null,
    })),
  };
}

// Drop completed day-list tasks older than the retention window so storage
// doesn't grow forever. Unfinished tasks are never pruned; the morning review
// handles those.
function prune(state) {
  const cutoff = Date.now() - DONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return {
    ...state,
    tasks: state.tasks.filter((t) => !(t.done && t.doneAt && t.doneAt < cutoff)),
  };
}

async function load() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    return prune({ ...emptyState(), ...parsed });
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

  const update = useCallback((fn) => setState((prev) => ({ ...prev, ...fn(prev) })), []);

  const actions = useMemo(
    () => ({
      addTask(text, listId) {
        const trimmed = text.trim();
        if (!trimmed) return;
        update((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: newId('t'),
              text: trimmed,
              done: false,
              listId,
              createdAt: Date.now(),
              doneAt: null,
            },
          ],
        }));
      },
      toggleTask(id) {
        update((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : Date.now() } : t
          ),
        }));
      },
      deleteTask(id) {
        update((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
      },
      moveTask(id, listId) {
        update((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, listId } : t)) }));
      },
      clearCompleted(listId) {
        update((s) => ({ tasks: s.tasks.filter((t) => !(t.listId === listId && t.done)) }));
      },
      addList(name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        update((s) => ({
          lists: [...s.lists, { id: newId('l'), name: trimmed, createdAt: Date.now() }],
        }));
      },
      renameList(id, name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        update((s) => ({
          lists: s.lists.map((l) => (l.id === id ? { ...l, name: trimmed } : l)),
        }));
      },
      deleteList(id) {
        update((s) => ({
          lists: s.lists.filter((l) => l.id !== id),
          tasks: s.tasks.filter((t) => t.listId !== id),
        }));
      },
      // Morning review: carry the given tasks to today, drop the rest.
      applyReview(carryIds, dropIds) {
        const today = dayListId(todayKey());
        const carry = new Set(carryIds);
        const drop = new Set(dropIds);
        update((s) => ({
          tasks: s.tasks
            .filter((t) => !drop.has(t.id))
            .map((t) => (carry.has(t.id) ? { ...t, listId: today } : t)),
        }));
      },
    }),
    [update]
  );

  return { ...state, loaded, ...actions };
}

// Unfinished tasks on day lists dated before today, oldest day first.
export function pastUnfinished(tasks) {
  const today = todayKey();
  return tasks
    .filter((t) => !t.done && isDayList(t.listId) && dayOfList(t.listId) < today)
    .sort((a, b) => dayOfList(a.listId).localeCompare(dayOfList(b.listId)) || a.createdAt - b.createdAt);
}

export function tasksForList(tasks, listId) {
  const inList = tasks.filter((t) => t.listId === listId);
  const open = inList.filter((t) => !t.done);
  const done = inList.filter((t) => t.done);
  return { open, done, all: [...open, ...done] };
}
