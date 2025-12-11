'use strict';

// Minimal shim for fbjs/lib/performanceNow
// Provides a performance.now()-like function in environments where fbjs isn't present.
let perfNow;
if (global && (global.performance && typeof global.performance.now === 'function')) {
  perfNow = () => global.performance.now();
} else if (typeof Date !== 'undefined' && Date.now) {
  const start = Date.now();
  perfNow = () => Date.now() - start;
} else {
  let start = 0;
  perfNow = () => (++start);
}

module.exports = perfNow;
