// Exercises src/drive/merge.js. Run: node scripts/test-merge.mjs
import assert from 'node:assert/strict';
import { mergeStates, shareable, sameShareable } from '../src/drive/merge.js';

const now = Date.now();
const t = (id, text, updatedAt, extra = {}) => ({ id, text, done: false, listId: 'l1', createdAt: updatedAt - 1000, updatedAt, ...extra });
const empty = () => ({ tasks: [], lists: [], routines: [], people: [], routineDone: {}, timeLog: [], days: {}, dayNotes: {}, dayNoteMeta: {}, deleted: { tasks: {}, lists: {}, routines: {} }, sharedPrefs: {}, prefsUpdatedAt: 0, revision: 0 });

// 1. Newest edit wins; bookkeeping carried from the older copy.
{
  const phone = { ...empty(), tasks: [t('a', 'Old title', now - 5000, { googleId: 'g1', googleListId: 'gl', syncedUpdatedAt: now - 5000 })] };
  const laptop = { ...empty(), tasks: [t('a', 'New title', now - 1000)] };
  const m = mergeStates(phone, laptop, now);
  assert.equal(m.tasks[0].text, 'New title');
  assert.equal(m.tasks[0].googleId, 'g1', 'google id kept from the phone copy');
  console.log('1. newest wins, bookkeeping kept');
}

// 2. Deletion on one side removes the task unless the other side edited it later.
{
  const phone = { ...empty(), tasks: [t('a', 'Keep me', now - 1000), t('b', 'Stale', now - 9000)] };
  const laptop = { ...empty(), deleted: { tasks: { a: now - 5000, b: now - 2000 }, lists: {}, routines: {} } };
  const m = mergeStates(phone, laptop, now);
  assert.deepEqual(m.tasks.map((x) => x.id), ['a'], 'a edited after deletion survives, b is gone');
  assert.equal(m.deleted.tasks.b, now - 2000);
  console.log('2. deletions respected');
}

// 3. Union of people, routine ticks, time log; days merge with watch sleep winning.
{
  const phone = {
    ...empty(),
    people: [{ id: 'me', name: 'Me' }, { id: 'zeke', name: 'Zeke' }],
    routineDone: { r1: { 'd:2026-09-02': { i1: 1 } } },
    timeLog: [{ id: 'log1', doneAt: 1 }],
    days: { '2026-09-02': { wokeAt: 100, lastActiveAt: 500, sleep: { start: 1, end: 50, source: 'phone' }, energy: { wake: 2 } } },
  };
  const laptop = {
    ...empty(),
    people: [{ id: 'me', name: 'Me' }],
    routineDone: { r1: { 'd:2026-09-02': { i2: 1 } } },
    timeLog: [{ id: 'log2', doneAt: 2 }],
    days: { '2026-09-02': { wokeAt: 100, lastActiveAt: 900, sleep: { start: 2, end: 60, source: 'health' }, energy: { midday: 3 } } },
  };
  const m = mergeStates(phone, laptop, now);
  assert.equal(m.people.length, 2);
  assert.deepEqual(Object.keys(m.routineDone.r1['d:2026-09-02']).sort(), ['i1', 'i2']);
  assert.equal(m.timeLog.length, 2);
  assert.equal(m.days['2026-09-02'].sleep.source, 'health');
  assert.deepEqual(m.days['2026-09-02'].energy, { wake: 2, midday: 3 });
  console.log('3. unions and day merge');
}

// 4. Notes by timestamp; shared prefs by timestamp; symmetric.
{
  const phone = { ...empty(), dayNotes: { d: 'phone note' }, dayNoteMeta: { d: 10 }, sharedPrefs: { checkinMinutes: 15 }, prefsUpdatedAt: 5 };
  const laptop = { ...empty(), dayNotes: { d: 'laptop note' }, dayNoteMeta: { d: 20 }, sharedPrefs: { checkinMinutes: 45 }, prefsUpdatedAt: 9 };
  const m1 = mergeStates(phone, laptop, now);
  const m2 = mergeStates(laptop, phone, now);
  assert.equal(m1.dayNotes.d, 'laptop note');
  assert.equal(m1.sharedPrefs.checkinMinutes, 45);
  assert.equal(JSON.stringify(m1), JSON.stringify({ ...m2, tasks: m1.tasks }), 'symmetric');
  console.log('4. notes, prefs, symmetry');
}

// 5. shareable/sameShareable round trip.
{
  const state = { tasks: [t('a', 'x', 1)], lists: [], prefs: { checkinMinutes: 30, theme: 'dark' }, driveRevision: 3 };
  const s = shareable(state);
  assert.equal(s.sharedPrefs.checkinMinutes, 30);
  assert.equal(s.sharedPrefs.theme, undefined, 'device-only pref not shared');
  assert.ok(sameShareable(s, { ...s, revision: 99 }), 'revision ignored in comparison');
  console.log('5. shareable slice');
}

console.log('\nAll merge scenarios passed.');
