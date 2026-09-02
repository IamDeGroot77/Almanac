import { useEffect, useState } from 'react';

// "<1m", "12m", "1h 05m"
export function formatDuration(ms) {
  if (ms == null || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// Re-renders every `intervalMs` while `active`, returning the current time.
export function useNow(active, intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

export function elapsedFor(task, now = Date.now()) {
  if (task.done) return task.durationMs ?? null;
  if (task.startedAt) return now - task.startedAt;
  return null;
}
