import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import Root from './Root';

// registerRootComponent must run synchronously when the bundle loads (the
// dev client looks for "main" right away). Root applies the saved theme and
// then loads the rest of the app.
registerRootComponent(Root);

// Home-screen widget (Android): runs headless when the launcher asks for it.
if (Platform.OS === 'android') {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    const { widgetTaskHandler } = require('./src/widget');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (err) {
    // Older build without the widget module.
  }
}
