// Two lists with the same name are one list. Duplicates appear when a list
// is created on both devices before they sync, or when Canvas, Google Tasks,
// and a paste each make their own. This folds them: the survivor is the one
// linked to Google Tasks, else the oldest, and every task, routine quota, and
// calendar rule that pointed at a duplicate points at the survivor.

const norm = (name) => (name || '').trim().toLowerCase();

export function dedupeLists(state, now = Date.now()) {
  const lists = state.lists || [];
  const byName = new Map();
  for (const l of lists) {
    const key = norm(l.name);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(l);
  }
  const remap = {};
  const survivors = [];
  const dropped = [];
  for (const group of byName.values()) {
    if (group.length === 1) {
      survivors.push(group[0]);
      continue;
    }
    const sorted = [...group].sort((a, b) => (b.googleListId ? 1 : 0) - (a.googleListId ? 1 : 0) || (a.createdAt || 0) - (b.createdAt || 0));
    const keep = sorted[0];
    // Carry settings the survivor lacks from the duplicates.
    const merged = { ...keep };
    for (const d of sorted.slice(1)) {
      for (const k of ['categoryId', 'horizonDays', 'personId', 'googleListId']) if (merged[k] == null && d[k] != null) merged[k] = d[k];
      remap[d.id] = keep.id;
      dropped.push(d.id);
    }
    survivors.push(merged);
  }
  if (!dropped.length) return state;

  const fix = (id) => remap[id] || id;
  const tasks = (state.tasks || []).map((t) => (remap[t.listId] ? { ...t, listId: fix(t.listId), updatedAt: now } : t));
  const routines = (state.routines || []).map((r) =>
    r.items?.some((it) => it.listId && remap[it.listId]) ? { ...r, items: r.items.map((it) => (it.listId ? { ...it, listId: fix(it.listId) } : it)), updatedAt: now } : r
  );
  const prefs = state.prefs?.calendarRules?.some((c) => remap[c.listId]) ? { ...state.prefs, calendarRules: state.prefs.calendarRules.map((c) => ({ ...c, listId: fix(c.listId) })) } : state.prefs;
  const sharedPrefs = state.sharedPrefs?.calendarRules?.some((c) => remap[c.listId]) ? { ...state.sharedPrefs, calendarRules: state.sharedPrefs.calendarRules.map((c) => ({ ...c, listId: fix(c.listId) })) } : state.sharedPrefs;
  const deleted = { ...(state.deleted || {}), lists: { ...((state.deleted || {}).lists || {}) } };
  for (const id of dropped) deleted.lists[id] = now;
  const out = { ...state, lists: survivors, tasks, routines, deleted };
  if (prefs !== state.prefs) out.prefs = prefs;
  if (sharedPrefs !== state.sharedPrefs) out.sharedPrefs = sharedPrefs;
  return out;
}
