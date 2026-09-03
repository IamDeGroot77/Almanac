import { dayKey } from '../dates.js';

// The assistant's hands. Each tool is a JSON schema the model sees, and a
// resolver that turns the model's call into a concrete store action (or an
// error it can read back). Resolving is pure so it is tested; applying is a
// thin switch over store actions.

const DAY = 86400000;

export const TOOLS = [
  {
    name: 'add_task',
    description: 'Add a task. Put it on today or tomorrow when the person means to do it then, else on the list it belongs to. Dates are YYYY-MM-DD, times HH:MM (24h).',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Short imperative task text, no date words' },
        list: { type: 'string', description: 'today, tomorrow, a YYYY-MM-DD date, or a list name from the snapshot' },
        due: { type: 'string' },
        due_time: { type: 'string' },
        estimate_minutes: { type: 'integer' },
        slot: { type: 'string', enum: ['morning', 'afternoon', 'evening'] },
        person: { type: 'string', description: 'A person name from the snapshot when the task is for them' },
        first_step: { type: 'string', description: 'A two-minute first step, if the task is big or vague' },
        steps: { type: 'array', items: { type: 'string' }, description: 'Sub-steps, when the person listed them' },
      },
      required: ['text', 'list'],
    },
  },
  { name: 'finish_task', description: 'Mark a task done.', input_schema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  { name: 'start_task', description: 'Start the timer on a task (it becomes Now).', input_schema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  {
    name: 'move_task',
    description: 'Move a task to today, tomorrow, a date, or another list.',
    input_schema: { type: 'object', properties: { task_id: { type: 'string' }, list: { type: 'string' } }, required: ['task_id', 'list'] },
  },
  {
    name: 'set_due',
    description: 'Set or change when a task is due.',
    input_schema: { type: 'object', properties: { task_id: { type: 'string' }, due: { type: 'string' }, due_time: { type: 'string' } }, required: ['task_id', 'due'] },
  },
  { name: 'add_step', description: 'Add a sub-step under a task.', input_schema: { type: 'object', properties: { task_id: { type: 'string' }, text: { type: 'string' } }, required: ['task_id', 'text'] } },
  {
    name: 'hold_thought',
    description: 'Put a thought in working memory: something to keep in view that is not a task yet.',
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'journal',
    description: 'Write a line in the journal: a feeling, a note about the day, something to remember about how it went.',
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'log_minutes',
    description: 'Log minutes done on a routine (exercise, chores) when the person says they did some.',
    input_schema: { type: 'object', properties: { routine: { type: 'string' }, minutes: { type: 'integer' }, what: { type: 'string' } }, required: ['routine', 'minutes'] },
  },
  { name: 'set_one_thing', description: "Pin a task as today's one thing.", input_schema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  { name: 'start_day', description: 'The person is up: start the day.', input_schema: { type: 'object', properties: {} } },
  { name: 'end_day', description: 'The person is going to bed: close the day.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'add_list',
    description: 'Create a new list. Only when no existing list fits.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, category: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'add_routine_item',
    description: 'Add an item to a routine (a weekly exercise, a chore).',
    input_schema: { type: 'object', properties: { routine: { type: 'string' }, text: { type: 'string' } }, required: ['routine', 'text'] },
  },
];

const norm = (s) => (s || '').toLowerCase().trim();

export function findList(lists, name) {
  const n = norm(name);
  if (!n) return null;
  const real = lists.filter((l) => !l.id.startsWith('day:'));
  return (
    real.find((l) => norm(l.name) === n) ||
    real.find((l) => norm(l.name) === n.replace(/\s+list$/, '')) ||
    real.find((l) => norm(l.name).startsWith(n)) ||
    real.find((l) => n.startsWith(norm(l.name))) ||
    real.find((l) => norm(l.name).includes(n)) ||
    null
  );
}

const findByName = (items, name) => {
  const n = norm(name);
  if (!n) return null;
  return items.find((x) => norm(x.name) === n) || items.find((x) => norm(x.name).startsWith(n)) || items.find((x) => norm(x.name).includes(n)) || null;
};

// "today", "tomorrow", a date, or a list name -> a list id.
export function resolveListRef(state, ref, now = Date.now()) {
  const n = norm(ref);
  if (!n || n === 'today') return `day:${dayKey(new Date(now))}`;
  if (n === 'tomorrow') return `day:${dayKey(new Date(now + DAY))}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(n)) return `day:${n}`;
  const l = findList(state.lists || [], ref);
  return l ? l.id : null;
}

const task = (state, id) => (state.tasks || []).find((t) => t.id === id) || null;
const listLabel = (state, listId, now) => {
  if (listId === `day:${dayKey(new Date(now))}`) return 'today';
  if (listId === `day:${dayKey(new Date(now + DAY))}`) return 'tomorrow';
  if (listId.startsWith('day:')) return listId.slice(4);
  return (state.lists || []).find((l) => l.id === listId)?.name || 'a list';
};
const validDate = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
const validTime = (s) => (typeof s === 'string' && /^\d{2}:\d{2}$/.test(s) ? s : null);
const listNames = (state) => (state.lists || []).filter((l) => !l.id.startsWith('day:')).map((l) => l.name).join(', ');

// Turn one tool call into { ok, action, line } or { ok: false, error }.
export function resolveCall(state, call, now = Date.now()) {
  const a = call.input || {};
  switch (call.name) {
    case 'add_task': {
      const text = (a.text || '').trim();
      if (!text) return { ok: false, error: 'Empty task text.' };
      const listId = resolveListRef(state, a.list, now);
      if (!listId) return { ok: false, error: `No list called "${a.list}". Lists: ${listNames(state)}.` };
      const person = a.person ? findByName(state.people || [], a.person) : null;
      const action = {
        type: 'add_task',
        text,
        listId,
        personId: person?.id || null,
        due: validDate(a.due),
        dueTime: validTime(a.due_time),
        estimateMs: a.estimate_minutes > 0 ? a.estimate_minutes * 60000 : null,
        slot: ['morning', 'afternoon', 'evening'].includes(a.slot) ? a.slot : null,
        firstStep: (a.first_step || '').trim() || null,
        steps: Array.isArray(a.steps) ? a.steps.map((s) => String(s).trim()).filter(Boolean) : [],
      };
      const bits = [listLabel(state, listId, now)];
      if (action.due) bits.push(`due ${action.due}${action.dueTime ? ' ' + action.dueTime : ''}`);
      if (action.estimateMs) bits.push(`~${a.estimate_minutes} min`);
      if (person) bits.push(`for ${person.name}`);
      return { ok: true, action, line: `Added "${text}" to ${bits.join(', ')}.` };
    }
    case 'finish_task':
    case 'start_task':
    case 'set_one_thing': {
      const t = task(state, a.task_id);
      if (!t) return { ok: false, error: `No task with id ${a.task_id}.` };
      const verb = call.name === 'finish_task' ? 'Finished' : call.name === 'start_task' ? 'Started' : 'Pinned as the one thing:';
      return { ok: true, action: { type: call.name, id: t.id }, line: `${verb} "${t.text}".` };
    }
    case 'move_task': {
      const t = task(state, a.task_id);
      if (!t) return { ok: false, error: `No task with id ${a.task_id}.` };
      const listId = resolveListRef(state, a.list, now);
      if (!listId) return { ok: false, error: `No list called "${a.list}". Lists: ${listNames(state)}.` };
      return { ok: true, action: { type: 'move_task', id: t.id, listId, fromListId: t.listId }, line: `Moved "${t.text}" to ${listLabel(state, listId, now)}.` };
    }
    case 'set_due': {
      const t = task(state, a.task_id);
      if (!t) return { ok: false, error: `No task with id ${a.task_id}.` };
      const due = validDate(a.due);
      if (!due) return { ok: false, error: 'Due must be YYYY-MM-DD.' };
      const dueTime = validTime(a.due_time);
      return {
        ok: true,
        action: { type: 'set_due', id: t.id, due, dueTime, prev: { due: t.due || null, dueTime: t.dueTime || null } },
        line: `"${t.text}" due ${due}${dueTime ? ' ' + dueTime : ''}.`,
      };
    }
    case 'add_step': {
      const t = task(state, a.task_id);
      if (!t) return { ok: false, error: `No task with id ${a.task_id}.` };
      const text = (a.text || '').trim();
      if (!text) return { ok: false, error: 'Empty step.' };
      return { ok: true, action: { type: 'add_step', parentId: t.id, text }, line: `Step under "${t.text}": ${text}.` };
    }
    case 'hold_thought': {
      const text = (a.text || '').trim();
      if (!text) return { ok: false, error: 'Empty thought.' };
      return { ok: true, action: { type: 'hold_thought', text }, line: `Holding: "${text}".` };
    }
    case 'journal': {
      const text = (a.text || '').trim();
      if (!text) return { ok: false, error: 'Empty entry.' };
      return { ok: true, action: { type: 'journal', text }, line: 'Written in the journal.' };
    }
    case 'log_minutes': {
      const r = findByName(state.routines || [], a.routine);
      if (!r) return { ok: false, error: `No routine called "${a.routine}". Routines: ${(state.routines || []).map((x) => x.name).join(', ')}.` };
      const minutes = Math.round(Number(a.minutes));
      if (!(minutes > 0)) return { ok: false, error: 'Minutes must be a positive number.' };
      return { ok: true, action: { type: 'log_minutes', routineId: r.id, minutes, text: (a.what || '').trim() || r.name }, line: `Logged ${minutes} min of ${r.name}.` };
    }
    case 'start_day':
      return { ok: true, action: { type: 'start_day', key: dayKey(new Date(now)) }, line: 'Day started.' };
    case 'end_day':
      return { ok: true, action: { type: 'end_day' }, line: 'Day closed. Good night.' };
    case 'add_list': {
      const name = (a.name || '').trim();
      if (!name) return { ok: false, error: 'Empty list name.' };
      const existing = findList(state.lists || [], name);
      if (existing && norm(existing.name) === norm(name)) return { ok: false, error: `"${existing.name}" already exists; use it.` };
      const cat = a.category ? findByName(state.categories || [], a.category) : null;
      return { ok: true, action: { type: 'add_list', name, categoryId: cat?.id || null }, line: `New list "${name}"${cat ? ` under ${cat.name}` : ''}.` };
    }
    case 'add_routine_item': {
      const r = findByName(state.routines || [], a.routine);
      if (!r) return { ok: false, error: `No routine called "${a.routine}".` };
      const text = (a.text || '').trim();
      if (!text) return { ok: false, error: 'Empty item.' };
      return { ok: true, action: { type: 'add_routine_item', routineId: r.id, text }, line: `Added "${text}" to ${r.name}.` };
    }
    default:
      return { ok: false, error: `Unknown tool ${call.name}.` };
  }
}

export function resolveCalls(state, calls, now = Date.now()) {
  return calls.map((c) => ({ call: c, ...resolveCall(state, c, now) }));
}

// Runs a resolved action against the store. Returns an undo thunk when the
// action is cheap to reverse.
export function applyAction(store, action) {
  switch (action.type) {
    case 'add_task': {
      const id = store.addTask(action.text, action.listId, action.personId);
      if (!id) return null;
      if (action.due) store.setTaskDue(id, action.due, action.dueTime);
      if (action.estimateMs) store.setTaskEstimate(id, action.estimateMs);
      if (action.slot) store.setTaskSlot(id, action.slot);
      if (action.firstStep) store.setTaskFirstStep(id, action.firstStep);
      for (const s of action.steps) store.addStep(id, s);
      return () => store.deleteTask(id);
    }
    case 'finish_task':
      store.finishTask(action.id);
      return () => store.toggleTask(action.id);
    case 'start_task':
      store.startTask(action.id);
      return () => store.pauseTask(action.id);
    case 'set_one_thing': {
      const key = dayKey(new Date());
      store.setOneThing(key, action.id);
      return () => store.setOneThing(key, null);
    }
    case 'move_task':
      store.moveTask(action.id, action.listId);
      return () => store.moveTask(action.id, action.fromListId);
    case 'set_due':
      store.setTaskDue(action.id, action.due, action.dueTime);
      return () => store.setTaskDue(action.id, action.prev.due, action.prev.dueTime);
    case 'add_step':
      store.addStep(action.parentId, action.text);
      return null;
    case 'hold_thought':
      store.addScratch(action.text, 'assistant');
      return null;
    case 'journal':
      store.addJournalEntry(action.text, { source: 'assistant' });
      return null;
    case 'log_minutes':
      store.logRoutineMinutes(action.routineId, action.minutes, action.text);
      return null;
    case 'start_day':
      store.startDay(action.key);
      return null;
    case 'end_day': {
      const open = Object.keys(store.days || {}).find((k) => store.days[k]?.wokeAt && !store.days[k]?.sleptAt);
      if (open) store.endDay(open);
      return open ? () => store.reopenDay(open) : null;
    }
    case 'add_list':
      store.addList(action.name, null, action.categoryId);
      return null;
    case 'add_routine_item': {
      const r = (store.routines || []).find((x) => x.id === action.routineId);
      if (!r) return null;
      store.saveRoutine({ ...r, items: [...(r.items || []), { id: `ri_${Date.now().toString(36)}`, text: action.text }] });
      return null;
    }
    default:
      return null;
  }
}
