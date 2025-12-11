// util shim that ensures TextEncoder/TextDecoder exist for modules expecting them
let upstream = {};
try { upstream = require('util/'); } catch (e) { /* upstream util not available - that's fine */ }

const TextEncoderCtor = (typeof globalThis !== 'undefined' && typeof globalThis.TextEncoder === 'function')
  ? globalThis.TextEncoder
  : class TextEncoder {
      constructor() {}
      encode(input) {
        // Return a Uint8Array like the platform TextEncoder
        const s = String(input === undefined ? '' : input);
        if (typeof Buffer !== 'undefined') {
          return Uint8Array.from(Buffer.from(s, 'utf8'));
        }
        // fallback simple UTF-8 encoder (slow)
        const arr = [];
        for (let i = 0; i < s.length; ++i) {
          const code = s.charCodeAt(i);
          if (code < 128) arr.push(code);
          else if (code < 2048) { arr.push(192 | (code >> 6), 128 | (code & 63)); }
          else { arr.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63)); }
        }
        return new Uint8Array(arr);
      }
    };

const TextDecoderCtor = (typeof globalThis !== 'undefined' && typeof globalThis.TextDecoder === 'function')
  ? globalThis.TextDecoder
  : class TextDecoder {
      constructor(encoding) { this.encoding = encoding || 'utf-8'; }
      decode(buffer) {
        if (typeof Buffer !== 'undefined') {
          return Buffer.from(buffer).toString('utf8');
        }
        // fallback: convert Uint8Array to string (assumes utf-8 ASCII subset)
        let s = '';
        const arr = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        for (let i = 0; i < arr.length; ++i) s += String.fromCharCode(arr[i]);
        return s;
      }
    };

module.exports = Object.assign({}, upstream, {
  TextEncoder: TextEncoderCtor,
  TextDecoder: TextDecoderCtor,
});

// Ensure globals exist and are constructors for libraries that expect them on globalThis
try {
  if (typeof globalThis !== 'undefined') {
    if (typeof globalThis.TextEncoder !== 'function') globalThis.TextEncoder = TextEncoderCtor;
    if (typeof globalThis.TextDecoder !== 'function') globalThis.TextDecoder = TextDecoderCtor;
  }
} catch (e) {
  // ignore
}
