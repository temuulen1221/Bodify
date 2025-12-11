// Minimal os shim for browser environment
module.exports = {
  platform: function() { return 'browser'; },
  release: function() { return '0.0.0'; },
  arch: function() { return 'x64'; },
};
