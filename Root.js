import { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, colors } from './src/theme';

// Registered synchronously as the app entry. It picks the theme, then loads
// App and its components, whose StyleSheets bake the palette in at import.
const THEME_KEY = 'almanac:theme';

export default function Root() {
  const [App, setApp] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let preference = 'system';
      try {
        preference = (await AsyncStorage.getItem(THEME_KEY)) || 'system';
      } catch {}
      applyTheme(preference);
      const mod = await import('./App');
      if (!cancelled) setApp(() => mod.default);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!App) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <App />;
}
