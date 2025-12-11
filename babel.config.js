module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Must be the last plugin for Reanimated to work correctly
      'react-native-reanimated/plugin',
    ],
  };
};
