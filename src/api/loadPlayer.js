// The player page's data layer, as a barrel over src/api/player/.
//
// It used to be ONE function. `/player/{id}` is now a hub of four real routes —
// Overview (the bare address), Stats, Analytics, History — and **each tab loads
// only its own data**, the rule the team hub already keeps (ADR-0034). So the
// old `loadPlayer` split along the same seams the page did: a cheap shared
// context every tab pays for (`player/context.js`), the shell's own header
// loader (`player/core.js`), and one loader per tab.
//
// This file is a thin re-export so no caller has to know which module a loader
// lives in — the same shape `person.js` takes over `person/`. Read
// `player/context.js` first: it states the three rules the directory keeps, and
// it is the one module more than one tab loader imports.

export { resolveCurrentSeasonStat } from './player/context.js'
export { loadPlayerCore } from './player/core.js'
export { loadPlayerOverview } from './player/overview.js'
export { loadPlayerStats } from './player/stats.js'
export { loadPlayerAnalytics } from './player/analytics.js'
export { loadPlayerHistory, loadPositionScope } from './player/history.js'
