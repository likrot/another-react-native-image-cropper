// In test runs we apply `react-native-worklets/plugin` so jest can correctly
// transform reanimated worklets and `useAnimatedStyle` dependency tracking.
// We intentionally do NOT bake the plugin into the bob-built output —
// consumers apply it in their own app's babel config (last in their plugin
// list), and double-transformation would cause issues.
module.exports = (api) => {
  const isTest = api.env('test');
  return {
    overrides: [
      {
        exclude: /\/node_modules\//,
        presets: ['module:react-native-builder-bob/babel-preset'],
        plugins: isTest ? ['react-native-worklets/plugin'] : [],
      },
      {
        include: /\/node_modules\//,
        presets: ['module:@react-native/babel-preset'],
      },
    ],
  };
};
