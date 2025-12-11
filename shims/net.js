// Minimal net shim for browser environment
// Provide placeholders for net.Socket and server-related APIs to avoid bundling errors
module.exports = {
  createServer: function() { throw new Error('net.createServer not supported in browser'); },
  Socket: function() { throw new Error('net.Socket not supported in browser'); },
};
