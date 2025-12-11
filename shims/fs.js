// Minimal fs shim for browser environment
// Expose a subset of the Node fs API as no-ops / stubs so server-only
// modules that import 'fs' do not crash bundling for web builds.
module.exports = {
  readFile: function(path, cb) { if (typeof cb === 'function') cb(new Error('fs.readFile not supported in browser')); },
  readFileSync: function() { throw new Error('fs.readFileSync not supported in browser'); },
  existsSync: function() { return false; },
  promises: {
    readFile: async function() { throw new Error('fs.promises.readFile not supported in browser'); }
  }
};
