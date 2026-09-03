import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { isWeb } from './platform';

// A biometric gate on the Journal tab (phone only). Unlocks for the session
// and locks again when the app goes to the background. Falls back to "no lock
// available" on builds without the native module.
let LocalAuth = null;
try {
  if (!isWeb) LocalAuth = require('expo-local-authentication');
} catch {
  LocalAuth = null;
}

export function lockAvailable() {
  return !!LocalAuth;
}

export default function useJournalLock(enabled) {
  const [unlocked, setUnlocked] = useState(!enabled);
  const [busy, setBusy] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) setUnlocked(true);
    else setUnlocked(false);
  }, [enabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && enabledRef.current) setUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    if (!enabledRef.current) return setUnlocked(true);
    if (!LocalAuth) return setUnlocked(true);
    setBusy(true);
    try {
      const hardware = await LocalAuth.hasHardwareAsync();
      const enrolled = hardware && (await LocalAuth.isEnrolledAsync());
      if (!enrolled) return setUnlocked(true); // nothing to check against
      const res = await LocalAuth.authenticateAsync({ promptMessage: 'Open the journal', cancelLabel: 'Not now' });
      if (res.success) setUnlocked(true);
    } catch (err) {
      console.warn('Journal unlock failed', err?.message || err);
    } finally {
      setBusy(false);
    }
  }, []);

  return { unlocked, busy, unlock };
}
