import { parseDueInput, parseTimeInput } from './due.js';
import { almanacDayKeyFromOffset } from './clock.js';
import { dayKey } from './dates.js';

// Turns a pasted brain dump into lists and tasks. Pure, so it can be tested
// and previewed before anything is added.
//
//   Groceries:            <- a list (a line ending in ":" or starting with #)
//   - milk                <- a task
//   - call dentist by fri <- "by <date>" / "due <date>" / "@<date>" sets a due date
//   - pay rent 9/1 5pm    <- a trailing date and time also work
//     - find the login    <- an indented line under a task is a step
//   - sign form for zeke  <- "for <person>" tags the person
//   Today: / Tomorrow: / Monday:   <- headers that mean a day list
//
// Lines before any header go to a list called "Inbox".

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseImport(text, { people = [], lists = [], now = new Date() } = {}) {
  const plan = { lists: [], counts: { lists: 0, newLists: 0, tasks: 0, steps: 0 } };
  let current = null;
  let lastTask = null;

  const findPerson = (name) => {
    const n = name.toLowerCase();
    const p = people.find((x) => x.name.toLowerCase() === n || x.id.toLowerCase() === n);
    return p ? (p.id === 'me' ? null : p.id) : undefined;
  };

  const openList = (rawName) => {
    const name = rawName.trim().replace(/^#+\s*/, '').replace(/:$/, '').trim();
    if (!name) return;
    const dayId = dayListFor(name, now);
    const existing = dayId ? null : lists.find((l) => l.name.toLowerCase() === name.toLowerCase());
    current = { name: existing ? existing.name : name, id: dayId || existing?.id || null, isNew: !dayId && !existing, tasks: [] };
    plan.lists.push(current);
    plan.counts.lists += 1;
    if (current.isNew) plan.counts.newLists += 1;
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
      openList(line);
      continue;
    }
    if (!current) openList('Inbox');

    const item = parseTaskLine(body, findPerson, now);
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
  plan.lists = plan.lists.filter((l) => l.tasks.length > 0);
  plan.counts.lists = plan.lists.length;
  plan.counts.newLists = plan.lists.filter((l) => l.isNew).length;
  return plan;
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

// "call dentist by fri 3pm for zeke" -> { text, due, dueTime, personId, notes }
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

  // Trailing time then date: "... 9/15 5pm", "... by fri 3:30pm", "... due 2026-09-15".
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
  if (!c.tasks) return 'Nothing to add yet. Headers end with a colon; tasks start with a dash.';
  const parts = [`${c.tasks} ${c.tasks === 1 ? 'task' : 'tasks'}`];
  if (c.steps) parts.push(`${c.steps} ${c.steps === 1 ? 'step' : 'steps'}`);
  parts.push(`${c.lists} ${c.lists === 1 ? 'list' : 'lists'}${c.newLists ? ` (${c.newLists} new)` : ''}`);
  return parts.join(' · ');
}
