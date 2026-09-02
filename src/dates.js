// Date helpers. All keys are local-time calendar days in YYYY-MM-DD form.

export function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayFromOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dayBounds(offset) {
  const start = dayFromOffset(offset);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function todayKey() {
  return dayKey(dayFromOffset(0));
}

export function parseDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatHeaderDate(date) {
  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// "Yesterday", or "Monday, Sep 1" for anything older.
export function describeDayKey(key) {
  const yesterday = dayKey(dayFromOffset(-1));
  if (key === yesterday) return 'Yesterday';
  return parseDayKey(key).toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
