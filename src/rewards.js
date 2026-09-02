// A small, unpredictable reward on Finish. Predictable badges stop working;
// a line that shows up sometimes keeps its pull. Nothing here shrinks or
// resets, and nothing scolds.

const LINES = [
  'Done is done.',
  'That one was real.',
  'Momentum.',
  'Future you says thanks.',
  'One less thing in your head.',
  'Quietly excellent.',
  'You started. That was the hard part.',
  'Logged. It counts.',
  'The almanac remembers this one.',
  'Small step, real step.',
  'On the board.',
  'Nice.',
];

const CHANCE = 0.4;

export function maybeReward({ durationMs, estimateMs, carriedCount, isStep } = {}) {
  // Always celebrate a task that had been carried over, or that beat its estimate.
  const earned = (carriedCount || 0) >= 2 || (estimateMs && durationMs && durationMs <= estimateMs);
  if (isStep) return null;
  if (!earned && Math.random() > CHANCE) return null;
  let line = LINES[Math.floor(Math.random() * LINES.length)];
  if ((carriedCount || 0) >= 2) line = 'That one had been waiting. Not anymore.';
  else if (estimateMs && durationMs && durationMs <= estimateMs * 0.75) line = 'Faster than you thought.';
  return line;
}
