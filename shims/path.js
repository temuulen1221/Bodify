// Minimal path shim for browser environment (POSIX-style helpers)
const path = {
  basename: function(p) { return String(p).split('/').pop(); },
  dirname: function(p) { const s = String(p); const i = s.lastIndexOf('/'); return i === -1 ? '.' : s.slice(0, i); },
  extname: function(p) { const s = String(p); const i = s.lastIndexOf('.'); return i === -1 ? '' : s.slice(i); },
  join: function(...parts) { return parts.filter(Boolean).join('/'); },
  resolve: function(...parts) { return parts.join('/'); },
  sep: '/',
};

module.exports = path;
