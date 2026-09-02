import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Sleep from '../modules/almanac-sleep';
import * as Health from '../modules/almanac-health';

// Folds detected sleep into the day bracket from two sources:
//  - the phone's own detection (Google's Sleep API, modules/almanac-sleep)
//  - the watch, via Health Connect (modules/almanac-health), when enabled
// A segment is "asleep from start to end"; its end lands on the wake day,
// its start on the day before. Detected times only override taps that were
// guessed (implicit starts, auto-closed nights) or missing, never a
// deliberate tap within 90 minutes of the detection. Watch data wins over
// phone data for the same night because it's measured, not inferred.

const MIN_SLEEP_MS = 3 * 60 * 60 * 1000;
const TAP_TOLERANCE_MS = 90 * 60 * 1000;

export function useSleepDetection(store) {
  const [status, setStatus] = useState({
    available: Sleep.isAvailable(),
    enabled: Sleep.isAvailable() && Sleep.isSubscribed(),
    permission: Sleep.hasPermission(),
    error: null,
  });
  const [health, setHealth] = useState({
    status: Health.status(), // missing | unavailable | update | available
    enabled: false,
    error: null,
    lastRead: null,
  });
  const applied = useRef(new Set());
  const healthEnabled = !!store.prefs?.healthSleep;

  const ingestPhone = useCallback(() => {
    if (!Sleep.isAvailable() || !store.loaded) return;
    const segments = Sleep.getSegments().filter((s) => s.status === 0 && s.end - s.start >= MIN_SLEEP_MS);
    for (const seg of segments) {
      const id = `${seg.start}-${seg.end}`;
      if (applied.current.has(id) || store.sleepApplied?.includes(id)) continue;
      applied.current.add(id);
      store.applyDetectedSleep(seg, TAP_TOLERANCE_MS);
    }
  }, [store]);

  const ingestHealth = useCallback(async () => {
    if (!healthEnabled || Health.status() !== 'available' || !store.loaded) return;
    try {
      const sessions = await Health.readSleepAsync(7);
      setHealth((h) => ({ ...h, enabled: true, lastRead: sessions.length ? sessions[sessions.length - 1] : h.lastRead, error: null }));
      for (const s of sessions) {
        if (s.end - s.start < MIN_SLEEP_MS) continue;
        const id = `hc:${s.start}-${s.end}`;
        if (applied.current.has(id) || store.sleepApplied?.includes(id)) continue;
        applied.current.add(id);
        // Watch data is authoritative: a wide tolerance lets it override the phone's guess.
        store.applyDetectedSleep({ start: s.start, end: s.end, source: 'health' }, TAP_TOLERANCE_MS, id);
      }
    } catch (err) {
      setHealth((h) => ({ ...h, error: err.message }));
    }
  }, [store, healthEnabled]);

  useEffect(() => {
    ingestPhone();
    ingestHealth();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        ingestPhone();
        ingestHealth();
      }
    });
    return () => sub.remove();
  }, [ingestPhone, ingestHealth]);

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

  const enableHealth = useCallback(async () => {
    try {
      const granted = (await Health.hasPermissionAsync()) || (await Health.requestPermissionAsync());
      if (!granted) {
        setHealth((h) => ({ ...h, error: 'Health Connect did not grant sleep access.' }));
        return;
      }
      store.setPref('healthSleep', true);
      setHealth((h) => ({ ...h, enabled: true, error: null }));
    } catch (err) {
      setHealth((h) => ({ ...h, error: err.message }));
    }
  }, [store]);

  const disableHealth = useCallback(() => {
    store.setPref('healthSleep', false);
    setHealth((h) => ({ ...h, enabled: false }));
  }, [store]);

  return {
    ...status,
    enable,
    disable,
    segments: Sleep.isAvailable() ? Sleep.getSegments() : [],
    health: { ...health, enabled: healthEnabled, enable: enableHealth, disable: disableHealth },
  };
}
