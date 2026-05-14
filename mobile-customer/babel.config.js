module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Reanimated 4 (Expo SDK 54+) needs the worklets plugin LAST.
    plugins: ['react-native-worklets/plugin'],
  };
};
