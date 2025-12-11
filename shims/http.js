// Minimal http shim for browser environment
module.exports = {
  createServer: function() { throw new Error('http.createServer not supported in browser'); },
  request: function() { throw new Error('http.request not supported in browser'); },
};
