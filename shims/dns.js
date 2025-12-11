// Minimal dns shim for browser environment — provide no-op resolve functions
module.exports = {
  lookup: function(hostname, options, callback) {
    if (typeof options === 'function') { callback = options; }
    if (typeof callback === 'function') callback(null, '127.0.0.1', 4);
  },
  resolve: function() { throw new Error('dns.resolve not supported in browser'); },
};
