import { registerRootComponent } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme } from './src/theme';

// The theme has to be chosen before App and its components are imported,
// because their StyleSheets bake the palette in. So: read the preference,
// apply it, then import the app.
const THEME_KEY = 'almanac:theme';

(async () => {
  let preference = 'system';
  try {
    preference = (await AsyncStorage.getItem(THEME_KEY)) || 'system';
  } catch {}
  applyTheme(preference);
  const { default: App } = await import('./App');
  registerRootComponent(App);
})();
