// Minimal http2 shim for browser environment — no-op placeholders
module.exports = {
  createServer: function() { throw new Error('http2.createServer not supported in browser'); },
  connect: function() { throw new Error('http2.connect not supported in browser'); },
};
