import { useCallback, useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { getSecret, setSecret, deleteSecret } from '../secure';

// Google sign-in in the browser, via Google Identity Services' token client.
// It hands out short-lived access tokens and re-issues them quietly while
// the Google session lasts, which suits a page that stays open on a laptop.
// Needs a "Web application" OAuth client whose authorized origin is the
// site's origin (extra.googleWebClientId).

const TOKENS_KEY = 'google_tokens_web';
export const webClientId = Constants.expoConfig?.extra?.googleWebClientId || '';
export const isWebConfigured = webClientId.endsWith('.apps.googleusercontent.com') && !webClientId.startsWith('PASTE');
export const WEB_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
];

let gisReady = null;
function loadGis() {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (globalThis.google?.accounts?.oauth2) return resolve(globalThis.google);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve(globalThis.google);
    s.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(s);
  });
  return gisReady;
}

let cached = null; // { accessToken, expiresAt, email }

async function fetchEmail(accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    return (await res.json()).email || null;
  } catch {
    return null;
  }
}

function requestToken({ prompt, hint }) {
  return new Promise(async (resolve, reject) => {
    try {
      const google = await loadGis();
      const client = google.accounts.oauth2.initTokenClient({
        client_id: webClientId,
        scope: WEB_SCOPES.join(' '),
        hint: hint || undefined,
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          resolve({ accessToken: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 });
        },
        error_callback: (err) => reject(new Error(err?.message || err?.type || 'Sign-in cancelled')),
      });
      client.requestAccessToken({ prompt });
    } catch (err) {
      reject(err);
    }
  });
}

export async function getValidAccessTokenWeb() {
  if (!isWebConfigured) return null;
  if (!cached) {
    try {
      cached = JSON.parse((await getSecret(TOKENS_KEY)) || 'null');
    } catch {
      cached = null;
    }
  }
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.accessToken;
  if (!cached?.email) return null; // never signed in on this browser
  try {
    const t = await requestToken({ prompt: '', hint: cached.email });
    cached = { ...cached, ...t };
    await setSecret(TOKENS_KEY, JSON.stringify(cached));
    return cached.accessToken;
  } catch {
    return null;
  }
}

export function useGoogleAuthWeb() {
  const [account, setAccount] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSecret(TOKENS_KEY)
      .then((raw) => {
        const t = raw ? JSON.parse(raw) : null;
        cached = t;
        setAccount(t?.email || null);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      const t = await requestToken({ prompt: 'consent' });
      const email = await fetchEmail(t.accessToken);
      cached = { ...t, email };
      await setSecret(TOKENS_KEY, JSON.stringify(cached));
      setAccount(email || 'Google account');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    cached = null;
    await deleteSecret(TOKENS_KEY);
    setAccount(null);
  }, []);

  return { configured: isWebConfigured, ready, account, signIn, signOut, canSignIn: isWebConfigured, error };
}
