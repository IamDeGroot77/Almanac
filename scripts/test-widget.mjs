// Exercises src/widget/model.js. Run: node scripts/test-widget.mjs
import assert from 'node:assert/strict';
import { widgetModel } from '../src/widget/model.js';

const now = new Date();
now.setHours(14, 0, 0, 0);
const NOW = now.getTime();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// Running task wins.
{
  const m = widgetModel({ tasks: [{ id: 'a', text: 'write the memo', startedAt: NOW - 600000, estimateMs: 1800000, listId: `day:${today}` }], lists: [], days: {}, prefs: {} }, NOW);
  assert.equal(m.kicker, 'Now');
  assert.equal(m.title, 'write the memo');
  assert.match(m.sub, /running · ~30 min/);
  assert.equal(m.running, true);
}

// No running task: best pick, block-aware, with the first step.
{
  const state = {
    tasks: [
      { id: 'g', text: 'grocery run', listId: 'gro', createdAt: 1 },
      { id: 'w', text: 'draft newsletter', listId: 'gfd', createdAt: 2, firstStep: 'open the doc' },
      { id: 'd', text: 'done thing', listId: `day:${today}`, done: true, doneAt: NOW - 3600000 },
    ],
    lists: [
      { id: 'gro', name: 'Groceries', categoryId: 'home' },
      { id: 'gfd', name: 'GFD', categoryId: 'work' },
    ],
    categories: [{ id: 'work', name: 'Work' }],
    prefs: { dayBlocks: [{ id: 'b', categoryId: 'work', start: '13:00', end: '16:00', days: [] }] },
    days: {},
  };
  const m = widgetModel(state, NOW);
  assert.match(m.kicker, /^Work time/);
  assert.equal(m.title, 'draft newsletter');
  assert.equal(m.sub, 'Start with: open the doc');
  assert.equal(m.doneToday, 1);
  assert.equal(m.openToday, 0);
  assert.equal(m.finish, null);
}

// Empty state.
{
  const m = widgetModel({ tasks: [], lists: [], days: {}, prefs: {} }, NOW);
  assert.equal(m.title, 'Nothing lined up');
  assert.equal(m.taskId, null);
}

console.log('All widget scenarios passed.');
