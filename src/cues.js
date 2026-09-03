import { parseDayKey } from './dates.js';
import { parseDueInput, parseTimeInput } from './due.js';

// "When and where" becomes a cue. The plan text on a task is free text, but
// if it names a time ("after lunch", "tonight", "Tuesday 2pm", "at 9:30") the
// reminder fires on that cue, which is what makes an intention actually fire.

const PHRASES = [
  [/\bfirst thing\b|\bwhen i(?:'m| am) up\b/i, '07:30'],
  [/\bmid-?morning\b/i, '10:00'],
  [/\bbefore lunch\b|\blate morning\b/i, '11:30'],
  [/\bat lunch\b|\blunchtime\b/i, '12:30'],
  [/\bafter lunch\b|\bearly afternoon\b/i, '13:30'],
  [/\bmid-?afternoon\b/i, '15:00'],
  [/\bafter work\b|\bafter class\b|\bafter school\b|\blate afternoon\b/i, '16:30'],
  [/\bbefore dinner\b/i, '17:30'],
  [/\bat dinner\b|\bdinnertime\b/i, '18:30'],
  [/\bafter dinner\b|\bthis evening\b|\bin the evening\b|\bevening\b/i, '19:30'],
  [/\btonight\b|\bbefore bed\b|\blate\b/i, '21:00'],
  [/\bmorning\b/i, '09:00'],
  [/\bafternoon\b/i, '14:00'],
  [/\bnoon\b/i, '12:00'],
];

const DAY_WORDS = /\b(today|tomorrow|tmrw|mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)\b/i;

// Returns { at, time, dayKey, label } or null.
export function cueFromPlan(plan, { now = new Date(), taskDue = null } = {}) {
  const text = (plan || '').trim();
  if (!text) return null;
  let time = null;
  const explicit = text.match(/\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2})\b/i);
  if (explicit) time = parseTimeInput(explicit[1]);
  if (!time) {
    for (const [re, t] of PHRASES) {
      if (re.test(text)) {
        time = t;
        break;
      }
    }
  }
  if (!time) return null;
  let key = null;
  const dayWord = text.match(DAY_WORDS);
  if (dayWord) key = parseDueInput(dayWord[1]);
  const date = text.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (!key && date) key = parseDueInput(date[0]);
  if (!key && taskDue) key = taskDue;
  const [h, m] = time.split(':').map(Number);
  const base = key ? parseDayKey(key) : new Date(now);
  base.setHours(h, m, 0, 0);
  // No day named and the time has passed: mean tomorrow.
  if (!key && base.getTime() < now.getTime() - 60000) base.setDate(base.getDate() + 1);
  const y = base.getFullYear();
  const mo = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return { at: base.getTime(), time, dayKey: `${y}-${mo}-${d}`, label: text };
}
