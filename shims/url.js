// Minimal url shim for browser environment
// Use the platform URL if available and provide parse/format helpers.
module.exports = {
  URL: typeof globalThis !== 'undefined' ? globalThis.URL : undefined,
  parse: function(s) {
    try {
      const u = new (typeof globalThis !== 'undefined' ? globalThis.URL : URL)(s);
      return { href: u.href, protocol: u.protocol, hostname: u.hostname, port: u.port, pathname: u.pathname, search: u.search, hash: u.hash };
    } catch (e) {
      return { href: s };
    }
  },
  format: function(u) {
    try { return (u && u.href) || String(u); } catch (e) { return String(u); }
  },
};
