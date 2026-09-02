import { formatDuration } from './durations.js';
import { estimateAccuracy } from './insights.js';
import { dayKey } from './dates.js';

// A short plain-language letter about the week, written from the data the
// app already keeps. Pure, so it runs in Node for checks.

const DAY = 86400000;

export function composeWeeklyLetter(store, now = Date.now()) {
  const start = now - 7 * DAY;
  const done = store.tasks.filter((t) => t.done && t.doneAt >= start && !t.parentId);
  const log = store.timeLog.filter((e) => e.doneAt >= start);
  const tracked = log.reduce((s, e) => s + (e.durationMs || 0), 0);
  const carried = store.tasks.filter((t) => !t.done && (t.carriedCount || 0) >= 2);
  const est = estimateAccuracy(log);
  const days = Object.entries(store.days || {})
    .map(([key, d]) => ({ key, ...d }))
    .filter((d) => d.wokeAt && d.wokeAt >= start);
  const energy = days.filter((d) => d.energy?.wake).map((d) => d.energy.wake);
  const avgEnergy = energy.length ? energy.reduce((a, b) => a + b, 0) / energy.length : null;

  const byDay = new Map();
  for (const t of done) {
    const k = dayKey(new Date(t.doneAt));
    byDay.set(k, (byDay.get(k) || 0) + 1);
  }
  const best = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];

  const lines = [];
  if (done.length === 0 && log.length === 0) {
    lines.push('A quiet week in the almanac. Nothing finished on the record yet, which is data too.');
  } else {
    lines.push(
      `You finished ${done.length} ${done.length === 1 ? 'thing' : 'things'} this week` +
        (tracked ? `, with ${formatDuration(tracked)} on the clock.` : '.')
    );
  }
  if (best) {
    const d = new Date(best[0] + 'T12:00:00');
    lines.push(`${d.toLocaleDateString([], { weekday: 'long' })} was the best day, ${best[1]} done.`);
  }
  if (est) {
    if (est.median > 1.3) lines.push(`Things ran about ${Math.round(est.median * 100)}% of their estimates. Plan for that, not against it.`);
    else if (est.median < 0.8) lines.push('You beat your estimates most of the time. Trust the guesses a little more.');
    else lines.push('Your estimates were close to reality. That is rarer than it sounds.');
    if (est.misses[0] && est.misses[0].ratio > 1.5) {
      lines.push(
        `The biggest miss: "${est.misses[0].text}", ${formatDuration(est.misses[0].durationMs)} against ~${formatDuration(est.misses[0].estimateMs)}.`
      );
    }
  }
  if (carried.length) {
    lines.push(
      `${carried.length === 1 ? 'One thing keeps' : `${carried.length} things keep`} slipping: ${carried
        .slice(0, 3)
        .map((t) => `"${t.text}"`)
        .join(', ')}. Break one into a two-minute first step, or let it go on purpose.`
    );
  }
  if (avgEnergy != null) {
    const word = avgEnergy < 1.7 ? 'low' : avgEnergy < 2.4 ? 'okay' : 'good';
    lines.push(`Mornings averaged ${word} energy across ${energy.length} ${energy.length === 1 ? 'check' : 'checks'}.`);
  }
  const sleeps = days.filter((d) => d.sleep).map((d) => d.sleep.end - d.sleep.start);
  if (sleeps.length) lines.push(`Detected sleep averaged ${formatDuration(sleeps.reduce((a, b) => a + b, 0) / sleeps.length)}.`);
  lines.push('Next week starts with whatever you tap first. Make it small.');
  return lines.join('\n\n');
}
