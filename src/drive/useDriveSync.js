import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getValidAccessToken } from '../google/auth';
import { makeDrive, DriveApiError } from './driveApi';
import { mergeStates, shareable, sameShareable } from './merge';

const DEBOUNCE_MS = 5000;
const MIN_INTERVAL_MS = 20000;

// Keeps this device and the private Drive file in step: download, merge,
// apply locally, upload if anything changed. Runs on sign-in, on
// foreground/focus, a few seconds after edits, and on demand.
export default function useDriveSync(store, auth) {
  const [status, setStatus] = useState({ state: 'idle', error: null, lastSyncAt: null });
  const storeRef = useRef(store);
  storeRef.current = store;
  const inFlight = useRef(false);
  const queued = useRef(false);
  const lastRun = useRef(0);
  const fileId = useRef(null);
  const lastSyncedVersion = useRef(-1);

  const syncNow = useCallback(
    async ({ force = false } = {}) => {
      const current = storeRef.current;
      if (!auth.account || !current.loaded) return;
      if (inFlight.current) {
        queued.current = true;
        return;
      }
      if (!force && Date.now() - lastRun.current < MIN_INTERVAL_MS && current.localVersion === lastSyncedVersion.current) return;
      inFlight.current = true;
      setStatus((s) => ({ ...s, state: 'syncing', error: null }));
      try {
        const token = await getValidAccessToken();
        if (!token) throw new Error('Google session expired. Connect again.');
        const drive = makeDrive(token);
        if (!fileId.current) fileId.current = (await drive.findFile())?.id || null;
        const remote = fileId.current ? await drive.download(fileId.current) : null;
        const local = shareable(current);
        const merged = remote ? mergeStates(local, remote) : local;

        // Apply anything the other device contributed.
        if (!remote || !sameShareable(merged, local)) current.applyDriveMerge(merged);

        // Upload if Drive is behind.
        if (!remote || !sameShareable(merged, remote)) {
          const next = { ...merged, revision: (merged.revision || 0) + 1, updatedAt: Date.now() };
          fileId.current = await drive.upload(fileId.current, next);
          current.setDriveRevision(next.revision);
        }
        lastRun.current = Date.now();
        lastSyncedVersion.current = storeRef.current.localVersion;
        setStatus({ state: 'idle', error: null, lastSyncAt: Date.now() });
      } catch (err) {
        console.warn('Drive sync failed', err);
        setStatus((s) => ({ ...s, state: 'error', error: err.message || 'Sync failed' }));
        if (err instanceof DriveApiError && err.status === 401) await auth.signOut();
      } finally {
        inFlight.current = false;
        if (queued.current) {
          queued.current = false;
          syncNow();
        }
      }
    },
    [auth]
  );

  useEffect(() => {
    if (auth.account && store.loaded) syncNow({ force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.account, store.loaded]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && syncNow());
    return () => sub.remove();
  }, [syncNow]);

  useEffect(() => {
    if (!auth.account || !store.loaded) return;
    if (store.localVersion === lastSyncedVersion.current) return;
    const timer = setTimeout(syncNow, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [auth.account, store.loaded, store.localVersion, syncNow]);

  return { ...status, syncNow: () => syncNow({ force: true }) };
}
