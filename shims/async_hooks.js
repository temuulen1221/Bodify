// Minimal async_hooks shim for environments without Node's async_hooks
// Provide no-op implementations to satisfy imports from server-only bundles
module.exports = {
  createHook: function() { return { enable: function() {}, disable: function() {} }; },
  executionAsyncId: function() { return 0; },
  triggerAsyncId: function() { return 0; },
};
