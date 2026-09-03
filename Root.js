import { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, colors } from './src/theme';

// Registered synchronously as the app entry. It picks the theme, then loads
// App and its components, whose StyleSheets bake the palette in at import.
const THEME_KEY = 'almanac:theme';

// Uncaught JS errors: log them to the dev server before the default handler runs.
if (globalThis.ErrorUtils?.setGlobalHandler) {
  const previous = globalThis.ErrorUtils.getGlobalHandler?.();
  globalThis.ErrorUtils.setGlobalHandler((err, isFatal) => {
    if (/Requiring unknown module/.test(err?.message || '')) return previous?.(err, false); // Metro's async-import probe, not a real failure
    console.error('Uncaught', isFatal ? '(fatal)' : '', err?.message || err, err?.stack || '');
    previous?.(err, isFatal);
  });
}

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
