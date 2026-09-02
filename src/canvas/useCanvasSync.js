import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { makeCanvasApi, CanvasApiError } from './api';
import { fetchCanvasData, runCanvasSync } from './sync';

const MIN_INTERVAL_MS = 10 * 60 * 1000;

// Pulls Canvas on connect, on foreground (at most every 10 minutes), and on demand.
export default function useCanvasSync(store, auth) {
  const [status, setStatus] = useState({ state: 'idle', error: null });
  const storeRef = useRef(store);
  storeRef.current = store;
  const inFlight = useRef(false);
  const lastRun = useRef(0);

  const syncNow = useCallback(
    async ({ force = false } = {}) => {
      const current = storeRef.current;
      if (!auth.creds || !current.loaded || inFlight.current) return;
      if (!force && Date.now() - lastRun.current < MIN_INTERVAL_MS) return;
      inFlight.current = true;
      setStatus({ state: 'syncing', error: null });
      try {
        const api = makeCanvasApi(auth.creds.host, auth.creds.token);
        const data = await fetchCanvasData(api);
        const result = runCanvasSync(
          { lists: current.lists, tasks: current.tasks, canvasListName: current.prefs?.canvasListName },
          data
        );
        current.applyCanvasResult(result);
        lastRun.current = Date.now();
        setStatus({ state: 'idle', error: null });
      } catch (err) {
        console.warn('Canvas sync failed', err);
        setStatus({ state: 'error', error: err.message || 'Sync failed' });
        if (err instanceof CanvasApiError && err.status === 401) await auth.disconnect();
      } finally {
        inFlight.current = false;
      }
    },
    [auth]
  );

  useEffect(() => {
    if (auth.creds && store.loaded) syncNow({ force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.creds, store.loaded]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && syncNow());
    return () => sub.remove();
  }, [syncNow]);

  return { ...status, lastSyncAt: store.canvas?.lastSyncAt || null, syncNow: () => syncNow({ force: true }) };
}
