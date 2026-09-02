// Extends app.json. Registers the Google sign-in redirect scheme, which is the
// reversed OAuth client ID, so the browser can hand control back to the app.
// The scheme is baked into the native build: change the client ID, rebuild.

const CLIENT_SUFFIX = '.apps.googleusercontent.com';

module.exports = ({ config }) => {
  const clientId = config.extra?.googleClientId || '';
  const schemes = [config.scheme].flat().filter(Boolean);
  if (clientId.endsWith(CLIENT_SUFFIX) && !clientId.startsWith('PASTE')) {
    schemes.push(`com.googleusercontent.apps.${clientId.replace(CLIENT_SUFFIX, '')}`);
  }
  return { ...config, scheme: schemes };
};
