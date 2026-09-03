import { dayKey } from './dates.js';

// The journal: short entries stamped with the almanac day and the time.
//   state.journal: { [dayKey]: [{ id, at, text, prompt?, source }] }
// source: 'typed' | 'voice' | 'prompt' | 'letter'
// Entries are merged across devices by id, so writing on the laptop and
// speaking into the watch land on the same page.

export const PROMPTS = [
  'What went well today?',
  'What got in the way?',
  'What did I avoid, and what was I avoiding about it?',
  'What would make tomorrow easier?',
  'One thing I noticed about my energy.',
  'What am I glad I did?',
  'What do I keep telling myself I should do?',
];

export const SKIP_PROMPT = 'What went well this week, and what got in the way?';

// A prompt for the day, stable within the day, rotating across days.
export function promptForDay(key) {
  let h = 0;
  for (const ch of key || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PROMPTS[h % PROMPTS.length];
}

export function entriesFor(journal, key) {
  return [...(journal?.[key] || [])].sort((a, b) => b.at - a.at);
}

// Days with entries, newest first, each with its entries (newest first).
export function journalDays(journal, { limit = 60, query = '' } = {}) {
  const needle = query.trim().toLowerCase();
  const out = [];
  for (const key of Object.keys(journal || {}).sort().reverse()) {
    let entries = entriesFor(journal, key);
    if (needle) entries = entries.filter((e) => (e.text || '').toLowerCase().includes(needle) || (e.prompt || '').toLowerCase().includes(needle));
    if (entries.length) out.push({ key, entries });
    if (out.length >= limit) break;
  }
  return out;
}

export function journalCount(journal, from, to) {
  let n = 0;
  for (const entries of Object.values(journal || {})) for (const e of entries) if (e.at >= from && e.at < to) n += 1;
  return n;
}

// Pure merge used by Drive sync: union by id, newest text wins per id.
export function mergeJournals(a, b) {
  const out = {};
  for (const src of [a || {}, b || {}]) {
    for (const [key, entries] of Object.entries(src)) {
      const byId = new Map((out[key] || []).map((e) => [e.id, e]));
      for (const e of entries || []) {
        const cur = byId.get(e.id);
        if (!cur || (e.updatedAt || e.at) >= (cur.updatedAt || cur.at)) byId.set(e.id, e);
      }
      out[key] = [...byId.values()].filter((e) => !e.deleted).sort((x, y) => x.at - y.at);
      if (!out[key].length) delete out[key];
    }
  }
  return out;
}

export function todayKeyOf(now = Date.now()) {
  return dayKey(new Date(now));
}
