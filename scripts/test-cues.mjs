// Exercises src/cues.js. Run: node scripts/test-cues.mjs
import assert from 'node:assert/strict';
import { cueFromPlan } from '../src/cues.js';

const now = new Date(2026, 8, 3, 9, 0, 0, 0); // Thu Sep 3, 9:00
const hm = (c) => `${new Date(c.at).getHours()}:${String(new Date(c.at).getMinutes()).padStart(2, '0')}`;
const day = (c) => new Date(c.at).getDate();

assert.equal(cueFromPlan('', { now }), null);
assert.equal(cueFromPlan('at the kitchen table', { now }), null, 'a place alone is not a cue');

let c = cueFromPlan('after lunch at the kitchen table', { now });
assert.equal(hm(c), '13:30');
assert.equal(day(c), 3);

c = cueFromPlan('tonight', { now });
assert.equal(hm(c), '21:00');

c = cueFromPlan('Tuesday after lunch', { now });
assert.equal(hm(c), '13:30');
assert.equal(new Date(c.at).getDay(), 2, 'named weekday');

c = cueFromPlan('at 2pm', { now });
assert.equal(hm(c), '14:00');

c = cueFromPlan('first thing', { now });
assert.equal(day(c), 4, 'a time already past today means tomorrow');

c = cueFromPlan('9:30 in the library', { now, taskDue: '2026-09-10' });
assert.equal(hm(c), '9:30');
assert.equal(day(c), 10, 'no day named: the task due date is the day');

c = cueFromPlan('9/12 after dinner', { now });
assert.equal(day(c), 12);
assert.equal(hm(c), '19:30');

console.log('All cue scenarios passed.');
