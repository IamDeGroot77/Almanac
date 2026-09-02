// Exercises src/google/sync.js against an in-memory fake of the Google Tasks
// REST API, wired in by replacing global fetch. Run with:
//   node scripts/test-sync.mjs
import assert from 'node:assert/strict';
import { runSync } from '../src/google/sync.js';

// ---- fake Google Tasks backend -------------------------------------------
let seq = 0;
const lists = new Map(); // id -> { id, title, tasks: Map<id, task> }
const nowIso = () => new Date().toISOString();
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const getList = (id) => {
  const l = lists.get(id);
  if (!l) throw new HttpError(404, 'list not found');
  return l;
};

const backend = {
  listTaskLists: () => [...lists.values()].map(({ id, title }) => ({ id, title })),
  createTaskList: (title) => {
    const id = `gl${++seq}`;
    lists.set(id, { id, title, tasks: new Map() });
    return { id, title };
  },
  patchTaskList: (id, patch) => {
    const l = getList(id);
    Object.assign(l, patch);
    return { id: l.id, title: l.title };
  },
  deleteTaskList: (id) => {
    if (id === 'gl_default') throw new HttpError(400, 'cannot delete default list');
    if (!lists.delete(id)) throw new HttpError(404, 'list not found');
  },
  listTasks: (id) => [...getList(id).tasks.values()].map((t) => ({ ...t })),
  insertTask: (id, body) => {
    const t = { id: `gt${++seq}`, status: 'needsAction', ...body, updated: nowIso() };
    getList(id).tasks.set(t.id, t);
    return { ...t };
  },
  patchTask: (id, taskId, patch) => {
    const t = getList(id).tasks.get(taskId);
    if (!t) throw new HttpError(404, 'task not found');
    Object.assign(t, patch, { updated: nowIso() });
    return { ...t };
  },
  deleteTask: (id, taskId) => {
    if (!getList(id).tasks.delete(taskId)) throw new HttpError(404, 'task not found');
  },
};

// What Gemini or the Google Tasks app would do on the remote side.
const remote = {
  addList: (title, id = `gl${++seq}`) => (lists.set(id, { id, title, tasks: new Map() }), id),
  addTask: (listId, title) => {
    const t = { id: `gt${++seq}`, title, status: 'needsAction', updated: nowIso() };
    getList(listId).tasks.set(t.id, t);
    return t.id;
  },
  complete: (listId, taskId) =>
    Object.assign(getList(listId).tasks.get(taskId), {
      status: 'completed',
      completed: nowIso(),
      updated: nowIso(),
    }),
  remove: (listId, taskId) => getList(listId).tasks.delete(taskId),
  tasksOf: (listId) => [...getList(listId).tasks.values()],
  lists: () => [...lists.values()],
};

// ---- fetch shim ------------------------------------------------------------
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : undefined;
  const path = u.pathname.replace('/tasks/v1', '');
  const ok = (data) => ({
    ok: true,
    status: data === null ? 204 : 200,
    text: async () => (data === null ? '' : JSON.stringify(data)),
    json: async () => data,
  });
  const fail = (status, message) => ({
    ok: false,
    status,
    text: async () => JSON.stringify({ error: { message } }),
    json: async () => ({ error: { message } }),
  });
  try {
    let m;
    if (path === '/users/@me/lists') {
      if (method === 'GET') return ok({ items: backend.listTaskLists() });
      if (method === 'POST') return ok(backend.createTaskList(body.title));
    }
    if ((m = path.match(/^\/users\/@me\/lists\/([^/]+)$/))) {
      const id = decodeURIComponent(m[1]);
      if (method === 'PATCH') return ok(backend.patchTaskList(id, body));
      if (method === 'DELETE') return (backend.deleteTaskList(id), ok(null));
    }
    if ((m = path.match(/^\/lists\/([^/]+)\/tasks$/))) {
      const id = decodeURIComponent(m[1]);
      if (method === 'GET') return ok({ items: backend.listTasks(id) });
      if (method === 'POST') return ok(backend.insertTask(id, body));
    }
    if ((m = path.match(/^\/lists\/([^/]+)\/tasks\/([^/]+)$/))) {
      const id = decodeURIComponent(m[1]);
      const tid = decodeURIComponent(m[2]);
      if (method === 'PATCH') return ok(backend.patchTask(id, tid, body));
      if (method === 'DELETE') return (backend.deleteTask(id, tid), ok(null));
    }
    return fail(500, `unhandled ${method} ${path}`);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    throw e;
  }
};

// ---- scenario ------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const emptySync = () => ({ lastSyncAt: null, syncedVersion: 0, deletedTasks: [], deletedLists: [] });
let state = { lists: [], tasks: [], sync: emptySync(), localVersion: 0 };
const sync = async () => {
  const r = await runSync(state, 'fake-token');
  state = { ...state, lists: r.lists, tasks: r.tasks, sync: r.sync };
  return r;
};
const find = (text) => state.tasks.find((t) => t.text === text);

