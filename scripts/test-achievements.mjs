// Exercises src/achievements.js. Run: node scripts/test-achievements.mjs
import assert from 'node:assert/strict';
import { forgivingRun, bestRun, streaks, evaluateAchievements, newlyEarned } from '../src/achievements.js';

const DAY = 86400000;
const now = new Date();
now.setHours(12, 0, 0, 0);
const NOW = now.getTime();
const key = (i) => {
  const d = new Date(NOW - i * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Forgiving runs: one miss in seven is absorbed, two are not; today in progress doesn't break it.
{
  const hits = new Set([key(1), key(2), key(3), key(5), key(6)]); // missed day 4, and today not yet
  assert.equal(forgivingRun((k) => hits.has(k), NOW), 6, 'yesterday back to day 6 with one forgiven miss');
  const two = new Set([key(1), key(2), key(4), key(6)]); // misses at 3 and 5 within a week
  assert.equal(forgivingRun((k) => two.has(k), NOW), 4, 'the forgiven day counts; the second miss ends it');
  assert.equal(forgivingRun(() => false, NOW), 0);
  assert.ok(bestRun((k) => hits.has(k), NOW) >= 6);
}

// Streaks read usage and bracketed days.
{
  const state = {
    usage: { [key(0)]: { opens: 1 }, [key(1)]: { opens: 2 }, [key(2)]: { opens: 1 } },
    days: { [key(1)]: { wokeAt: NOW - DAY, implicit: false }, [key(2)]: { wokeAt: NOW - 2 * DAY, implicit: true } },
    routines: [],
  };
  const s = streaks(state, NOW);
  assert.equal(s.find((x) => x.id === 'opened').run, 3);
  assert.equal(s.find((x) => x.id === 'bracketed').run, 1, 'an implicit day is not a started day');
}

// Achievements: progress and newly earned.
{
  const state = {
    tasks: Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, done: true, carriedCount: i === 0 ? 3 : 0 })),
    timeLog: [{ id: 'l1', taskId: 'zz', estimateMs: 600000, durationMs: 660000 }],
    journal: { [key(0)]: [{ id: 'j', at: NOW, text: 'hi' }] },
    routineDone: { r: { 'd:x': { a: -1 } } },
    stuckLog: [],
    days: {},
    usage: {},
    routines: [],
    achievements: { 'first-finish': NOW - DAY },
  };
  const all = evaluateAchievements(state, NOW);
  const byId = Object.fromEntries(all.map((a) => [a.id, a]));
  assert.equal(byId['ten-finished'].complete, true);
  assert.equal(byId['fifty-finished'].done, 13);
  assert.equal(byId['comeback'].complete, true);
  assert.equal(byId['honest-skip'].complete, true);
  assert.equal(byId['calibrated'].done, 1);
  assert.equal(byId['first-finish'].earnedAt, NOW - DAY);
  const fresh = newlyEarned(state, NOW);
  assert.ok(fresh.includes('ten-finished'));
  assert.ok(fresh.includes('journal-first'));
  assert.ok(!fresh.includes('first-finish'), 'already recorded');
}

console.log('All achievement scenarios passed.');
