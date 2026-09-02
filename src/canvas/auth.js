import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { makeCanvasApi, normalizeHost } from './api';

// The Canvas host and personal access token live in the device keystore.
const KEY = 'canvas_credentials';

export async function loadCanvasCredentials() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useCanvasAuth() {
  const [creds, setCreds] = useState(null); // { host, token, userName }
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCanvasCredentials()
      .then(setCreds)
      .finally(() => setReady(true));
  }, []);

  const connect = useCallback(async (hostInput, token) => {
    setError(null);
    const host = normalizeHost(hostInput);
    if (!host) {
      setError('That address doesn’t look right. Try something like school.instructure.com.');
      return false;
    }
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      setError('Paste the access token from Canvas.');
      return false;
    }
    try {
      const me = await makeCanvasApi(host, cleanToken).self();
      const next = { host, token: cleanToken, userName: me?.name || me?.short_name || 'Canvas user' };
      await SecureStore.setItemAsync(KEY, JSON.stringify(next));
      setCreds(next);
      return true;
    } catch (err) {
      setError(
        err.status === 401
          ? `Canvas at ${host.replace(/^https?:\/\//, '')} rejected the token (${cleanToken.length} characters). Turn on "Show token" and compare it with the one Canvas showed you.`
          : `Couldn’t reach ${host.replace(/^https?:\/\//, '')}: ${err.message}`
      );
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await SecureStore.deleteItemAsync(KEY);
    setCreds(null);
    setError(null);
  }, []);

  return { ready, connected: !!creds, host: creds?.host || null, userName: creds?.userName || null, creds, error, connect, disconnect };
}
