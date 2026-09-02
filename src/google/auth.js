import { useCallback, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Google sign-in for the Tasks bridge, using the standard OAuth code flow
// with PKCE (no client secret). Tokens live in the device keystore.
//
// The OAuth client is of type "iOS" even though this runs on Android. Google
// no longer accepts custom-scheme redirects for "Android" type clients in a
// browser flow (it steers Android apps to its native sign-in SDK), but iOS
// type clients still do, need no SHA-1, and work from any platform. The
// redirect scheme is the reversed client ID, registered in app.config.js.
// Docs: https://docs.expo.dev/versions/v57.0.0/sdk/auth-session/
//       https://docs.expo.dev/versions/v57.0.0/sdk/securestore/

WebBrowser.maybeCompleteAuthSession();

const TOKENS_KEY = 'google_tokens';
const SCOPES = ['https://www.googleapis.com/auth/tasks', 'openid', 'email'];
const CLIENT_SUFFIX = '.apps.googleusercontent.com';

export const googleClientId = Constants.expoConfig?.extra?.googleClientId || '';
export const isGoogleConfigured =
  googleClientId.endsWith(CLIENT_SUFFIX) && !googleClientId.startsWith('PASTE');

export function redirectSchemeFor(clientId) {
  return `com.googleusercontent.apps.${clientId.replace(CLIENT_SUFFIX, '')}`;
}

const redirectUri = isGoogleConfigured
  ? AuthSession.makeRedirectUri({ native: `${redirectSchemeFor(googleClientId)}:/oauthredirect` })
  : undefined;

async function loadTokens() {
  try {
    const raw = await SecureStore.getItemAsync(TOKENS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Token load failed', err);
    return null;
  }
}

async function saveTokens(tokens) {
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
}

// Returns a usable access token, refreshing it when it's about to expire.
// Resolves to null when there's no session or the refresh fails.
export async function getValidAccessToken() {
  const tokens = await loadTokens();
  if (!tokens) return null;
  if (tokens.expiresAt - 60_000 > Date.now()) return tokens.accessToken;
  if (!tokens.refreshToken) return null;
  try {
    const refreshed = await AuthSession.refreshAsync(
      { clientId: googleClientId, refreshToken: tokens.refreshToken },
      Google.discovery
    );
    const next = {
      ...tokens,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || tokens.refreshToken,
      expiresAt: Date.now() + (refreshed.expiresIn || 3600) * 1000,
    };
    await saveTokens(next);
    return next.accessToken;
  } catch (err) {
    console.warn('Token refresh failed', err);
    return null;
  }
}

function emailFromIdToken(idToken) {
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(globalThis.atob(payload)).email || null;
  } catch {
    return null;
  }
}

export function useGoogleAuth() {
  const [account, setAccount] = useState(null); // email string or null
  const [ready, setReady] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: googleClientId || undefined,
    iosClientId: googleClientId || undefined,
    androidClientId: googleClientId || undefined,
    redirectUri,
    scopes: SCOPES,
  });

  useEffect(() => {
    loadTokens()
      .then((t) => setAccount(t?.email || null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (response?.type !== 'success' || !response.authentication) return;
    const auth = response.authentication;
    const tokens = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken || null,
      expiresAt: Date.now() + (auth.expiresIn || 3600) * 1000,
      email: auth.idToken ? emailFromIdToken(auth.idToken) : null,
    };
    saveTokens(tokens)
      .then(() => setAccount(tokens.email || 'Google account'))
      .catch((err) => console.warn('Token save failed', err));
  }, [response]);

  const signIn = useCallback(() => {
    if (!request) return Promise.resolve();
    return promptAsync();
  }, [request, promptAsync]);

  const signOut = useCallback(async () => {
    await clearTokens();
    setAccount(null);
  }, []);

  return { configured: isGoogleConfigured, ready, account, signIn, signOut, canSignIn: !!request };
}
