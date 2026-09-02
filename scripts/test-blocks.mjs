// Exercises src/blocks.js. Run: node scripts/test-blocks.mjs
import assert from 'node:assert/strict';
import { blocksForDay, currentBlock, nextBlock, categoryTasks, describeBlockDays } from '../src/blocks.js';

const blocks = [
  { id: 'w', categoryId: 'work', start: '13:00', end: '16:00', days: [1, 2, 3, 4, 5] },
  { id: 'h', categoryId: 'home', start: '17:00', end: '18:30', days: [] },
  { id: 'n', categoryId: 'night', start: '23:00', end: '01:00', days: [] },
];

// A Wednesday at 2 PM.
const wed = new Date(2026, 8, 2, 14, 0, 0, 0);
assert.equal(wed.getDay(), 3);

{
  const today = blocksForDay(blocks, wed);
  assert.deepEqual(today.map((b) => b.id), ['w', 'h', 'n']);
  assert.equal(today[2].endMs - today[2].startMs, 2 * 3600000, 'a block past midnight spans into the next day');
  assert.equal(currentBlock(blocks, wed.getTime()).id, 'w');
  assert.equal(nextBlock(blocks, wed.getTime()).id, 'h');
}

// Saturday: no work block; next after 7 PM is the night block.
{
  const sat = new Date(2026, 8, 5, 19, 0, 0, 0);
  assert.deepEqual(blocksForDay(blocks, sat).map((b) => b.id), ['h', 'n']);
  assert.equal(currentBlock(blocks, sat.getTime()), null);
  assert.equal(nextBlock(blocks, sat.getTime()).id, 'n');
}

// Late Sunday night after the last block: next is Monday's first block.
{
  const sunLate = new Date(2026, 8, 6, 23, 30, 0, 0);
  assert.equal(currentBlock(blocks, sunLate.getTime()).id, 'n');
  const after = new Date(2026, 8, 7, 1, 30, 0, 0); // Monday 1:30 AM, after the night block ended at 1
  assert.equal(currentBlock(blocks, after.getTime()), null);
  assert.equal(nextBlock(blocks, after.getTime()).id, 'w');
}

// Category tasks come from every list in the category, steps and done excluded.
{
  const lists = [
    { id: 'gfd', name: 'GFD', categoryId: 'work' },
    { id: 'rep', name: 'Reporter', categoryId: 'work' },
    { id: 'gro', name: 'Groceries', categoryId: 'home' },
  ];
  const tasks = [
    { id: '1', listId: 'gfd', text: 'a' },
    { id: '2', listId: 'rep', text: 'b' },
    { id: '3', listId: 'rep', text: 'step', parentId: '2' },
    { id: '4', listId: 'gro', text: 'milk' },
    { id: '5', listId: 'gfd', text: 'done', done: true },
  ];
  assert.deepEqual(categoryTasks(tasks, lists, 'work').map((t) => t.id), ['1', '2']);
}

assert.equal(describeBlockDays([1, 2, 3, 4, 5]), 'Weekdays');
assert.equal(describeBlockDays([]), 'Every day');
assert.equal(describeBlockDays([2, 4]), 'Tue, Thu');

console.log('All block scenarios passed.');
