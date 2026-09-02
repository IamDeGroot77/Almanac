import { makeApi, isNotFound, isBadRequest } from './tasksApi.js';
import { newId, DONE_RETENTION_MS } from '../ids.js';

// Two-way sync between Almanac's standing lists and Google Tasks.
//
// Rules:
// - Every standing list maps to a Google Tasks list with the same name.
//   Lists that exist only on one side get created on the other.
// - Day lists stay local. A task moved from a standing list onto a day list
//   is removed from Google; a task moved the other way gets created there.
// - Per task, the side that changed more recently wins. A local edit is one
//   whose updatedAt is past the syncedUpdatedAt recorded at the last sync;
//   a remote edit is one whose Google `updated` is past googleUpdated.
// - Deletions are carried as tombstones in state.sync until they're pushed.
//
// runSync is pure with respect to the snapshot it's given: it returns the new
// lists/tasks/sync and never touches React state itself.

// Google stores `due` as a date-only RFC3339 timestamp at midnight UTC.
const dueToRemote = (due) => (due ? `${due}T00:00:00.000Z` : null);
const dueFromRemote = (due) => (due ? String(due).slice(0, 10) : null);

function toRemote(task) {
  return {
    title: task.text,
    status: task.done ? 'completed' : 'needsAction',
    completed: task.done ? new Date(task.doneAt || Date.now()).toISOString() : null,
    due: dueToRemote(task.due),
  };
}

function fromRemote(local, remote, googleListId) {
  const done = remote.status === 'completed';
  const doneAt = done ? Date.parse(remote.completed) || local.doneAt || Date.now() : null;
  // Timing lives only on this device. If Google completed a task we had
  // started, close the timer at the completion time; if Google reopened a
  // done task, clear it.
  let durationMs = local.durationMs ?? null;
  let startedAt = local.startedAt ?? null;
  if (done && !local.done) {
    const banked = local.spentMs || 0;
    const running = startedAt ? Math.max(0, doneAt - startedAt) : 0;
    durationMs = startedAt || banked ? banked + running : null;
    startedAt = null;
  } else if (!done && local.done) {
    durationMs = null;
    startedAt = null;
  }
  return {
    ...local,
    text: remote.title?.trim() ? remote.title : local.text,
    done,
    doneAt,
    startedAt,
    durationMs,
    due: dueFromRemote(remote.due),
    // Google has no due time; keep ours unless the date went away or changed.
    dueTime: remote.due && dueFromRemote(remote.due) === local.due ? local.dueTime ?? null : null,
    googleId: remote.id,
    googleListId,
    googleUpdated: Date.parse(remote.updated) || Date.now(),
    // Everything up to this local edit has now been reconciled with Google.
    syncedUpdatedAt: local.updatedAt || 0,
  };
}

