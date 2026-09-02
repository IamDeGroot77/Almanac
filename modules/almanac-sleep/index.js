import { PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// JS face of the AlmanacSleep native module (Android only). Every call is
// safe when the native side is missing (older build, other platform): it
// just reports unavailable.
const native = Platform.OS === 'android' ? requireOptionalNativeModule('AlmanacSleep') : null;

export const isAvailable = () => !!native;

export async function requestPermissionAsync() {
  if (!native) return 'unavailable';
  if (Platform.Version < 29) return 'granted';
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION, {
    title: 'Sleep detection',
    message:
      'Almanac uses Android’s sleep detection to notice when you went to bed and got up, so a forgotten tap never spoils the day’s numbers.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
}

export const hasPermission = () => !!native && native.hasPermission();
export const isSubscribed = () => !!native && native.isSubscribed();

export async function subscribeAsync() {
  if (!native) throw new Error('Sleep detection needs a newer app build.');
  return native.subscribeAsync();
}

export async function unsubscribeAsync() {
  if (!native) return false;
  return native.unsubscribeAsync();
}

// [{ start, end, status, receivedAt }] with status 0 = detected, 1 = missing data, 2 = not detected
export function getSegments() {
  if (!native) return [];
  try {
    return JSON.parse(native.getSegmentsJson());
  } catch {
    return [];
  }
}

// [{ timestamp, confidence (0-100), light, motion }] roughly every 10 minutes
export function getClassifyEvents() {
  if (!native) return [];
  try {
    return JSON.parse(native.getClassifyJson());
  } catch {
    return [];
  }
}

export function clear() {
  native?.clear();
}
