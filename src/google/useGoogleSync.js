import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getValidAccessToken } from './auth';
import { runSync } from './sync';
import { GoogleApiError } from './tasksApi';
import { isWeb } from '../platform';

const DEBOUNCE_MS = 30000; // edits are batched; the phone is not a live wire
const FOREGROUND_MIN_MS = 5 * 60 * 1000;
let lastForegroundSync = 0;

// Drives runSync: on sign-in, when the app comes to the foreground, on
// demand, and a few seconds after any local change.
export default function useGoogleSync(store, auth) {
  const [status, setStatus] = useState({ state: 'idle', error: null });
  const storeRef = useRef(store);
  storeRef.current = store;
  const inFlight = useRef(false);
  const queued = useRef(false);

  const syncNow = useCallback(async () => {
    const current = storeRef.current;
    if (isWeb || !auth.account || !current.loaded) return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    setStatus({ state: 'syncing', error: null });
    try {
      const token = await getValidAccessToken();
      if (!token) {
        await auth.signOut();
        throw new Error('Google session expired. Connect again.');
      }
      const snapshot = {
        lists: current.lists,
        tasks: current.tasks,
        sync: current.sync,
        localVersion: current.localVersion,
        people: current.people,
      };
      const result = await runSync(snapshot, token);
      current.applySyncResult(result);
      setStatus({ state: 'idle', error: null });
    } catch (err) {
      console.warn('Google sync failed', err);
      setStatus({ state: 'error', error: err.message || 'Sync failed' });
      if (err instanceof GoogleApiError && err.status === 401) await auth.signOut();
    } finally {
      inFlight.current = false;
      if (queued.current) {
        queued.current = false;
        syncNow();
      }
    }
  }, [auth]);

  // Sign-in and first load.
  useEffect(() => {
    if (auth.account && store.loaded) syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.account, store.loaded]);

  // Foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (Date.now() - lastForegroundSync < FOREGROUND_MIN_MS) return;
      lastForegroundSync = Date.now();
      syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  // Local changes, debounced.
  useEffect(() => {
    if (!auth.account || !store.loaded) return;
    if (store.localVersion === store.sync.syncedVersion) return;
    const timer = setTimeout(syncNow, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [auth.account, store.loaded, store.localVersion, store.sync.syncedVersion, syncNow]);

  return { ...status, lastSyncAt: store.sync.lastSyncAt, syncNow };
}
