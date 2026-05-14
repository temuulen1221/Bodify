// Patch console.warn to suppress known third-party deprecation notices
// before any modules are loaded. Must use require (not import) so this
// runs BEFORE expo-router/entry and its dependency chain initialise.
const _origWarn = console.warn;
console.warn = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  // expo-background-fetch prints this at import time; suppressed until we
  // can rebuild the dev client with expo-background-task native support.
  if (msg.startsWith('expo-background-fetch:')) return;
  _origWarn.apply(console, args);
};

require('expo-router/entry');
