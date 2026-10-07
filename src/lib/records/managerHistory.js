// The first season the manager-history shards cover. A pure module on purpose: the
// nightly generator (scripts/gen-manager-history.mjs) and the reader
// (src/api/managers.js) both import it, and a generator must not pull in a module
// that touches `window` or `import.meta.env`. test/manager-history-range.test.js
// checks every shipped shard agrees.
export const MANAGER_HISTORY_FIRST_SEASON = 1969
