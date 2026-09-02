import { newId } from '../ids.js';
import { dayKey } from '../dates.js';

// One-way sync from Canvas into a named list (default "School").
//
// - Each assignment becomes a task with a due date, tagged with its course.
// - Submitted or graded assignments are marked done; nothing is pushed back
//   to Canvas (it can't be, and shouldn't be).
// - Local extras on a task (estimate, timing, person, phone-free) survive.
// - Assignments that disappear from Canvas are removed locally unless they
//   were finished here, so history stays.
// - Course grades are kept in state.canvas for the Insights tab.
//
// runCanvasSync is pure over the snapshot it's given plus the fetched data.

export const SCHOOL_LIST_NAME = 'School';
const LOOKBACK_MS = 21 * 24 * 60 * 60 * 1000;
const LOOKAHEAD_MS = 90 * 24 * 60 * 60 * 1000;
const SUBMITTED_STATES = new Set(['submitted', 'graded', 'pending_review']);

const isDone = (a) => {
  const s = a.submission;
  if (!s) return false;
  if (SUBMITTED_STATES.has(s.workflow_state)) return true;
  return !!s.submitted_at || (s.score != null && s.workflow_state !== 'unsubmitted');
};

// Which assignments are worth showing: due in a window around now, or
// unsubmitted with no due date, or already done recently.
function relevant(a, now) {
  if (!a.due_at) return !isDone(a);
  const due = Date.parse(a.due_at);
  return due >= now - LOOKBACK_MS && due <= now + LOOKAHEAD_MS;
}

export async function fetchCanvasData(api) {
  const courses = await api.courses();
  const active = courses.filter((c) => !c.access_restricted_by_date && c.name);
  const perCourse = await Promise.all(
    active.map(async (c) => {
      try {
        return { course: c, assignments: await api.assignments(c.id) };
      } catch (err) {
        console.warn('Canvas course fetch failed', c.name, err.message);
        return { course: c, assignments: [] };
      }
    })
  );
  return perCourse;
}

export function runCanvasSync(snapshot, perCourse, now = Date.now()) {
  const { lists, tasks } = snapshot;
  const listName = snapshot.canvasListName || SCHOOL_LIST_NAME;

  // Find or create the School list.
  let list = lists.find((l) => l.canvas) || lists.find((l) => l.name.trim().toLowerCase() === listName.toLowerCase());
  let nextLists = lists;
  if (!list) {
    list = { id: newId('l'), name: listName, personId: null, createdAt: now, updatedAt: now, canvas: true };
    nextLists = [...lists, list];
  } else if (!list.canvas) {
    nextLists = lists.map((l) => (l.id === list.id ? { ...l, canvas: true } : l));
  }

  const byCanvasId = new Map(tasks.filter((t) => t.canvasId).map((t) => [t.canvasId, t]));
  const seen = new Set();
  const nextTasks = [];
  const courses = [];

  for (const { course, assignments } of perCourse) {
    const enrollment = (course.enrollments || []).find((e) => e.type === 'student' || e.computed_current_score != null);
    courses.push({
      id: course.id,
      name: course.name,
      code: course.course_code || '',
      score: enrollment?.computed_current_score ?? null,
      grade: enrollment?.computed_current_grade ?? null,
      total: assignments.length,
      done: assignments.filter(isDone).length,
    });

    for (const a of assignments) {
      if (!relevant(a, now)) continue;
      const canvasId = `canvas:${a.id}`;
      seen.add(canvasId);
      const done = isDone(a);
      const doneAt = done ? Date.parse(a.submission?.submitted_at || a.submission?.graded_at || '') || null : null;
      const due = a.due_at ? dayKey(new Date(a.due_at)) : null;
      const dueTime = a.due_at
        ? (() => {
            const d = new Date(a.due_at);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            // Canvas's usual 11:59 PM deadline is noise as a reminder time.
            return hh === '23' && mm === '59' ? null : `${hh}:${mm}`;
          })()
        : null;
      const existing = byCanvasId.get(canvasId);
      if (existing) {
        const changed =
          existing.text !== a.name ||
          existing.due !== due ||
          (existing.canvasDueAt || null) !== (a.due_at || null) ||
          (done && !existing.done) ||
          existing.canvasCourse !== (course.course_code || course.name);
        nextTasks.push(
          changed
            ? {
                ...existing,
                text: a.name,
                due,
                dueTime: existing.dueTime ?? dueTime,
                done: done || existing.done,
                doneAt: done && !existing.done ? doneAt || now : existing.doneAt,
                canvasCourse: course.course_code || course.name,
                canvasUrl: a.html_url,
                canvasDueAt: a.due_at || null,
                canvasPoints: a.points_possible ?? null,
                canvasScore: a.submission?.score ?? null,
                updatedAt: now,
              }
            : { ...existing, canvasScore: a.submission?.score ?? existing.canvasScore ?? null }
        );
      } else {
        nextTasks.push({
          id: newId('t'),
          text: a.name,
          done,
          doneAt: done ? doneAt || now : null,
          listId: list.id,
          personId: list.personId || null,
          createdAt: now,
          updatedAt: now,
          due,
          dueTime,
          canvasId,
          canvasCourse: course.course_code || course.name,
          canvasUrl: a.html_url,
          canvasDueAt: a.due_at || null,
          canvasPoints: a.points_possible ?? null,
          canvasScore: a.submission?.score ?? null,
        });
      }
    }
  }

  // Everything else stays; Canvas tasks no longer in Canvas go unless done here.
  for (const t of tasks) {
    if (!t.canvasId) {
      nextTasks.push(t);
      continue;
    }
    if (seen.has(t.canvasId)) continue; // already emitted above
    if (t.done) nextTasks.push(t);
  }

  return {
    lists: nextLists,
    tasks: nextTasks,
    canvas: { courses, lastSyncAt: now },
    snapshotTaskIds: tasks.map((t) => t.id),
    snapshotListIds: lists.map((l) => l.id),
  };
}
