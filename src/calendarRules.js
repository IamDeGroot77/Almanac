import { dayKey } from './dates.js';

// Calendar rules: when an event whose title contains a keyword has finished,
// make a task from it. "city meeting" -> "Write article: City council meeting"
// on the Reporter list, due the next day.
//
//   rule: { id, keyword, listId, template, dueDays }
//   event: { id, title, startMs, endMs }
//   eventTasks: { [eventId]: taskId } already generated

const DAY = 86400000;
const LOOKBACK_MS = 3 * DAY;

export function taskTextFor(rule, event) {
  const template = rule.template?.trim() || '{title}';
  const date = new Date(event.startMs || event.endMs || Date.now());
  return template
    .replace(/\{title\}/gi, event.title || '')
    .replace(/\{date\}/gi, date.toLocaleDateString([], { month: 'short', day: 'numeric' }))
    .trim();
}

// Events that ended within the lookback, match a rule, and have no task yet.
export function matchRules(events, rules, eventTasks = {}, now = Date.now()) {
  const out = [];
  for (const rule of rules || []) {
    const kw = (rule.keyword || '').trim().toLowerCase();
    if (!kw || !rule.listId) continue;
    for (const ev of events || []) {
      const end = ev.endMs || ev.startMs;
      if (!end || end > now || now - end > LOOKBACK_MS) continue;
      if (eventTasks[`${ev.id}:${rule.id}`]) continue;
      if (!(ev.title || '').toLowerCase().includes(kw)) continue;
      const dueDays = Number.isFinite(rule.dueDays) ? rule.dueDays : 1;
      out.push({
        key: `${ev.id}:${rule.id}`,
        eventId: ev.id,
        ruleId: rule.id,
        listId: rule.listId,
        text: taskTextFor(rule, ev),
        due: dayKey(new Date(end + dueDays * DAY)),
        notes: `From your calendar: ${ev.title}${ev.location ? ` · ${ev.location}` : ''}`,
      });
    }
  }
  return out;
}
