// This JavaScript shim re-exports the TypeScript implementation to avoid
// duplicate logic and ambiguous module resolution at runtime. Keep imports as
// `from '../services/firebase'` throughout the app.
module.exports = require('./firebase.ts');

