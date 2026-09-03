// Exercises src/assistant/{snapshot,tools}.js. Run: node scripts/test-assistant.mjs
import assert from 'node:assert/strict';
import { buildSnapshot } from '../src/assistant/snapshot.js';
import { resolveCall, resolveCalls, resolveListRef, findList } from '../src/assistant/tools.js';

const H = 3600000;
const key = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const now = new Date();
now.setHours(10, 0, 0, 0);
const NOW = now.getTime();
const TODAY = key(NOW);
const TOMORROW = key(NOW + 24 * H);

const state = {
  lists: [
    { id: 'l1', name: 'Chores', categoryId: 'c1' },
    { id: 'l2', name: 'School' },
    { id: 'l3', name: 'Someday' },
    { id: 'l4', name: 'Zeke', personId: 'p1' },
    { id: `day:${TODAY}`, name: 'Today' },
  ],
  categories: [{ id: 'c1', name: 'Home' }],
  people: [{ id: 'p1', name: 'Zeke' }],
  routines: [{ id: 'r1', name: 'Exercise', minutesPerDay: 30, items: [{ id: 'i1', text: 'Push-ups' }] }],
  tasks: [
    { id: 't1', text: 'Write the article', listId: `day:${TODAY}`, due: TODAY, createdAt: NOW - H },
    { id: 't2', text: 'Old done thing', listId: 'l2', done: true, doneAt: NOW - 5 * 24 * H },
    { id: 't3', text: 'Reading week 3', listId: 'l2', due: key(NOW + 3 * 24 * H) },
    { id: 't4', text: 'Fix the fence', listId: 'l3' },
    { id: 't5', text: 'Step', listId: `day:${TODAY}`, parentId: 't1' },
  ],
  days: { [TODAY]: { wokeAt: NOW - 3 * H, sleptAt: null } },
  scratch: [{ id: 's1', text: 'idea for GFD post' }],
  journal: { [TODAY]: [{ id: 'j1', text: 'private' }] },
};

// Snapshot: today's and due-this-week tasks, no steps, no old done, no journal.
{
  const snap = buildSnapshot(state, NOW);
  assert.equal(snap.today, TODAY);
  assert.equal(snap.tomorrow, TOMORROW);
  assert.deepEqual(snap.tasks.map((t) => t.id), ['t1', 't3']);
  assert.equal(snap.tasks[0].list, 'today');
  assert.equal(snap.tasks[1].list, 'School');
  assert.equal(snap.day_open.key, TODAY);
  assert.equal(JSON.stringify(snap).includes('private'), false);
  assert.deepEqual(snap.lists.find((l) => l.name === 'Chores'), { name: 'Chores', category: 'Home' });
  assert.equal(snap.lists.find((l) => l.name === 'Zeke').person, 'Zeke');
  assert.equal(snap.working_memory[0].text, 'idea for GFD post');
}

// List references: today, tomorrow, dates, names (loosely).
{
  assert.equal(resolveListRef(state, 'today', NOW), `day:${TODAY}`);
  assert.equal(resolveListRef(state, 'Tomorrow', NOW), `day:${TOMORROW}`);
  assert.equal(resolveListRef(state, '2026-12-01', NOW), 'day:2026-12-01');
  assert.equal(resolveListRef(state, 'chores', NOW), 'l1');
  assert.equal(findList(state.lists, 'chores list').id, 'l1');
  assert.equal(findList(state.lists, 'schoo').id, 'l2');
  assert.equal(resolveListRef(state, 'Groceries', NOW), null);
}

// add_task resolves the list, the person, and keeps the extras.
{
  const r = resolveCall(
    state,
    { name: 'add_task', input: { text: 'Buy tape', list: 'Chores', due: TOMORROW, due_time: '14:00', estimate_minutes: 10, person: 'zeke', slot: 'afternoon', steps: ['Find the roll', ''] } },
    NOW
  );
  assert.ok(r.ok, r.error);
  assert.equal(r.action.listId, 'l1');
  assert.equal(r.action.personId, 'p1');
  assert.equal(r.action.due, TOMORROW);
  assert.equal(r.action.dueTime, '14:00');
  assert.equal(r.action.estimateMs, 600000);
  assert.deepEqual(r.action.steps, ['Find the roll']);
  assert.match(r.line, /Chores/);
  assert.match(r.line, /for Zeke/);
  const bad = resolveCall(state, { name: 'add_task', input: { text: 'X', list: 'Groceries' } }, NOW);
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Chores, School, Someday, Zeke/);
  const junkDate = resolveCall(state, { name: 'add_task', input: { text: 'X', list: 'today', due: 'Friday' } }, NOW);
  assert.equal(junkDate.action.due, null);
}

// Task ids must exist; moves remember where they came from.
{
  assert.equal(resolveCall(state, { name: 'finish_task', input: { task_id: 'nope' } }, NOW).ok, false);
  const mv = resolveCall(state, { name: 'move_task', input: { task_id: 't4', list: 'today' } }, NOW);
  assert.ok(mv.ok);
  assert.equal(mv.action.fromListId, 'l3');
  assert.match(mv.line, /to today/);
  const due = resolveCall(state, { name: 'set_due', input: { task_id: 't4', due: TOMORROW } }, NOW);
  assert.deepEqual(due.action.prev, { due: null, dueTime: null });
}

// Routines by loose name; minutes must be positive.
{
  const ok = resolveCall(state, { name: 'log_minutes', input: { routine: 'exercise', minutes: 20, what: 'push-ups' } }, NOW);
  assert.ok(ok.ok);
  assert.equal(ok.action.routineId, 'r1');
  assert.equal(ok.action.minutes, 20);
  assert.equal(resolveCall(state, { name: 'log_minutes', input: { routine: 'exercise', minutes: 0 } }, NOW).ok, false);
  assert.equal(resolveCall(state, { name: 'log_minutes', input: { routine: 'yoga', minutes: 10 } }, NOW).ok, false);
}

// A list that already exists is not created twice.
{
  assert.equal(resolveCall(state, { name: 'add_list', input: { name: 'chores' } }, NOW).ok, false);
  const nl = resolveCall(state, { name: 'add_list', input: { name: 'Garden', category: 'home' } }, NOW);
  assert.equal(nl.action.categoryId, 'c1');
}

// Several calls in one line: each resolved on its own; a bad one does not sink the rest.
{
  const rs = resolveCalls(
    state,
    [
      { name: 'add_task', input: { text: 'Milk', list: 'Chores' } },
      { name: 'journal', input: { text: 'Scattered today' } },
      { name: 'hold_thought', input: { text: '' } },
      { name: 'made_up', input: {} },
    ],
    NOW
  );
  assert.deepEqual(rs.map((r) => r.ok), [true, true, false, false]);
}

console.log('All assistant scenarios passed.');
