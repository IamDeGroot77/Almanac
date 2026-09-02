import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// JS face of the AlmanacAlarm native module (Android only). Safe when the
// native side is missing (older build, laptop): reports unsupported.
const native = Platform.OS === 'android' ? requireOptionalNativeModule('AlmanacAlarm') : null;

export const isAvailable = () => !!native;

// Epoch ms of the next alarm set in the clock app, or null.
export function getNextAlarm() {
  if (!native) return null;
  try {
    const v = native.nextAlarm();
    return typeof v === 'number' && v > 0 ? v : null;
  } catch {
    return null;
  }
}
