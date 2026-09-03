// Exercises src/lists.js. Run: node scripts/test-lists-dedupe.mjs
import assert from 'node:assert/strict';
import { dedupeLists } from '../src/lists.js';

const now = 1000000;
const state = {
  lists: [
    { id: 'a', name: 'School', createdAt: 10 },
    { id: 'b', name: 'school ', createdAt: 20, googleListId: 'g1', categoryId: 'work' },
    { id: 'c', name: 'School', createdAt: 30, horizonDays: 90 },
    { id: 'd', name: 'Groceries', createdAt: 5 },
  ],
  tasks: [
    { id: 't1', listId: 'a', text: 'old' },
    { id: 't2', listId: 'c', text: 'new' },
    { id: 't3', listId: 'd', text: 'milk' },
  ],
  routines: [{ id: 'r', items: [{ id: 'i', type: 'quota', listId: 'c', count: 1 }] }],
  prefs: { calendarRules: [{ id: 'cr', keyword: 'city', listId: 'a' }] },
  deleted: { tasks: {}, lists: {}, routines: {} },
};

const out = dedupeLists(state, now);
assert.equal(out.lists.length, 2);
const school = out.lists.find((l) => l.name.trim().toLowerCase() === 'school');
assert.equal(school.id, 'b', 'the Google-linked list survives');
assert.equal(school.horizonDays, 90, 'settings from a duplicate are carried over');
assert.equal(school.categoryId, 'work');
assert.ok(out.tasks.every((t) => t.listId !== 'a' && t.listId !== 'c'));
assert.equal(out.tasks.filter((t) => t.listId === 'b').length, 2);
assert.equal(out.routines[0].items[0].listId, 'b');
assert.equal(out.prefs.calendarRules[0].listId, 'b');
assert.equal(out.deleted.lists.a, now);
assert.equal(out.deleted.lists.c, now);

// Nothing to do: same object back.
const clean = { lists: [{ id: 'x', name: 'One' }, { id: 'y', name: 'Two' }], tasks: [], routines: [], prefs: {} };
assert.equal(dedupeLists(clean, now), clean);

console.log('All list dedupe scenarios passed.');
