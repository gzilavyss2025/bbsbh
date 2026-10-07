// The postseason game-type rule, in one place. Import it from records/postseason.mjs,
// which re-exports it. This leaf file exists only because long-at-bats.mjs cannot
// import postseason.mjs: postseason.mjs -> team-records.mjs -> long-at-bats.mjs is a cycle.

// Wild Card Series, Division Series, League Championship Series, World Series.
// Never the umbrella 'P' (src/api/boxlines/rows.js), and never the All-Star Game 'A'.
export const POSTSEASON_GAME_TYPES = 'F,D,L,W'

// 'P' for a postseason game, 'R' for everything else (ADR-0094, ADR-0102).
export const scopeOfGameType = (gameType) => (POSTSEASON_GAME_TYPES.split(',').includes(gameType) ? 'P' : 'R')
