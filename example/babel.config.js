const path = require('path');
const { getConfig } = require('react-native-builder-bob/babel-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');

module.exports = getConfig(
  {
    presets: ['module:@react-native/babel-preset'],
    // Required for Reanimated 4. Must remain last in the plugin list.
    plugins: ['react-native-worklets/plugin'],
  },
  { root, pkg }
);
