import { registerRootComponent } from 'expo';
import Root from './Root';

// registerRootComponent must run synchronously when the bundle loads (the
// dev client looks for "main" right away). Root applies the saved theme and
// then loads the rest of the app.
registerRootComponent(Root);
