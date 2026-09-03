// Exercises src/dayAuto.js. Run: node scripts/test-dayauto.mjs
import assert from 'node:assert/strict';
import { planAutoStart, MIN_SLEEP_GAP_MS } from '../src/dayAuto.js';
import { dayOpenAt } from '../src/clock.js';

const H = 3600000;
const key = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// A fixed "now": 9:00 this morning.
const now = new Date();
now.setHours(9, 0, 0, 0);
const NOW = now.getTime();
const TODAY = key(NOW);
const YESTERDAY = key(NOW - 24 * H);

// 1. Nothing known: first open ever starts the day now.
{
  const p = planAutoStart({ days: {}, usage: {} }, NOW);
  assert.equal(p.startKey, TODAY);
  assert.equal(p.wokeAt, NOW);
  assert.equal(p.source, 'open');
  assert.equal(p.closeKey, null);
}

// 2. Already up today: nothing.
assert.equal(planAutoStart({ days: { [TODAY]: { wokeAt: NOW - H, sleptAt: null } }, usage: {} }, NOW), null);

// 3. Yesterday still open, phone untouched for 7 hours: close it at last activity, start today.
{
  const state = { days: { [YESTERDAY]: { wokeAt: NOW - 20 * H, sleptAt: null, lastActiveAt: NOW - 7 * H } }, usage: {} };
  const p = planAutoStart(state, NOW);
  assert.equal(p.closeKey, YESTERDAY);
  assert.equal(p.closeAt, NOW - 7 * H);
  assert.equal(p.startKey, TODAY);
  assert.equal(p.source, 'open');
}

// 4. Night owl still going at 2 AM: last activity 20 minutes ago, no new day.
{
  const twoAm = new Date(NOW);
  twoAm.setHours(2, 0, 0, 0);
  const state = { days: { [YESTERDAY]: { wokeAt: twoAm.getTime() - 16 * H, sleptAt: null, lastActiveAt: twoAm.getTime() - 20 * 60000 } }, usage: {} };
  assert.equal(planAutoStart(state, twoAm.getTime()), null);
}

// 5. Detected sleep beats the gap rule: used the phone 2 hours ago, but the
//    phone saw sleep end 1 hour ago (a lie-in with a scroll at 7). Start at
//    the detected wake, close yesterday at the detected bedtime.
{
  const state = {
    days: {
      [YESTERDAY]: { wokeAt: NOW - 22 * H, sleptAt: null, lastActiveAt: NOW - 9 * H },
      [TODAY]: { sleep: { start: NOW - 8 * H, end: NOW - H, source: 'phone' } },
    },
    usage: { [TODAY]: { opens: 1, lastAt: NOW - 2 * H } },
  };
  // last activity is the open at NOW-2h, which is before the detected wake, so it counts as slept since.
  const p = planAutoStart(state, NOW);
  assert.ok(p, 'expected a plan');
  assert.equal(p.source, 'sleep');
  assert.equal(p.wokeAt, NOW - H);
  assert.equal(p.closeAt, NOW - 8 * H);
}

// 6. Activity after the detected wake, and less than the gap: no restart.
{
  const state = {
    days: { [TODAY]: { sleep: { start: NOW - 9 * H, end: NOW - 3 * H } } },
    usage: { [TODAY]: { opens: 2, lastAt: NOW - H } },
  };
  assert.equal(planAutoStart(state, NOW), null);
}

// 7. Gap just under the threshold: nothing; at the threshold: start.
{
  const under = { days: {}, usage: { [TODAY]: { opens: 1, lastAt: NOW - MIN_SLEEP_GAP_MS + 60000 } } };
  assert.equal(planAutoStart(under, NOW), null);
  const at = { days: {}, usage: { [TODAY]: { opens: 1, lastAt: NOW - MIN_SLEEP_GAP_MS } } };
  assert.equal(planAutoStart(at, NOW)?.startKey, TODAY);
}

// 8. Today started and closed already (an early night after midnight logged under today): leave it.
assert.equal(planAutoStart({ days: { [TODAY]: { wokeAt: NOW - 8 * H, sleptAt: NOW - 6 * H } }, usage: {} }, NOW), null);

// 9. Yesterday's day still open at 9 AM after 22 hours, with activity stamped 10 minutes ago
//    (a sync or a laptop left open): it is still over. Close it and start today.
{
  const state = { days: { [YESTERDAY]: { wokeAt: NOW - 22 * H, sleptAt: null, lastActiveAt: NOW - 10 * 60000 } }, usage: {} };
  const p = planAutoStart(state, NOW);
  assert.ok(p, 'overlong day is closed');
  assert.equal(p.closeKey, YESTERDAY);
  assert.equal(p.startKey, TODAY);
}
// 10. But an 18-hour day at 1 AM with activity 10 minutes ago is a night owl, not a stale day.
{
  const oneAm = new Date(NOW);
  oneAm.setHours(1, 0, 0, 0);
  const state = { days: { [YESTERDAY]: { wokeAt: oneAm.getTime() - 18 * H, sleptAt: null, lastActiveAt: oneAm.getTime() - 10 * 60000 } }, usage: {} };
  assert.equal(planAutoStart(state, oneAm.getTime()), null);
}

// 11. A "Going to bed" tap replayed the next morning applies to the day that was
//     open when the notification showed (11 PM last night), not to today.
{
  const bedAt = NOW - 10 * H; // 11 PM
  const still = { [YESTERDAY]: { wokeAt: NOW - 25 * H, sleptAt: null } };
  assert.equal(dayOpenAt(still, bedAt), YESTERDAY);
  // Yesterday auto-closed by a guess and today already started: the tap still names yesterday.
  const guessed = { [YESTERDAY]: { wokeAt: NOW - 25 * H, sleptAt: NOW - 9 * H, implicitClose: true }, [TODAY]: { wokeAt: NOW - H, sleptAt: null } };
  assert.equal(dayOpenAt(guessed, bedAt), YESTERDAY);
  // Closed on purpose already: nothing to apply.
  const closed = { [YESTERDAY]: { wokeAt: NOW - 25 * H, sleptAt: NOW - 9 * H }, [TODAY]: { wokeAt: NOW - H, sleptAt: null } };
  assert.equal(dayOpenAt(closed, bedAt), null);
  // A tap from before the day started names nothing.
  assert.equal(dayOpenAt({ [TODAY]: { wokeAt: NOW - H, sleptAt: null } }, NOW - 2 * H), null);
}

console.log('All auto-start scenarios passed.');
