// Config plugin: declare the packages Almanac may launch (Android 11+
// package visibility). Without this, opening another app by package name
// silently fails.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAppQueries(config, { packages = [] } = {}) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.queries = manifest.queries || [{}];
    const q = manifest.queries[0];
    q.package = q.package || [];
    for (const name of packages) {
      if (!q.package.some((p) => p.$?.['android:name'] === name)) {
        q.package.push({ $: { 'android:name': name } });
      }
    }
    return mod;
  });
};
