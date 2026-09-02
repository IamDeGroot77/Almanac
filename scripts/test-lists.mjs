// Exercises src/consider.js and src/calendarRules.js. Run: node scripts/test-lists.mjs
import assert from 'node:assert/strict';
import { considerations, dueForHorizon, horizonFor } from '../src/consider.js';
import { matchRules, taskTextFor } from '../src/calendarRules.js';

const DAY = 86400000;
const now = Date.now();

// ----- horizons -----
{
  const six = { id: 'l6', name: 'Within 6 months', horizonDays: 180 };
  const one = { id: 'l1', name: 'Within 1 month', horizonDays: 30 };
  const plain = { id: 'lp', name: 'Groceries' };
  assert.equal(horizonFor(six).nudgeDays, 30);
  assert.equal(horizonFor(plain).days, null);
  assert.match(dueForHorizon(one, now), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dueForHorizon(plain, now), null);

  const state = {
    lists: [six, one, plain],
    tasks: [
      { id: 'a', text: 'fresh on 6mo', listId: 'l6', createdAt: now - 3 * DAY },
      { id: 'b', text: 'old on 6mo', listId: 'l6', createdAt: now - 35 * DAY },
      { id: 'c', text: 'old but snoozed', listId: 'l6', createdAt: now - 60 * DAY, nudgedAt: now - 2 * DAY },
      { id: 'd', text: 'old on 1mo', listId: 'l1', createdAt: now - 8 * DAY },
      { id: 'e', text: 'old grocery', listId: 'lp', createdAt: now - 90 * DAY },
      { id: 'f', text: 'done', listId: 'l6', createdAt: now - 90 * DAY, done: true },
    ],
  };
  const c = considerations(state, now);
  assert.deepEqual(
    c.map((x) => x.task.id),
    ['b', 'd'],
    'only tasks past their nudge, not snoozed, not done, not on plain lists; oldest first'
  );
  assert.equal(c[0].waitedDays, 35);
}

// ----- calendar rules -----
{
  const rules = [{ id: 'r1', keyword: 'city', listId: 'rep', template: 'Write article: {title}', dueDays: 1 }];
  const events = [
    { id: 'e1', title: 'City council meeting', startMs: now - 5 * 3600000, endMs: now - 3 * 3600000, location: 'City Hall' },
    { id: 'e2', title: 'City budget hearing', startMs: now + 3600000, endMs: now + 7200000 }, // not over yet
    { id: 'e3', title: 'Dentist', startMs: now - 3 * 3600000, endMs: now - 2 * 3600000 },
    { id: 'e4', title: 'City parade', startMs: now - 10 * DAY, endMs: now - 10 * DAY + 3600000 }, // too old
  ];
  const made = matchRules(events, rules, {}, now);
  assert.equal(made.length, 1);
  assert.equal(made[0].text, 'Write article: City council meeting');
  assert.equal(made[0].listId, 'rep');
  assert.match(made[0].due, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(made[0].notes, /City Hall/);

  // Already generated: skipped.
  assert.equal(matchRules(events, rules, { 'e1:r1': 't1' }, now).length, 0);

  // Template placeholders.
  assert.match(taskTextFor({ template: 'Follow up on {title} ({date})' }, events[0]), /^Follow up on City council meeting \(/);
  assert.equal(taskTextFor({}, events[2]), 'Dentist');
}

console.log('All list scenarios passed.');
