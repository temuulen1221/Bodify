// Minimal tty shim for Metro/webpack to satisfy packages that require 'tty'
// This provides the minimal API expected by modules like `debug` when
// running in a browser or React Native environment.
module.exports = {
  isatty: function() { return false; },
  ReadStream: function() {},
  WriteStream: function() {},
  setRawMode: function() {},
};
