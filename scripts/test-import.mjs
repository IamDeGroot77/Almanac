// Exercises src/importText.js. Run: node scripts/test-import.mjs
import assert from 'node:assert/strict';
import { parseImport, parseTaskLine } from '../src/importText.js';

const people = [
  { id: 'me', name: 'Me' },
  { id: 'zeke', name: 'Zeke' },
];
const lists = [{ id: 'l1', name: 'Groceries' }];
const findPerson = (n) => (n.toLowerCase() === 'zeke' ? 'zeke' : n.toLowerCase() === 'me' ? null : undefined);

// 1. Headers, bullets, steps, an existing list reused, a new one created.
{
  const plan = parseImport(
    `groceries:
- milk
- eggs
School:
- read chapter 4 by 9/15
  - find the pdf
  - skim first
Today:
- call the dentist 2pm
`,
    { people, lists }
  );
  assert.equal(plan.counts.tasks, 4);
  assert.equal(plan.counts.steps, 2);
  assert.equal(plan.counts.lists, 3);
  assert.equal(plan.counts.newLists, 1);
  assert.equal(plan.lists[0].id, 'l1');
  assert.equal(plan.lists[0].name, 'Groceries');
  assert.equal(plan.lists[1].isNew, true);
  const read = plan.lists[1].tasks[0];
  assert.equal(read.text, 'read chapter 4');
  assert.match(read.due, /^\d{4}-09-15$/);
  assert.equal(read.steps.length, 2);
  assert.ok(plan.lists[2].id.startsWith('day:'));
  const dentist = plan.lists[2].tasks[0];
  assert.equal(dentist.text, 'call the dentist');
  assert.equal(dentist.due, null, 'a time without a date does not set a due date');
}

// 2. Lines before any header land in Inbox; plain lines count as tasks.
{
  const plan = parseImport('fix the fence\nbuy stamps', { people, lists });
  assert.equal(plan.lists[0].name, 'Inbox');
  assert.equal(plan.counts.tasks, 2);
}

// 3. Person tags, notes, and date words.
{
  const t = parseTaskLine('sign the permission slip for zeke', findPerson);
  assert.equal(t.text, 'sign the permission slip');
  assert.equal(t.personId, 'zeke');

  const u = parseTaskLine('pay rent by fri 5pm // use the portal', findPerson);
  assert.equal(u.text, 'pay rent');
  assert.ok(u.due);
  assert.equal(u.dueTime, '17:00');
  assert.equal(u.notes, 'use the portal');

  const v = parseTaskLine('email the professor tomorrow', findPerson);
  assert.equal(v.text, 'email the professor');
  assert.ok(v.due);

  // A trailing ordinary word is not a date.
  const w = parseTaskLine('clean the garage door', findPerson);
  assert.equal(w.text, 'clean the garage door');
  assert.equal(w.due, null);

  // "for" followed by a non-person stays in the text.
  const x = parseTaskLine('buy a present for grandma', findPerson);
  assert.equal(x.text, 'buy a present for grandma');
}

// 4. Numbered lists and markdown headers.
{
  const plan = parseImport('# Car\n1. oil change\n2) new wipers', { people, lists });
  assert.equal(plan.lists[0].name, 'Car');
  assert.equal(plan.counts.tasks, 2);
}

console.log('All import scenarios passed.');
