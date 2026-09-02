// Exercises src/canvas/sync.js against a fake Canvas API. Run: node scripts/test-canvas.mjs
import assert from 'node:assert/strict';
import { runCanvasSync, fetchCanvasData } from '../src/canvas/sync.js';
import { makeCanvasApi, normalizeHost } from '../src/canvas/api.js';

const day = 86400000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// ---- fake Canvas over fetch ----------------------------------------------
const courses = [
  { id: 1, name: 'English 101', course_code: 'ENG101', enrollments: [{ type: 'student', computed_current_score: 91.5, computed_current_grade: 'A-' }] },
  { id: 2, name: 'Algebra', course_code: 'MATH110', enrollments: [{ type: 'student', computed_current_score: 78, computed_current_grade: 'C+' }] },
];
const assignments = {
  1: [
    { id: 11, name: 'Essay 1', due_at: iso(now + 3 * day), points_possible: 100, html_url: 'u/11', submission: { workflow_state: 'unsubmitted' } },
    { id: 12, name: 'Reading quiz', due_at: iso(now - 2 * day), points_possible: 10, html_url: 'u/12', submission: { workflow_state: 'graded', submitted_at: iso(now - 3 * day), score: 9 } },
    { id: 13, name: 'Old thing', due_at: iso(now - 60 * day), points_possible: 10, html_url: 'u/13', submission: { workflow_state: 'graded', score: 10 } },
  ],
  2: [
    { id: 21, name: 'Problem set 4', due_at: iso(now + 1 * day + 3600000), points_possible: 20, html_url: 'u/21', submission: { workflow_state: 'unsubmitted' } },
    { id: 22, name: 'No due date', due_at: null, points_possible: 5, html_url: 'u/22', submission: { workflow_state: 'unsubmitted' } },
  ],
};

let pages = 0;
globalThis.fetch = async (url, init) => {
  const u = new URL(url);
  assert.equal(init.headers.Authorization, 'Bearer tok', 'bearer header');
  const ok = (data, link = '') => ({ ok: true, status: 200, json: async () => data, headers: { get: (k) => (k.toLowerCase() === 'link' ? link : null) } });
  if (u.pathname === '/api/v1/users/self') return ok({ id: 7, name: 'Nick' });
  if (u.pathname === '/api/v1/courses') {
    // Two pages to exercise Link pagination.
    if (!u.searchParams.get('page')) {
      pages++;
      return ok([courses[0]], `<${u.origin}/api/v1/courses?page=2&per_page=100>; rel="next"`);
    }
    return ok([courses[1]]);
  }
  const m = u.pathname.match(/^\/api\/v1\/courses\/(\d+)\/assignments$/);
  if (m) return ok(assignments[m[1]] || []);
  return { ok: false, status: 404, json: async () => ({ message: 'nope' }), headers: { get: () => null } };
};

// ---- scenario ------------------------------------------------------------
assert.equal(normalizeHost('school.instructure.com/courses/3'), 'https://school.instructure.com');
assert.equal(normalizeHost('https://x.edu'), 'https://x.edu');

const api = makeCanvasApi('school.instructure.com', 'tok');
assert.equal((await api.self()).name, 'Nick');
const data = await fetchCanvasData(api);
assert.equal(data.length, 2, 'both pages of courses fetched');

let state = { lists: [{ id: 'l1', name: 'Groceries', createdAt: 1, updatedAt: 1 }], tasks: [] };
let r = runCanvasSync(state, data, now);
state = { ...state, lists: r.lists, tasks: r.tasks, canvas: r.canvas };

const school = state.lists.find((l) => l.canvas);
assert.ok(school && school.name === 'School', 'School list created');
const names = state.tasks.map((t) => t.text).sort();
assert.deepEqual(names, ['Essay 1', 'No due date', 'Problem set 4', 'Reading quiz'], 'old assignment skipped, others present');
const essay = state.tasks.find((t) => t.text === 'Essay 1');
assert.equal(essay.listId, school.id);
assert.equal(essay.canvasCourse, 'ENG101');
assert.ok(essay.due && !essay.done);
const quiz = state.tasks.find((t) => t.text === 'Reading quiz');
assert.equal(quiz.done, true, 'graded is done');
assert.equal(quiz.canvasScore, 9);
const pset = state.tasks.find((t) => t.text === 'Problem set 4');
assert.ok(pset.dueTime, 'a non-midnight deadline keeps its time');
assert.equal(state.canvas.courses.length, 2);
assert.equal(state.canvas.courses[0].grade, 'A-');
console.log('1. initial pull ok');

// Local extras survive; submission flips done; renamed assignment updates text.
state.tasks = state.tasks.map((t) => (t.text === 'Essay 1' ? { ...t, estimateMs: 3600000, startedAt: now } : t));
assignments[1][0] = { ...assignments[1][0], name: 'Essay 1 (revised)', submission: { workflow_state: 'submitted', submitted_at: iso(now + 1000) } };
const data2 = await fetchCanvasData(api);
r = runCanvasSync(state, data2, now + 5000);
state = { ...state, lists: r.lists, tasks: r.tasks, canvas: r.canvas };
const essay2 = state.tasks.find((t) => t.canvasId === 'canvas:11');
assert.equal(essay2.text, 'Essay 1 (revised)');
assert.equal(essay2.done, true, 'submission marks done');
assert.equal(essay2.estimateMs, 3600000, 'estimate kept');
assert.equal(state.tasks.length, 4, 'no duplicates');
console.log('2. update keeps local extras ok');

// Assignment removed from Canvas: unfinished one disappears, finished one stays.
assignments[2] = assignments[2].filter((a) => a.id !== 22);
assignments[1] = assignments[1].filter((a) => a.id !== 12);
const data3 = await fetchCanvasData(api);
r = runCanvasSync(state, data3, now + 9000);
state = { ...state, lists: r.lists, tasks: r.tasks, canvas: r.canvas };
assert.ok(!state.tasks.find((t) => t.text === 'No due date'), 'removed unfinished assignment dropped');
assert.ok(state.tasks.find((t) => t.text === 'Reading quiz'), 'finished assignment kept for history');
assert.equal(state.tasks.find((t) => t.text === 'Groceries')?.text, undefined);
assert.equal(state.lists.length, 2, 'Groceries list untouched');
console.log('3. removals ok');

console.log('\nAll Canvas scenarios passed.');
