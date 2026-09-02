import { parseDueInput, parseTimeInput } from './due.js';
import { almanacDayKeyFromOffset } from './clock.js';
import { dayKey } from './dates.js';
import { HORIZONS } from './consider.js';

// Turns a pasted brain dump into lists, routines, and tasks. Pure, so it can
// be tested and previewed before anything is added.
//
//   Groceries:                     <- a list (a line ending in ":" or starting with #)
//   Within 3 months (3 months):    <- a timeline list: due in 3 months, nudges after 3 weeks
//   Zeke (for Zeke):               <- a list tagged for a person
//   GFD (in Work):                 <- a list in a category (created if new)
//   Daily checklist (daily):       <- a routine that starts over every day
//   Exercise (weekly, for me):     <- a routine that starts over every week
//   - milk                         <- a task (or a routine item)
//   - 1 from Exercise              <- in a routine: a quota, counted from that list or routine
//   - call dentist by fri 3pm      <- "by/due/on <date>" and a time set the due date
//   - pay rent 9/1 5pm             <- a trailing date and time also work
//     - find the login             <- an indented line under a task is a step
//   - sign form for zeke           <- "for <person>" tags the person
//   - book flights // check miles  <- "// note" adds a note
//   Today: / Tomorrow: / Monday:   <- headers that mean a day list
//
// Lines before any header go to a list called "Inbox".

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseImport(text, { people = [], lists = [], routines = [], categories = [], now = new Date() } = {}) {
  const plan = { lists: [], routines: [], counts: { lists: 0, newLists: 0, tasks: 0, steps: 0, routines: 0, items: 0 } };
  let current = null; // { kind: 'list' | 'routine', ... }
  let lastTask = null;

  const findPerson = (name) => {
    const n = name.toLowerCase();
    const p = people.find((x) => x.name.toLowerCase() === n || x.id.toLowerCase() === n);
    return p ? (p.id === 'me' ? null : p.id) : undefined;
  };

  const openHeader = (rawLine) => {
    const { name, options } = parseHeader(rawLine, findPerson);
    if (!name) return;
    if (options.cadence) {
      const existing = routines.find((r) => r.name.toLowerCase() === name.toLowerCase());
      current = { kind: 'routine', name: existing ? existing.name : name, id: existing?.id || null, isNew: !existing, cadence: options.cadence, personId: options.personId ?? null, items: [] };
      plan.routines.push(current);
    } else {
      const dayId = dayListFor(name, now);
      const existing = dayId ? null : lists.find((l) => l.name.toLowerCase() === name.toLowerCase());
      current = {
        kind: 'list',
        name: existing ? existing.name : name,
        id: dayId || existing?.id || null,
        isNew: !dayId && !existing,
        personId: options.personId ?? null,
        horizonDays: options.horizonDays ?? null,
        categoryName: options.categoryName ? categories.find((c) => c.name.toLowerCase() === options.categoryName.toLowerCase())?.name || options.categoryName : null,
        tasks: [],
      };
      plan.lists.push(current);
    }
    lastTask = null;
  };

  for (const raw of (text || '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trim();
    const bullet = line.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    const body = bullet ? bullet[2].trim() : line;

    const isHeader = !bullet && (/^#/.test(line) || /:$/.test(line));
    if (isHeader) {
      openHeader(line);
      continue;
    }
    if (!current) openHeader('Inbox:');

    if (current.kind === 'routine') {
      const quota = body.match(/^(\d+)\s+from\s+(.+)$/i);
      if (quota) current.items.push({ type: 'quota', count: Number(quota[1]), fromName: quota[2].trim() });
      else {
        const item = parseTaskLine(body, findPerson);
        if (item) current.items.push({ type: 'task', text: item.text });
      }
      plan.counts.items += 1;
      continue;
    }

    const item = parseTaskLine(body, findPerson);
    if (!item) continue;
    if (indent >= 2 && lastTask && bullet) {
      lastTask.steps.push(item);
      plan.counts.steps += 1;
    } else {
      current.tasks.push({ ...item, steps: [] });
      lastTask = current.tasks[current.tasks.length - 1];
      plan.counts.tasks += 1;
    }
  }
  plan.lists = plan.lists.filter((l) => l.tasks.length > 0 || l.isNew);
  plan.routines = plan.routines.filter((r) => r.items.length > 0 || r.isNew);
  plan.counts.lists = plan.lists.length;
  plan.counts.newLists = plan.lists.filter((l) => l.isNew).length;
  plan.counts.routines = plan.routines.length;
  return plan;
}

// "Exercise (weekly, for Zeke):" -> { name: 'Exercise', options: { cadence: 'weekly', personId: 'zeke' } }
export function parseHeader(rawLine, findPerson = () => undefined) {
  let name = rawLine.trim().replace(/^#+\s*/, '').replace(/:$/, '').trim();
  const options = {};
  const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m) {
    name = m[1].trim();
    for (const part of m[2].split(',').map((p) => p.trim().toLowerCase()).filter(Boolean)) {
      if (part === 'daily' || part === 'every day') options.cadence = 'daily';
      else if (part === 'weekly' || part === 'every week') options.cadence = 'weekly';
      else if (/^in\s+/.test(part)) options.categoryName = part.replace(/^in\s+/, '').replace(/\b\w/g, (ch) => ch.toUpperCase());
      else if (/^for\s+/.test(part)) {
        const id = findPerson(part.replace(/^for\s+/, ''));
        if (id !== undefined) options.personId = id;
      } else {
        const h = parseHorizon(part);
        if (h) options.horizonDays = h;
      }
    }
  }
  return { name, options };
}

function parseHorizon(part) {
  const m = part.match(/^(\d+)\s*(day|days|week|weeks|month|months)$/);
  if (!m) return null;
  const n = Number(m[1]);
  const days = m[2].startsWith('day') ? n : m[2].startsWith('week') ? n * 7 : n * 30;
  // Snap to a supported horizon so the nudge pattern is defined.
  const h = HORIZONS.filter((x) => x.days).reduce((best, x) => (Math.abs(x.days - days) < Math.abs(best.days - days) ? x : best));
  return h.days;
}

function dayListFor(name, now) {
  const n = name.toLowerCase();
  if (n === 'today') return `day:${almanacDayKeyFromOffset(0)}`;
  if (n === 'tomorrow') return `day:${almanacDayKeyFromOffset(1)}`;
  const wd = DAY_NAMES.indexOf(n);
  if (wd >= 0) {
    const d = new Date(now);
    let diff = (wd - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    return `day:${dayKey(d)}`;
  }
  return null;
}

// "call dentist by fri 3pm for zeke // bring card" -> { text, due, dueTime, personId, notes }
export function parseTaskLine(body, findPerson) {
  let text = body;
  let personId = null;
  let due = null;
  let dueTime = null;
  let notes = null;

  const noteMatch = text.match(/\s+\/\/\s*(.+)$/);
  if (noteMatch) {
    notes = noteMatch[1].trim();
    text = text.slice(0, noteMatch.index);
  }

  const personMatch = text.match(/\s+(?:for|@)\s*([A-Za-z]+)\s*$/);
  if (personMatch) {
    const id = findPerson(personMatch[1]);
    if (id !== undefined) {
      personId = id;
      text = text.slice(0, personMatch.index);
    }
  }

  const timeMatch = text.match(/\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2})\s*$/i);
  if (timeMatch) {
    const t = parseTimeInput(timeMatch[1]);
    if (t) {
      dueTime = t;
      text = text.slice(0, timeMatch.index);
    }
  }
  const dateMatch = text.match(/\s+(?:by|due|on|@)?\s*([A-Za-z]{3,9}|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|\d{4}-\d{2}-\d{2})\s*$/i);
  if (dateMatch) {
    const d = parseDueInput(dateMatch[1]);
    if (d && (/^(by|due|on|@)/.test(text.slice(dateMatch.index).trim()) || /^\d/.test(dateMatch[1]) || /^(today|tomorrow|tmrw|mon|tue|wed|thu|fri|sat|sun)/i.test(dateMatch[1]))) {
      due = d;
      text = text.slice(0, dateMatch.index);
    }
  }
  if (!due) dueTime = null;

  text = text.replace(/[\s,;:-]+$/, '').trim();
  if (!text) return null;
  return { text, due, dueTime, personId, notes };
}

export function describePlan(plan) {
  const c = plan.counts;
  if (!c.tasks && !c.items && !c.newLists && !c.routines) return 'Nothing to add yet. Headers end with a colon; tasks start with a dash.';
  const parts = [];
  if (c.tasks) parts.push(`${c.tasks} ${c.tasks === 1 ? 'task' : 'tasks'}`);
  if (c.steps) parts.push(`${c.steps} ${c.steps === 1 ? 'step' : 'steps'}`);
  if (c.lists) parts.push(`${c.lists} ${c.lists === 1 ? 'list' : 'lists'}${c.newLists ? ` (${c.newLists} new)` : ''}`);
  if (c.routines) parts.push(`${c.routines} ${c.routines === 1 ? 'routine' : 'routines'} with ${c.items} ${c.items === 1 ? 'item' : 'items'}`);
  return parts.join(' · ');
}
