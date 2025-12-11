// Minimal tls shim for browser environment — no-op implementations
// Most grpc/tls usage on server will not be used in the browser; provide
// placeholders to avoid bundling errors.
module.exports = {
  connect: function() { throw new Error('tls.connect is not supported in browser'); },
  createSecureContext: function() { return {}; },
};
