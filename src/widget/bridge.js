import { Platform } from 'react-native';

// Loaded lazily so the web build and older phone builds never import the
// widget library. Refreshing is best-effort.
export function refreshWidgetSafe(state) {
  if (Platform.OS !== 'android') return;
  try {
    require('./index').refreshWidget(state);
  } catch (err) {
    // No widget support in this build.
  }
}
