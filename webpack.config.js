const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Global aliases for shims
  config.resolve = config.resolve || {};
  config.resolve.alias = Object.assign({}, config.resolve.alias || {}, {
    tty: path.resolve(__dirname, 'shims/tty.js'),
    os: path.resolve(__dirname, 'shims/os.js'),
    events: path.resolve(__dirname, 'shims/events.js'),
    http: path.resolve(__dirname, 'shims/http.js'),
    'expo-router/build/static/renderStaticContent': path.resolve(__dirname, 'shims/empty.js'),
    'expo-router/node/render': path.resolve(__dirname, 'shims/empty.js'),
    'expo-router/node': path.resolve(__dirname, 'shims/empty.js'),
  });

  // Provide fallbacks for Node core modules used by some libraries
  config.resolve.fallback = Object.assign({}, config.resolve.fallback || {}, {
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
    crypto: require.resolve('crypto-browserify'),
  util: path.resolve(__dirname, 'shims/util.js'),
    async_hooks: path.resolve(__dirname, 'shims/async_hooks.js'),
    os: path.resolve(__dirname, 'shims/os.js'),
    events: path.resolve(__dirname, 'shims/events.js'),
    fs: path.resolve(__dirname, 'shims/fs.js'),
    tls: path.resolve(__dirname, 'shims/tls.js'),
    net: path.resolve(__dirname, 'shims/net.js'),
    http2: path.resolve(__dirname, 'shims/http2.js'),
    path: path.resolve(__dirname, 'shims/path.js'),
    dns: path.resolve(__dirname, 'shims/dns.js'),
    url: path.resolve(__dirname, 'shims/url.js'),
    zlib: path.resolve(__dirname, 'shims/zlib.js'),
  });

  // Make Buffer available globally for libs that expect it
  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    })
  );

  // Ensure .vrm files are emitted as static assets so require() returns a URL
  config.module = config.module || {};
  config.module.rules = config.module.rules || [];
  const hasVrmRule = config.module.rules.some(r => r.test && r.test.toString().includes('vrm'));
  if (!hasVrmRule) {
    config.module.rules.push({
      test: /\.vrm$/i,
      type: 'asset/resource'
    });
  }

  return config;
};
