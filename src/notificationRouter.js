import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { isWeb } from './platform';

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

function dispatch(response) {
  if (!response) return;
  const key = `${response.notification?.request?.identifier}:${response.notification?.date}:${response.actionIdentifier}`;
  if (seen.has(key)) return;
  seen.add(key);
  const action = response.actionIdentifier || '';
  for (const [prefix, handler] of handlers) {
    if (action.startsWith(prefix)) {
      try {
        handler(response);
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
}
