import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// JS face of the AlmanacHealth native module (Health Connect sleep, Android
// only). Safe when the native side is missing: reports unavailable.
const native = Platform.OS === 'android' ? requireOptionalNativeModule('AlmanacHealth') : null;

export const isAvailable = () => !!native;

// 'unavailable' | 'update' | 'available' | 'missing' (no native module)
export function status() {
  if (!native) return 'missing';
  try {
    const s = native.sdkStatus();
    return s === 3 ? 'available' : s === 2 ? 'update' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function hasPermissionAsync() {
  if (!native) return false;
  try {
    return await native.hasPermissionAsync();
  } catch {
    return false;
  }
}

export async function requestPermissionAsync() {
  if (!native) return false;
  return native.requestPermissionAsync();
}

// [{ start, end, title, source }] newest last
export async function readSleepAsync(days = 7) {
  if (!native) return [];
  try {
    const list = JSON.parse(await native.readSleepJsonAsync(days));
    return list.sort((a, b) => a.start - b.start);
  } catch (err) {
    console.warn('Health Connect read failed', err);
    return [];
  }
}
