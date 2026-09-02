// Exercises src/scratch.js. Run: node scripts/test-scratch.mjs
import assert from 'node:assert/strict';
import { liveScratch, staleScratch, mergeScratch, describeScratchAge } from '../src/scratch.js';

const now = Date.now();
const n = (id, at, text, extra = {}) => ({ id, at, text, source: 'typed', ...extra });

{
  const notes = [n('a', now - 5000, 'call back at 3'), n('b', now - 2 * 86400000, 'old thought'), n('c', now - 1000, 'gone', { deleted: true })];
  assert.deepEqual(liveScratch(notes).map((x) => x.id), ['a', 'b']);
  assert.deepEqual(staleScratch(notes, now).map((x) => x.id), ['b']);
  assert.equal(describeScratchAge(n('x', now - 120000, ''), now), '2m ago');
  assert.equal(describeScratchAge(n('x', now - 86400000, ''), now), 'yesterday');
}

{
  const phone = [n('a', now - 5000, 'first'), n('b', now - 4000, 'phone only')];
  const laptop = [n('a', now - 5000, 'edited', { updatedAt: now - 1000 }), n('b', now - 4000, 'phone only', { deleted: true, updatedAt: now })];
  const m = mergeScratch(phone, laptop);
  assert.equal(m.length, 1);
  assert.equal(m[0].text, 'edited');
}

console.log('All scratch scenarios passed.');
