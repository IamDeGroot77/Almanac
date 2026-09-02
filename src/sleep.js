import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Sleep from '../modules/almanac-sleep';

// Folds Google's detected sleep segments into the day bracket. A segment is
// "asleep from start to end"; its end lands on the wake day, its start on the
// day before. Detected times only override taps that were guessed (implicit
// starts, auto-closed nights) or missing, never a deliberate tap that's
// within 90 minutes of the detection.

const MIN_SLEEP_MS = 3 * 60 * 60 * 1000;
const TAP_TOLERANCE_MS = 90 * 60 * 1000;

export function useSleepDetection(store) {
  const [status, setStatus] = useState({
    available: Sleep.isAvailable(),
    enabled: Sleep.isAvailable() && Sleep.isSubscribed(),
    permission: Sleep.hasPermission(),
    error: null,
  });
  const applied = useRef(new Set());

  const ingest = useCallback(() => {
    if (!Sleep.isAvailable() || !store.loaded) return;
    const segments = Sleep.getSegments().filter((s) => s.status === 0 && s.end - s.start >= MIN_SLEEP_MS);
    for (const seg of segments) {
      const id = `${seg.start}-${seg.end}`;
      if (applied.current.has(id) || store.sleepApplied?.includes(id)) continue;
      applied.current.add(id);
      store.applyDetectedSleep(seg, TAP_TOLERANCE_MS);
    }
  }, [store]);

  useEffect(() => {
    ingest();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && ingest());
    return () => sub.remove();
  }, [ingest]);

  const enable = useCallback(async () => {
    try {
      const perm = await Sleep.requestPermissionAsync();
      if (perm !== 'granted') {
        setStatus((s) => ({ ...s, permission: false, error: perm === 'unavailable' ? 'Needs a newer app build.' : 'Permission not granted.' }));
        return;
      }
      await Sleep.subscribeAsync();
      setStatus({ available: true, enabled: true, permission: true, error: null });
    } catch (err) {
      setStatus((s) => ({ ...s, error: err.message }));
    }
  }, []);

  const disable = useCallback(async () => {
    try {
      await Sleep.unsubscribeAsync();
      setStatus((s) => ({ ...s, enabled: false, error: null }));
    } catch (err) {
      setStatus((s) => ({ ...s, error: err.message }));
    }
  }, []);

  return { ...status, enable, disable, segments: Sleep.isAvailable() ? Sleep.getSegments() : [] };
}

