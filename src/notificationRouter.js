import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { isWeb } from './platform';

// Lazy: builds without expo-task-manager (runtime 1.5.0) must not crash at import.
let taps = null;
try {
  taps = isWeb ? null : require('./backgroundTaps');
} catch (err) {
  taps = null;
}

// One place that listens for notification responses (button taps, voice
// replies) and routes them by action identifier prefix. Features register a
// handler once; the router de-duplicates responses and replays the one that
// arrived while the app was closed.

const handlers = new Map(); // prefix -> (response) => void

export function registerNotificationHandler(prefix, handler) {
  handlers.set(prefix, handler);
  return () => {
    if (handlers.get(prefix) === handler) handlers.delete(prefix);
  };
}

const seen = new Set();

// Actions that only make sense near the moment they were tapped. A response
// replayed hours later (the process was dead) would otherwise answer a
// check-in nine hours late. Day-bracket taps are different: "Going to bed"
// tapped at 11 PM with the app dead is replayed at breakfast, and the
// handler applies it at the time the notification was shown (meta.at), so
// last night's day closes last night instead of being ignored.
const TIME_SENSITIVE = ['checkin-', 'energy-'];
const STALE_MS = 30 * 60 * 1000;

function dispatch(response) {
  if (!response) return;
  const at = Number(response.notification?.date) || 0;
  const action = response.actionIdentifier || '';
  const age = at ? Date.now() - at : 0;
  if (age > STALE_MS && TIME_SENSITIVE.some((p) => action.startsWith(p))) {
    console.warn('Ignoring a stale notification response', action, Math.round(age / 60000), 'min old');
    return;
  }
  const key = `${response.notification?.request?.identifier}:${response.notification?.date}:${response.actionIdentifier}`;
  if (seen.has(key)) return;
  seen.add(key);
  const meta = { at: at || Date.now(), stale: age > STALE_MS };
  for (const [prefix, handler] of handlers) {
    if (action.startsWith(prefix)) {
      try {
        handler(response, meta);
      } catch (err) {
        console.warn('Notification handler failed', prefix, err);
      }
      return;
    }
  }
}

// Mount once, near the root, after the store has loaded.
export function useNotificationRouter(ready) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  if (isWeb) return;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const last = Notifications.useLastNotificationResponse();
  const readyRef = useRef(ready);
  readyRef.current = ready;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => readyRef.current && dispatch(r));
    return () => sub.remove();
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (ready && last) dispatch(last);
  }, [ready, last]);

  // Taps recorded by the headless task while the app was dead. Same key as
  // the live response, so a tap that reached both paths applies once.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!ready || !taps) return;
    taps.drainPendingTaps().then((list) => list.forEach((tap) => dispatch(taps.tapToResponse(tap))));
  }, [ready]);
}
