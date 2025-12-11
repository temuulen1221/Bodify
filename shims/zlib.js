// Minimal zlib shim for browser environment — no-op compression methods
module.exports = {
  deflate: function(buf, cb) { if (cb) cb(null, buf); },
  deflateSync: function(buf) { return buf; },
  inflate: function(buf, cb) { if (cb) cb(null, buf); },
  inflateSync: function(buf) { return buf; },
};
