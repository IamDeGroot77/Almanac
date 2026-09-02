// Exercises the timed parts of src/routines.js. Run: node scripts/test-routines.mjs
import assert from 'node:assert/strict';
import { itemProgress, routineProgress, minutesToday, needsWarmup } from '../src/routines.js';

const H = 3600000;
const today = new Date();
today.setHours(14, 0, 0, 0);
const NOW = today.getTime();

const exercise = { id: 'ex', name: 'Exercise', cadence: 'weekly', minutesPerDay: 30, warmup: true, items: [{ id: 'a', type: 'task', text: 'push-ups' }] };
const daily = { id: 'd', name: 'Daily', cadence: 'daily', items: [{ id: 'm', type: 'minutes', routineId: 'ex', minutes: 30 }, { id: 'q', type: 'quota', routineId: 'ex', count: 1 }] };

const routineLog = [
  { id: '1', routineId: 'ex', itemId: 'a', text: 'push-ups', startedAt: NOW - 3 * H, endedAt: NOW - 3 * H + 12 * 60000, durationMs: 12 * 60000 },
  { id: '2', routineId: 'ex', itemId: 'warmup', text: 'Stretch', startedAt: NOW - 26 * H, endedAt: NOW - 26 * H + 5 * 60000, durationMs: 5 * 60000 }, // yesterday
];
const routineDone = { ex: { 'w:x': { a: NOW - 3 * H + 12 * 60000 } } };
const state = { tasks: [], routineDone, routineLog };

// Minutes today only count today's entries.
assert.equal(minutesToday('ex', routineLog, today), 12);

// A minutes item reads those minutes; the header counts it as one item.
{
  const p = itemProgress(daily, daily.items[0], state, today);
  assert.equal(p.minutes.done, 12);
  assert.equal(p.minutes.target, 30);
  assert.equal(p.complete, false);
  assert.equal(p.target, 1);
  const q = itemProgress(daily, daily.items[1], state, today);
  assert.equal(q.done, 1, 'a tick on the weekly routine counts for today');
  const all = routineProgress(daily, state, today);
  assert.equal(all.done, 1);
  assert.equal(all.target, 2);
}

// Warm-up: needed when the last entry on the routine is over an hour old.
assert.equal(needsWarmup('ex', routineLog, NOW), true);
assert.equal(needsWarmup('ex', [...routineLog, { id: '3', routineId: 'ex', itemId: 'a', endedAt: NOW - 20 * 60000, durationMs: 60000, startedAt: NOW - 21 * 60000 }], NOW), false);
assert.equal(needsWarmup('ex', [], NOW), true, 'first of the day');

console.log('All routine scenarios passed.');

// Skip tokens: a skipped item completes the period, spends a weekly token, never feeds a quota.
{
  const { isSkipped, skipsLeft, itemProgress: ip } = await import('../src/routines.js');
  const r = { id: 'd2', name: 'Daily', cadence: 'daily', items: [{ id: 'x', type: 'task', text: 'floss' }] };
  const key = `d:${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const done = { d2: { [key]: { x: -1 } } };
  assert.equal(isSkipped(r, r.items[0], done, today), true);
  assert.equal(ip(r, r.items[0], { tasks: [], routineDone: done, routineLog: [] }, today).complete, true);
  assert.equal(skipsLeft(r, done, today), 1);
  assert.equal(skipsLeft({ ...r, skipsPerWeek: 5 }, done, today), 4);
  const quota = { id: 'q', name: 'Q', cadence: 'daily', items: [{ id: 'm', type: 'quota', routineId: 'd2', count: 1 }] };
  assert.equal(ip(quota, quota.items[0], { tasks: [], routineDone: done, routineLog: [] }, today).done, 0, 'a skip is not a tick');
}
console.log('Skip token scenarios passed.');