// Google starts with the default list and one task Gemini added.
remote.addList('My Tasks', 'gl_default');
const geminiEggs = remote.addTask('gl_default', 'eggs');

// Local has a Groceries list with one task, and a day-list task that must not sync.
const t0 = Date.now();
state.lists.push({ id: 'l1', name: 'Groceries', createdAt: t0, updatedAt: t0 });
state.tasks.push({ id: 't1', text: 'milk', done: false, listId: 'l1', createdAt: t0, doneAt: null, updatedAt: t0 });
state.tasks.push({ id: 'td', text: 'call mom', done: false, listId: 'day:2026-09-01', createdAt: t0, doneAt: null, updatedAt: t0 });
state.localVersion = 2;

// 1. First sync: Groceries created remotely, My Tasks created locally, eggs pulled, milk pushed.
await sync();
assert.equal(state.lists.length, 2, 'both lists present locally');
const groceries = state.lists.find((l) => l.name === 'Groceries');
const myTasks = state.lists.find((l) => l.name === 'My Tasks');
assert.ok(groceries.googleListId && myTasks.googleListId === 'gl_default');
assert.equal(remote.lists().length, 2, 'Groceries created in Google');
assert.deepEqual(remote.tasksOf(groceries.googleListId).map((t) => t.title), ['milk']);
assert.ok(find('eggs') && find('eggs').listId === myTasks.id, 'eggs pulled in');
assert.ok(find('call mom') && !find('call mom').googleId, 'day task untouched');
assert.equal(state.sync.syncedVersion, 2);
console.log('1. initial sync ok');

// 2. Gemini adds bread to Groceries; user completes milk locally.
await sleep(5);
remote.addTask(groceries.googleListId, 'bread');
const t1 = Date.now();
state.tasks = state.tasks.map((t) => (t.text === 'milk' ? { ...t, done: true, doneAt: t1, updatedAt: t1 } : t));
state.localVersion = 3;
await sync();
assert.ok(find('bread') && find('bread').listId === groceries.id, 'bread pulled');
assert.equal(remote.tasksOf(groceries.googleListId).find((t) => t.title === 'milk').status, 'completed', 'milk completed remotely');
console.log('2. two-way changes ok');

// 3. User deletes bread locally (tombstone); Gemini's eggs gets completed in Google.
const bread = find('bread');
state.tasks = state.tasks.filter((t) => t.id !== bread.id);
state.sync.deletedTasks.push({ googleListId: bread.googleListId, googleId: bread.googleId });
remote.complete('gl_default', geminiEggs);
state.localVersion = 4;
await sync();
assert.ok(!remote.tasksOf(groceries.googleListId).find((t) => t.title === 'bread'), 'bread deleted remotely');
assert.equal(find('eggs').done, true, 'eggs completion pulled');
assert.equal(state.sync.deletedTasks.length, 0, 'tombstones cleared');
console.log('3. deletion + remote completion ok');

// 4. Move eggs from My Tasks to a day list: it must leave Google.
const t2 = Date.now();
state.tasks = state.tasks.map((t) => (t.text === 'eggs' ? { ...t, listId: 'day:2026-09-02', updatedAt: t2 } : t));
state.localVersion = 5;
await sync();
assert.ok(!remote.tasksOf('gl_default').find((t) => t.id === geminiEggs), 'eggs removed from Google');
assert.ok(!find('eggs').googleId, 'eggs local googleId cleared');
console.log('4. move to day list ok');

// 5. Remote deletion of milk disappears locally; a re-sync changes nothing.
remote.remove(groceries.googleListId, find('milk').googleId);
await sync();
assert.ok(!find('milk'), 'milk removed locally');
const before = JSON.stringify({ l: state.lists, t: state.tasks });
await sync();
assert.equal(JSON.stringify({ l: state.lists, t: state.tasks }), before, 'idempotent');
console.log('5. remote delete + idempotence ok');

// 6. Renaming Groceries locally renames it in Google; a remote rename comes back.
await sleep(5);
const t3 = Date.now();
state.lists = state.lists.map((l) => (l.id === groceries.id ? { ...l, name: 'Shopping', updatedAt: t3 } : l));
state.localVersion = 6;
await sync();
assert.equal(remote.lists().find((l) => l.id === groceries.googleListId).title, 'Shopping');
lists.get(groceries.googleListId).title = 'Shopping list';
await sync();
assert.equal(state.lists.find((l) => l.id === groceries.id).name, 'Shopping list', 'remote rename adopted');
console.log('6. rename both ways ok');

