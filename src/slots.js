// Time-of-day slots for a day list: morning, afternoon, evening, or anytime.
// A slot keeps a task visible on today without it shouting in the morning
// brief, the way "This Evening" works in Things.

export const SLOTS = [
  { id: 'morning', name: 'Morning', from: 5, to: 12 },
  { id: 'afternoon', name: 'Afternoon', from: 12, to: 17 },
  { id: 'evening', name: 'Evening', from: 17, to: 29 },
];

export function slotForHour(hour) {
  const h = hour < 5 ? hour + 24 : hour;
  return (SLOTS.find((s) => h >= s.from && h < s.to) || SLOTS[2]).id;
}

// How far a task's slot is from now: 0 = its time, negative = its slot has
// passed, positive = later today. null when the task has no slot.
export function slotDistance(slot, hour) {
  if (!slot) return null;
  const order = ['morning', 'afternoon', 'evening'];
  return order.indexOf(slot) - order.indexOf(slotForHour(hour));
}

// Group a day list by slot when any task has one. Returns null otherwise so
// the caller can fall back to a flat list.
export function groupBySlot(tasks, hour = new Date().getHours()) {
  if (!tasks.some((t) => t.slot)) return null;
  const current = slotForHour(hour);
  const groups = [...SLOTS.map((s) => ({ key: s.id, title: s.name, current: s.id === current, tasks: [] })), { key: 'anytime', title: 'Anytime', current: false, tasks: [] }];
  for (const t of tasks) {
    const g = groups.find((x) => x.key === (t.slot || 'anytime'));
    g.tasks.push(t);
  }
  return groups.filter((g) => g.tasks.length).map((g) => ({ ...g, openCount: g.tasks.filter((t) => !t.done).length, courses: [{ name: null, tasks: g.tasks }] }));
}
