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

// Time on a task so far: banked sessions plus the running one.
export function elapsedFor(task, now = Date.now()) {
  if (task.done) return task.durationMs ?? null;
  const banked = task.spentMs || 0;
  if (task.startedAt) return banked + (now - task.startedAt);
  return banked > 0 ? banked : null;
}

export const isRunning = (task) => !task.done && !!task.startedAt;
export const isPaused = (task) => !task.done && !task.startedAt && (task.spentMs || 0) > 0;
