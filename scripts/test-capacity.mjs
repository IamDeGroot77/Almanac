// Exercises src/capacity.js. Run: node scripts/test-capacity.mjs
import assert from 'node:assert/strict';
import { capacityFor, describeCapacity } from '../src/capacity.js';

const H = 3600000;
const at = (h, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

// 2 PM, three tasks: 1h, 30m, and one without an estimate (20m default). Bed at 11 PM: fits.
{
  const c = capacityFor([{ id: 'a', estimateMs: H }, { id: 'b', estimateMs: 30 * 60000 }, { id: 'c' }], { now: at(14), bedtimeHour: 23 });
  assert.equal(c.count, 3);
  assert.equal(c.remainingMs, H + 30 * 60000 + 20 * 60000);
  assert.equal(c.unestimated, 1);
  assert.equal(c.over, false);
  assert.match(describeCapacity(c), /^~1h 50m left · finishing/);
}

// 9 PM with 3h of work and bed at 11: over by an hour.
{
  const c = capacityFor([{ id: 'a', estimateMs: 3 * H }], { now: at(21), bedtimeHour: 23 });
  assert.equal(c.over, true);
  assert.equal(Math.round(c.overByMs / H), 1);
  assert.match(describeCapacity(c), /past bedtime by 60m$/);
}

// Time already spent counts against the estimate; done tasks and steps are ignored.
{
  const c = capacityFor([{ id: 'a', estimateMs: H, spentMs: 45 * 60000 }, { id: 'd', done: true, estimateMs: H }, { id: 's', parentId: 'a', estimateMs: H }], { now: at(10), bedtimeHour: 23 });
  assert.equal(c.count, 1);
  assert.equal(c.remainingMs, 15 * 60000);
}

// Bedtime of 1 AM while it is 11 PM: bed is tomorrow, not "already passed".
{
  const c = capacityFor([{ id: 'a', estimateMs: H }], { now: at(23), bedtimeHour: 1 });
  assert.equal(c.over, false);
}

assert.equal(capacityFor([], {}), null);
console.log('All capacity scenarios passed.');
