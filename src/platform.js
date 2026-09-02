import { Platform } from 'react-native';

// The same code runs on the phone and in the browser. Phone-only features
// (sleep, calendar, notifications, hand-off apps, Google Tasks and Canvas
// sync) check these and step aside on the web; the laptop gets that data
// through Drive sync instead.
export const isWeb = Platform.OS === 'web';
export const isPhone = !isWeb;