// 7. Deleting a list locally deletes it remotely; deleting My Tasks is tolerated.
state.lists = state.lists.filter((l) => l.id !== groceries.id);
state.tasks = state.tasks.filter((t) => t.listId !== groceries.id);
state.sync.deletedLists.push(groceries.googleListId, 'gl_default');
state.localVersion = 7;
await sync();
assert.ok(!remote.lists().find((l) => l.id === groceries.googleListId), 'Shopping list deleted remotely');
assert.ok(remote.lists().find((l) => l.id === 'gl_default'), 'default list survives');
assert.equal(state.sync.deletedLists.length, 0);
console.log('7. list deletion ok');

// 8. A task moved between two synced lists is recreated on the destination.
const homeId = remote.addList('Home');
await sync();
const home = state.lists.find((l) => l.googleListId === homeId);
const sockId = remote.addTask('gl_default', 'buy socks');
await sync();
const t4 = Date.now();
state.tasks = state.tasks.map((t) => (t.text === 'buy socks' ? { ...t, listId: home.id, updatedAt: t4 } : t));
state.localVersion = 8;
await sync();
assert.ok(!remote.tasksOf('gl_default').find((t) => t.id === sockId), 'left My Tasks');
assert.equal(remote.tasksOf(homeId).map((t) => t.title).join(), 'buy socks', 'arrived in Home');
assert.equal(state.tasks.filter((t) => t.text === 'buy socks').length, 1, 'no duplicate locally');
console.log('8. move between synced lists ok');

// 9. Timing stays local: a started task completed from Google gets a duration;
//    a done task reopened from Google loses its timer.
const paintId = remote.addTask(homeId, 'paint fence');
await sync();
const t5 = Date.now();
state.tasks = state.tasks.map((t) =>
  t.text === 'paint fence' ? { ...t, startedAt: t5 - 30 * 60000, updatedAt: t5 } : t
);
state.localVersion = 9;
await sync();
await sleep(5);
remote.complete(homeId, paintId);
await sleep(5);
await sync();
const paint = find('paint fence');
assert.equal(paint.done, true);
assert.ok(paint.durationMs >= 30 * 60000 - 1000 && paint.durationMs < 31 * 60000, `duration ${paint.durationMs}`);
Object.assign(lists.get(homeId).tasks.get(paintId), { status: 'needsAction', completed: undefined, updated: nowIso() });
await sleep(5);
await sync();
assert.equal(find('paint fence').done, false);
assert.equal(find('paint fence').durationMs, null);
assert.equal(find('paint fence').startedAt, null);
console.log('9. timing survives remote completion ok');

// 10. A list created in Google whose name mentions a person is tagged for them,
//     and tasks arriving on it inherit the tag.
state.people = [{ id: 'me', name: 'Me' }, { id: 'zeke', name: 'Zeke' }];
const zekeListId = remote.addList('Zeke School');
remote.addTask(zekeListId, 'permission slip');
await sync();
const zekeList = state.lists.find((l) => l.googleListId === zekeListId);
assert.equal(zekeList.personId, 'zeke', 'list tagged from its name');
assert.equal(find('permission slip').personId, 'zeke', 'task inherits list person');
console.log('10. person guessed from Google list name ok');

// 11. Due dates travel both ways; a due time set locally survives a remote
//     edit that keeps the same date, and is cleared when the date changes.
const dentistId = remote.addTask('gl_default', 'dentist');
lists.get('gl_default').tasks.get(dentistId).due = '2026-09-10T00:00:00.000Z';
await sync();
assert.equal(find('dentist').due, '2026-09-10', 'due pulled from Google');
const t6 = Date.now();
state.tasks = state.tasks.map((t) => (t.text === 'dentist' ? { ...t, dueTime: '15:00', updatedAt: t6 } : t));
state.localVersion = 10;
await sync();
assert.equal(lists.get('gl_default').tasks.get(dentistId).due, '2026-09-10T00:00:00.000Z', 'date pushed back unchanged');
await sleep(5);
Object.assign(lists.get('gl_default').tasks.get(dentistId), { title: 'dentist (moved)', updated: nowIso() });
await sync();
assert.equal(find('dentist (moved)').dueTime, '15:00', 'time kept when date unchanged');
await sleep(5);
Object.assign(lists.get('gl_default').tasks.get(dentistId), { due: '2026-09-12T00:00:00.000Z', updated: nowIso() });
await sync();
assert.equal(find('dentist (moved)').due, '2026-09-12');
assert.equal(find('dentist (moved)').dueTime, null, 'time cleared when date changed remotely');
const t7 = Date.now();
state.tasks = state.tasks.map((t) => (t.text === 'dentist (moved)' ? { ...t, due: '2026-09-20', updatedAt: t7 } : t));
state.localVersion = 11;
await sync();
assert.equal(lists.get('gl_default').tasks.get(dentistId).due, '2026-09-20T00:00:00.000Z', 'local due pushed');
console.log('11. due dates both ways ok');

console.log('\nAll sync scenarios passed.');
