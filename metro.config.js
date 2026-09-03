const { getDefaultConfig } = require('expo/metro-config');

// Keep the exported web builds (docs/app, dist-web) and the scratch export
// out of Metro's file map: they are megabytes of generated JS that slowed
// every reload on Windows, where Metro has no Watchman and crawls by hand.
const config = getDefaultConfig(__dirname);
const path = require('path');
const escape = (p) => p.replace(/[\\/]/g, '[\\\\/]').replace(/\./g, '\\.');
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : config.resolver.blockList ? [config.resolver.blockList] : []),
  new RegExp(`${escape(path.join(__dirname, 'docs'))}[\\\\/].*`),
  new RegExp(`${escape(path.join(__dirname, 'dist-web'))}[\\\\/].*`),
  new RegExp(`${escape(path.join(__dirname, 'dist'))}[\\\\/].*`),
];

module.exports = config;
