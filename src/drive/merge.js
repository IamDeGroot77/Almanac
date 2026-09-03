import { mergeJournals } from '../journal.js';
import { mergeScratch } from '../scratch.js';
import { dedupeLists } from '../lists.js';
// Merging two copies of the shared state (phone and laptop) into one.
// Symmetric and pure, so it runs in Node for tests.
//
// Rules:
// - tasks, lists, routines: by id; newest updatedAt wins; a copy missing on
//   one side is dropped only if that side deleted it after the last edit.
//   Sync bookkeeping (Google ids, Canvas ids, calendar links) is carried
//   from whichever copy has it, so a laptop edit never orphans a task.
// - people: union by id. routineDone: deep union. timeLog: union by id.
// - days: per day, the copy with the latest activity is the base and gaps
//   are filled from the other; watch sleep beats phone sleep.
// - dayNotes: newest by dayNoteMeta; ties keep the longer text.
// - shared prefs: newest by prefsUpdatedAt.
// - deleted markers: union, pruned after 30 days.

const DELETED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TIME_LOG_MAX = 2000;
const BOOKKEEPING = [
  'googleId', 'googleListId', 'googleUpdated', 'syncedUpdatedAt',
  'canvasId', 'canvasCourse', 'canvasUrl', 'canvasDueAt', 'canvasPoints', 'canvasScore',
  'canvas',
];
export const SHARED_PREFS = ['weatherPlace', 'checkinMinutes', 'energyCheckins', 'weeklyLetter', 'focusApp', 'timerApp', 'healthSleep', 'bedtimeHour', 'calendarRules', 'dayBlocks', 'dopamenu', 'quotes'];

const ts = (x) => x?.updatedAt || x?.createdAt || 0;

function mergeEntities(aList, bList, aDeleted, bDeleted) {
  const byId = new Map();
  const a = new Map((aList || []).map((x) => [x.id, x]));
  const b = new Map((bList || []).map((x) => [x.id, x]));
  const ids = new Set([...a.keys(), ...b.keys()]);
  for (const id of ids) {
    const x = a.get(id);
    const y = b.get(id);
    if (x && y) {
      const [winner, loser] = ts(x) >= ts(y) ? [x, y] : [y, x];
      const merged = { ...loser, ...winner };
      for (const k of BOOKKEEPING) if (merged[k] == null && loser[k] != null) merged[k] = loser[k];
      byId.set(id, merged);
    } else {
      const only = x || y;
      const otherDeletedAt = (x ? bDeleted : aDeleted)?.[id] || 0;
      if (otherDeletedAt && otherDeletedAt >= ts(only)) continue; // deleted elsewhere after last edit
      byId.set(id, only);
    }
  }
  return [...byId.values()];
}

function mergeDeleted(a = {}, b = {}, now = Date.now()) {
  const out = {};
  for (const [id, t] of [...Object.entries(a), ...Object.entries(b)]) {
    if (now - t > DELETED_TTL_MS) continue;
    out[id] = Math.max(out[id] || 0, t);
  }
  return out;
}

function mergeDay(x, y) {
  if (!x) return y;
  if (!y) return x;
  const score = (d) => Math.max(d.lastActiveAt || 0, d.sleptAt || 0, d.wokeAt || 0);
  const [base, other] = score(x) >= score(y) ? [x, y] : [y, x];
  const merged = { ...other, ...base };
  for (const k of Object.keys(other)) if (merged[k] == null && other[k] != null) merged[k] = other[k];
  // Energy answers: keep any given on either side.
  if (x.energy || y.energy) merged.energy = { ...(other.energy || {}), ...(base.energy || {}) };
  // A wake time from a sensor beats one guessed from an app open or a gap.
  const sensor = [x, y].find((d) => d?.wokeAt && (d.wakeSource === 'health' || d.wakeSource === 'phone'));
  if (sensor && merged.wokeAt !== sensor.wokeAt && (merged.wakeSource === 'open' || merged.autoStarted || merged.implicit)) {
    merged.wokeAt = sensor.wokeAt;
    merged.wakeSource = sensor.wakeSource;
    merged.implicit = false;
  }
  // Sleep: measured (watch) beats inferred (phone).
  const sleeps = [x.sleep, y.sleep].filter(Boolean);
  if (sleeps.length) merged.sleep = sleeps.find((s) => s.source === 'health') || base.sleep || other.sleep;
  return merged;
}