async function ignoreMissing(promise) {
  try {
    await promise;
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
}

export async function runSync(snapshot, accessToken) {
  const { lists, tasks, sync, localVersion, people = [] } = snapshot;
  const guessPerson = (name) => {
    const lower = (name || '').toLowerCase();
    const hit = people.find((p) => p.id !== 'me' && lower.includes(p.name.toLowerCase()));
    return hit ? hit.id : null;
  };
  const api = makeApi(accessToken);
  const now = Date.now();

  // 1. Push pending deletions.
  for (const d of sync.deletedTasks) {
    await ignoreMissing(api.deleteTask(d.googleListId, d.googleId));
  }
  for (const googleListId of sync.deletedLists) {
    try {
      await api.deleteTaskList(googleListId);
    } catch (err) {
      // Google refuses to delete the default "My Tasks" list (400). Let it be.
      if (!isNotFound(err) && !isBadRequest(err)) throw err;
    }
  }

  // 2. Reconcile lists.
  const remoteLists = await api.listTaskLists();
  const remoteListById = new Map(remoteLists.map((l) => [l.id, l]));
  const claimed = new Set();
  const nextLists = [];

  for (const list of lists) {
    let remote = list.googleListId ? remoteListById.get(list.googleListId) : null;
    if (!remote) {
      const wanted = list.name.trim().toLowerCase();
      remote = remoteLists.find(
        (r) => !claimed.has(r.id) && (r.title || '').trim().toLowerCase() === wanted
      );
    }
    if (!remote) {
      remote = await api.createTaskList(list.name);
      remoteListById.set(remote.id, remote);
    }
    claimed.add(remote.id);

    let name = list.name;
    // A local rename is one not yet reconciled: updatedAt moved past the
    // value we recorded at the last sync. No wall-clock comparisons.
    const localRenamed = (list.updatedAt || 0) > (list.syncedUpdatedAt || 0);
    if (remote.title !== list.name) {
      if (localRenamed) await api.patchTaskList(remote.id, { title: list.name });
      else if (remote.title?.trim()) name = remote.title;
    }
    nextLists.push({ ...list, name, googleListId: remote.id, syncedUpdatedAt: list.updatedAt || 0 });
  }

  for (const r of remoteLists) {
    if (claimed.has(r.id)) continue;
    nextLists.push({
      id: newId('l'),
      name: r.title?.trim() || 'Untitled list',
      personId: guessPerson(r.title),
      createdAt: now,
      updatedAt: 0,
      googleListId: r.id,
    });
  }

  // 3. Reconcile tasks.
  const googleListIdByLocal = new Map(nextLists.map((l) => [l.id, l.googleListId]));
  // Every Google task id some local task already owns. A remote task with one
  // of these ids is never "new", even if we see it on a list before the local
  // task's move away from that list has been pushed.
  const ownedGoogleIds = new Set(tasks.filter((t) => t.googleId).map((t) => t.googleId));
  const nextTasks = [];
  const handled = new Set();

  // Tasks on day lists (or anything unsynced) must not exist in Google.
  for (const t of tasks) {
    if (googleListIdByLocal.has(t.listId)) continue;
    handled.add(t.id);
    if (t.googleId) {
      await ignoreMissing(api.deleteTask(t.googleListId, t.googleId));
      nextTasks.push({ ...t, googleId: null, googleListId: null, googleUpdated: null });
    } else {
      nextTasks.push(t);
    }
  }

  for (const list of nextLists) {
    const gl = list.googleListId;
    const remoteTasks = await api.listTasks(gl);
    const remoteById = new Map(remoteTasks.map((r) => [r.id, r]));
    const seenRemote = new Set();

    for (const original of tasks) {
      if (original.listId !== list.id) continue;
      handled.add(original.id);
      let t = original;

      // Moved here from another synced list: recreate on the new list.
      if (t.googleId && t.googleListId && t.googleListId !== gl) {
        await ignoreMissing(api.deleteTask(t.googleListId, t.googleId));
        t = { ...t, googleId: null, googleListId: null, googleUpdated: null };
      }

      if (!t.googleId) {
        const created = await api.insertTask(gl, toRemote(t));
        seenRemote.add(created.id);
        nextTasks.push(fromRemote(t, created, gl));
        continue;
      }

      const remote = remoteById.get(t.googleId);
      if (!remote) {
        // Deleted in Google since we last saw it. Drop it locally too.
        continue;
      }
      seenRemote.add(remote.id);

      const remoteUpdated = Date.parse(remote.updated) || 0;
      const localChanged = (t.updatedAt || 0) > (t.syncedUpdatedAt || 0);
      const remoteChanged = remoteUpdated > (t.googleUpdated || 0);

      if (localChanged && (!remoteChanged || (t.updatedAt || 0) >= remoteUpdated)) {
        const patched = await api.patchTask(gl, t.googleId, toRemote(t));
        nextTasks.push(fromRemote(t, patched, gl));
      } else if (remoteChanged) {
        nextTasks.push(fromRemote(t, remote, gl));
      } else {
        nextTasks.push(t);
      }
    }

    // New in Google (this is how Gemini's additions arrive).
    for (const r of remoteTasks) {
      if (seenRemote.has(r.id) || ownedGoogleIds.has(r.id)) continue;
      if (!r.title?.trim()) continue;
      const done = r.status === 'completed';
      const completedAt = Date.parse(r.completed) || 0;
      if (done && completedAt && completedAt < now - DONE_RETENTION_MS) continue;
      nextTasks.push({
        id: newId('t'),
        text: r.title,
        done,
        listId: list.id,
        personId: list.personId || null,
        due: dueFromRemote(r.due),
        dueTime: null,
        createdAt: Date.parse(r.updated) || now,
        doneAt: done ? completedAt || now : null,
        updatedAt: 0,
        googleId: r.id,
        googleListId: gl,
        googleUpdated: Date.parse(r.updated) || now,
      });
    }
  }

  for (const t of tasks) if (!handled.has(t.id)) nextTasks.push(t);

  return {
    lists: nextLists,
    tasks: nextTasks,
    sync: { lastSyncAt: now, syncedVersion: localVersion, deletedTasks: [], deletedLists: [] },
    snapshotTaskIds: tasks.map((t) => t.id),
    snapshotListIds: lists.map((l) => l.id),
    consumedDeletedTasks: sync.deletedTasks.length,
    consumedDeletedLists: sync.deletedLists.length,
  };
}
