import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getValidAccessToken } from '../google/auth';
import { makeDrive, DriveApiError } from './driveApi';
import { mergeStates, shareable, sameShareable } from './merge';

const DEBOUNCE_MS = 45000; // edits are batched
const MIN_INTERVAL_MS = 3 * 60 * 1000;
const FOREGROUND_MIN_MS = 5 * 60 * 1000;
const BACKOFF_MS = [30000, 60000, 120000, 300000, 900000]; // after repeated failures

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
  const lastRemoteModified = useRef(null);
  const lastRemoteBody = useRef(null);
  const lastSyncedVersion = useRef(-1);
  const failures = useRef(0);
  const blockedUntil = useRef(0);
  const needsReconnect = useRef(false);

  const syncNow = useCallback(
    async ({ force = false } = {}) => {
      const current = storeRef.current;
      if (!auth.account || !current.loaded) return;
      if (inFlight.current) {
        queued.current = true;
        return;
      }
      if (needsReconnect.current && !force) return; // the token lacks the Drive scope; only a reconnect fixes it
      if (!force && Date.now() < blockedUntil.current) return;
      if (!force && Date.now() - lastRun.current < MIN_INTERVAL_MS && current.localVersion === lastSyncedVersion.current) return;
      inFlight.current = true;
      setStatus((s) => ({ ...s, state: 'syncing', error: null }));
      try {
        const token = await getValidAccessToken();
        if (!token) throw new Error('Google session expired. Connect again.');
        const drive = makeDrive(token);
        const meta = await drive.findFile();
        fileId.current = meta?.id || null;
        // Skip the download when the file has not changed since we last saw it.
        const unchangedRemote = meta && lastRemoteModified.current === meta.modifiedTime && lastRemoteBody.current;
        const remote = fileId.current ? unchangedRemote ? lastRemoteBody.current : await drive.download(fileId.current) : null;
        if (meta && !unchangedRemote) {
          lastRemoteModified.current = meta.modifiedTime;
          lastRemoteBody.current = remote;
        }
        let local = shareable(current);
        let merged = remote ? mergeStates(local, remote) : local;

        // Edits typed while the download ran are newer than the snapshot: fold them in.
        const fresh = storeRef.current;
        if (fresh.localVersion !== current.localVersion) {
          local = shareable(fresh);
          merged = mergeStates(local, merged);
        }

        // Apply anything the other device contributed.
        if (!remote || !sameShareable(merged, local)) storeRef.current.applyDriveMerge(merged);

        // Upload if Drive is behind, re-checking that nobody wrote in between.
        if (!remote || !sameShareable(merged, remote)) {
          const again = fileId.current ? await drive.findFile() : null;
          if (again && meta && again.modifiedTime !== meta.modifiedTime) {
            const latest = await drive.download(again.id);
            merged = mergeStates(merged, latest);
            storeRef.current.applyDriveMerge(merged);
            lastRemoteModified.current = again.modifiedTime;
            lastRemoteBody.current = latest;
          }
          const next = { ...merged, revision: (merged.revision || 0) + 1, updatedAt: Date.now() };
          fileId.current = await drive.upload(fileId.current, next);
          lastRemoteModified.current = null; // our own write; re-read next time
          storeRef.current.setDriveRevision(next.revision);
        }
        lastRun.current = Date.now();
        lastSyncedVersion.current = storeRef.current.localVersion;
        failures.current = 0;
        blockedUntil.current = 0;
        needsReconnect.current = false;
        setStatus({ state: 'idle', error: null, lastSyncAt: Date.now() });
      } catch (err) {
        const scope = /insufficient authentication scopes/i.test(err.message || '');
        failures.current += 1;
        blockedUntil.current = Date.now() + BACKOFF_MS[Math.min(failures.current - 1, BACKOFF_MS.length - 1)];
        if (scope) needsReconnect.current = true;
        if (failures.current <= 3 || scope) console.warn('Drive sync failed', err.message || err);
        setStatus((s) => ({ ...s, state: scope ? 'reconnect' : 'error', error: scope ? 'Google needs to be connected again so Almanac can use Drive. Settings → Google → Disconnect, then Connect.' : err.message || 'Sync failed' }));
        if (err instanceof DriveApiError && err.status === 401) await auth.signOut();
      } finally {
        inFlight.current = false;
        if (queued.current) {
          queued.current = false;
          if (!failures.current) syncNow();
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
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (Date.now() - lastRun.current < FOREGROUND_MIN_MS) return;
      syncNow();
    });
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
