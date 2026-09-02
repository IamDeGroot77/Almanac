// Exercises src/journal.js. Run: node scripts/test-journal.mjs
import assert from 'node:assert/strict';
import { journalDays, mergeJournals, promptForDay, journalCount, PROMPTS } from '../src/journal.js';

const now = Date.now();
const e = (id, at, text, extra = {}) => ({ id, at, text, source: 'typed', ...extra });

// Days newest first, entries newest first, search filters entries.
{
  const journal = {
    '2026-09-01': [e('a', now - 90000, 'walked to campus'), e('b', now - 80000, 'ate twice')],
    '2026-09-02': [e('c', now - 1000, 'skipped the gym')],
  };
  const days = journalDays(journal);
  assert.deepEqual(days.map((d) => d.key), ['2026-09-02', '2026-09-01']);
  assert.deepEqual(days[1].entries.map((x) => x.id), ['b', 'a']);
  const found = journalDays(journal, { query: 'GYM' });
  assert.equal(found.length, 1);
  assert.equal(found[0].entries[0].id, 'c');
  assert.equal(journalCount(journal, now - 100000, now), 3);
}

// Merge: union by id, newest wins, deletions win over older copies.
{
  const phone = { '2026-09-02': [e('x', now - 5000, 'first draft'), e('y', now - 4000, 'phone only')] };
  const laptop = { '2026-09-02': [e('x', now - 5000, 'edited on laptop', { updatedAt: now - 1000 })], '2026-09-01': [e('z', now - 90000, 'yesterday')] };
  const m = mergeJournals(phone, laptop);
  assert.equal(m['2026-09-02'].find((q) => q.id === 'x').text, 'edited on laptop');
  assert.equal(m['2026-09-02'].length, 2);
  assert.equal(m['2026-09-01'].length, 1);

  const gone = mergeJournals(phone, { '2026-09-02': [e('y', now - 4000, 'phone only', { deleted: true, updatedAt: now })] });
  assert.equal(gone['2026-09-02'].some((q) => q.id === 'y'), false);
}

// Prompts: stable within a day, drawn from the list.
assert.equal(promptForDay('2026-09-02'), promptForDay('2026-09-02'));
assert.ok(PROMPTS.includes(promptForDay('2026-09-03')));

console.log('All journal scenarios passed.');
