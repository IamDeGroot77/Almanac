// Working memory: a handful of notes you're holding right now. Not tasks,
// not a journal, just the thing you'd otherwise write on your hand. Each
// note can become a task or a journal entry in one tap, or be dropped.
//   state.scratch: [{ id, text, at, updatedAt, source, deleted? }]

const DAY = 86400000;

export function liveScratch(scratch) {
  return (scratch || []).filter((n) => !n.deleted).sort((a, b) => b.at - a.at);
}

// Notes written before today's calendar date.
export function staleScratch(scratch, now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return liveScratch(scratch).filter((n) => n.at < start.getTime());
}

export function describeScratchAge(note, now = Date.now()) {
  const age = now - note.at;
  if (age < 3600000) return `${Math.max(1, Math.round(age / 60000))}m ago`;
  if (age < DAY) return `${Math.round(age / 3600000)}h ago`;
  const d = Math.round(age / DAY);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

// Pure merge for Drive sync: union by id, newest wins, tombstones drop.
export function mergeScratch(a, b) {
  const byId = new Map();
  for (const n of [...(a || []), ...(b || [])]) {
    const cur = byId.get(n.id);
    if (!cur || (n.updatedAt || n.at) >= (cur.updatedAt || cur.at)) byId.set(n.id, n);
  }
  return [...byId.values()].filter((n) => !n.deleted).sort((x, y) => x.at - y.at).slice(-200);
}