export function mergeStates(a, b, now = Date.now()) {
  const deleted = {
    tasks: mergeDeleted(a.deleted?.tasks, b.deleted?.tasks, now),
    lists: mergeDeleted(a.deleted?.lists, b.deleted?.lists, now),
    routines: mergeDeleted(a.deleted?.routines, b.deleted?.routines, now),
  };
  const tasks = mergeEntities(a.tasks, b.tasks, a.deleted?.tasks, b.deleted?.tasks);
  const lists = mergeEntities(a.lists, b.lists, a.deleted?.lists, b.deleted?.lists);
  const routines = mergeEntities(a.routines, b.routines, a.deleted?.routines, b.deleted?.routines);
  const categories = mergeEntities(a.categories, b.categories, {}, {});

  const people = [...new Map([...(a.people || []), ...(b.people || [])].map((p) => [p.id, p])).values()];

  const routineDone = {};
  for (const src of [a.routineDone || {}, b.routineDone || {}]) {
    for (const [rid, periods] of Object.entries(src)) {
      routineDone[rid] = routineDone[rid] || {};
      for (const [pk, items] of Object.entries(periods || {})) {
        routineDone[rid][pk] = { ...(routineDone[rid][pk] || {}), ...(items || {}) };
      }
    }
  }

  const routineLog = [...new Map([...(a.routineLog || []), ...(b.routineLog || [])].map((e) => [e.id, e])).values()]
    .sort((p, q) => (p.endedAt || 0) - (q.endedAt || 0))
    .slice(-2000);
  const timeLog = [...new Map([...(a.timeLog || []), ...(b.timeLog || [])].map((e) => [e.id, e])).values()]
    .sort((p, q) => (p.doneAt || 0) - (q.doneAt || 0))
    .slice(-TIME_LOG_MAX);

  const days = {};
  for (const key of new Set([...Object.keys(a.days || {}), ...Object.keys(b.days || {})])) {
    days[key] = mergeDay(a.days?.[key], b.days?.[key]);
  }

  const journal = mergeJournals(a.journal, b.journal);
  const scratch = mergeScratch(a.scratch, b.scratch);
  const achievements = {};
  for (const src of [a.achievements || {}, b.achievements || {}]) for (const [id, at] of Object.entries(src)) achievements[id] = achievements[id] ? Math.min(achievements[id], at) : at;
  const stuckLog = [...new Map([...(a.stuckLog || []), ...(b.stuckLog || [])].map((e) => [`${e.taskId}:${e.at}`, e])).values()].sort((p, q) => p.at - q.at).slice(-500);
  const dayNotes = {};
  const dayNoteMeta = {};
  for (const key of new Set([...Object.keys(a.dayNotes || {}), ...Object.keys(b.dayNotes || {})])) {
    const ta = a.dayNoteMeta?.[key] || 0;
    const tb = b.dayNoteMeta?.[key] || 0;
    const na = a.dayNotes?.[key] || '';
    const nb = b.dayNotes?.[key] || '';
    if (ta === tb) {
      dayNotes[key] = na.length >= nb.length ? na : nb;
      dayNoteMeta[key] = ta;
    } else {
      dayNotes[key] = ta > tb ? na : nb;
      dayNoteMeta[key] = Math.max(ta, tb);
    }
  }

  const pa = a.prefsUpdatedAt || 0;
  const pb = b.prefsUpdatedAt || 0;
  const prefsSource = pa >= pb ? a : b;
  const sharedPrefs = {};
  for (const k of SHARED_PREFS) if (prefsSource.sharedPrefs?.[k] !== undefined) sharedPrefs[k] = prefsSource.sharedPrefs[k];

  return dedupeLists({
    version: 1,
    tasks,
    lists,
    routines,
    categories,
    people,
    routineDone,
    timeLog,
    routineLog,
    days,
    dayNotes,
    dayNoteMeta,
    journal,
    scratch,
    stuckLog,
    achievements,
    deleted,
    sharedPrefs,
    prefsUpdatedAt: Math.max(pa, pb),
    revision: Math.max(a.revision || 0, b.revision || 0),
  }, now);
}

// The slice of a store that travels between devices.
export function shareable(state) {
  const sharedPrefs = {};
  for (const k of SHARED_PREFS) if (state.prefs?.[k] !== undefined) sharedPrefs[k] = state.prefs[k];
  return {
    version: 1,
    tasks: state.tasks || [],
    lists: state.lists || [],
    routines: state.routines || [],
    categories: state.categories || [],
    people: state.people || [],
    routineDone: state.routineDone || {},
    timeLog: state.timeLog || [],
    routineLog: state.routineLog || [],
    days: state.days || {},
    dayNotes: state.dayNotes || {},
    dayNoteMeta: state.dayNoteMeta || {},
    journal: state.journal || {},
    scratch: state.scratch || [],
    stuckLog: state.stuckLog || [],
    achievements: state.achievements || {},
    deleted: state.deleted || { tasks: {}, lists: {}, routines: {} },
    sharedPrefs,
    prefsUpdatedAt: state.prefsUpdatedAt || 0,
    revision: state.driveRevision || 0,
  };
}

// Cheap equality for "did the merge change anything worth uploading".
export function sameShareable(a, b) {
  return JSON.stringify({ ...a, revision: 0 }) === JSON.stringify({ ...b, revision: 0 });
}
