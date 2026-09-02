import { parseDueInput } from './due.js';

// Turns a spoken or typed line into a task: "milk to groceries",
// "call dentist tomorrow", "sign the form for zeke", "buy tape to home for
// zeke friday". Trailing hints are peeled off in any order; the rest is the
// task text. Dependency-free so it runs in plain Node for tests.
export function parseQuickTask(text, { lists = [], people = [] } = {}) {
  let rest = (text || '').trim().replace(/\s+/g, ' ');
  let listId = null;
  let personId = null;
  let due = null;

  const stripTrailing = (re, handler) => {
    const m = rest.match(re);
    if (!m) return false;
    const ok = handler(m);
    if (ok) rest = rest.slice(0, m.index).trim().replace(/[,\s]+$/, '');
    return ok;
  };

  for (let i = 0; i < 3; i++) {
    const got =
      stripTrailing(/\s+for\s+([a-z][a-z'-]*)$/i, (m) => {
        const p = people.find((x) => x.name.toLowerCase() === m[1].toLowerCase());
        if (!p) return false;
        personId = p.id;
        return true;
      }) ||
      stripTrailing(/\s+(?:to|on|in)\s+(?:the\s+|my\s+)?(.+?)(?:\s+list)?$/i, (m) => {
        const wanted = m[1].toLowerCase();
        const l = lists.find((x) => x.name.toLowerCase() === wanted);
        if (!l) return false;
        listId = l.id;
        return true;
      }) ||
      stripTrailing(
        /\s+(today|tomorrow|tmrw|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)$/i,
        (m) => {
          const key = parseDueInput(m[1]);
          if (!key) return false;
          due = key;
          return true;
        }
      );
    if (!got) break;
  }

  rest = rest.replace(/^(?:please\s+)?(?:add|remind me to|remember to|note to self)\s+/i, '').trim();
  if (rest) rest = rest[0].toUpperCase() + rest.slice(1);
  return { text: rest, listId, personId, due };
}
