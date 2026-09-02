import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Secret storage: the device keystore on the phone, the browser's local
// storage on the laptop (a personal, single-user app; good enough there).
const web = Platform.OS === 'web';
const PREFIX = 'almanac.secure.';

export async function getSecret(key) {
  if (web) {
    try {
      return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecret(key, value) {
  if (web) {
    globalThis.localStorage?.setItem(PREFIX + key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteSecret(key) {
  if (web) {
    globalThis.localStorage?.removeItem(PREFIX + key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
