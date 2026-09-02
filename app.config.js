// Extends app.json.
// - Registers the Google sign-in redirect scheme (reversed OAuth client ID)
//   so the browser can hand control back to the app.
// - Declares the packages Almanac may launch (focus and timer apps).
// Both are baked into the native build: change them, rebuild.

const withAppQueries = require('./plugins/withAppQueries');

const CLIENT_SUFFIX = '.apps.googleusercontent.com';
const LAUNCHABLE_PACKAGES = [
  'com.underthing.focus.friend', // Focus Friend
  'cc.forestapp', // Forest
  'com.google.android.deskclock', // Google Clock
  'com.sec.android.app.clockpackage', // Samsung Clock
];

module.exports = ({ config }) => {
  const clientId = config.extra?.googleClientId || '';
  const schemes = [config.scheme].flat().filter(Boolean);
  if (clientId.endsWith(CLIENT_SUFFIX) && !clientId.startsWith('PASTE')) {
    schemes.push(`com.googleusercontent.apps.${clientId.replace(CLIENT_SUFFIX, '')}`);
  }
  const plugins = [...(config.plugins || []), [withAppQueries, { packages: LAUNCHABLE_PACKAGES }]];
  return { ...config, scheme: schemes, plugins };
};
