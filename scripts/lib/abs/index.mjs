// The pure half of gen-abs-challenges.mjs, in eight parts: turn ONE Final
// game's feed into challenge rows (rows.mjs), replay a club's challenge bank
// inning by inning (bank.mjs), count the half-innings a club played still
// holding one (chances.mjs), find the nights a club emptied that bank earliest
// (ranout.mjs), walk a man's calls for runs of the same outcome (streaks.mjs),
// hold the rulebook still and ask what a win or a loss changed (momentum.mjs),
// turn one club's roster into how much baseball each man saw
// (exposure.mjs), and turn the accumulated rows plus the swept-games ledger
// into public/data/abs-challenges.json (export.mjs).
//
// THE SEAM BETWEEN THEM IS THE DISCIPLINE THE WHOLE JOB RESTS ON. The database
// stores FACTS — one row per challenge, one row per game — and every split the
// report page shows is computed at EXPORT time, never at sweep time. So a new
// cut of the season costs `--export-only` and no re-sweep of two thousand game
// feeds, and adding one never needs a schema change or a backfill. Splitting
// the two halves into their own files is what makes that seam visible: a new
// derivation goes in export.mjs, and rows.mjs stays the size of the feed.
//
// RANKING IS IN NEITHER. Both halves ship each club's, umpire's and player's
// own totals; sorting them against each other, and the minimum-sample floors
// that decide who appears on a board at all, live in the reader
// (src/api/around-the-game/absChallenges.js).
//
// This file is the door. gen-abs-challenges.mjs and test/abs-challenges.test.js
// import from here, so moving a function between the eight files costs no
// caller an edit.

export {
  roleFor,
  umpireCallFor,
  buildRow,
  challengeRowsForGame,
  isPlayedGame,
  PLAYED_CODE,
  ROLES,
} from './rows.mjs'
export {
  replayBank,
  bankHolds,
  armedAt,
  auditBank,
  firstExtraInning,
  halfKey,
  HALVES,
  ISSUED,
  FIRST_EXTRA_INNING,
  REGULATION_INNINGS,
} from './bank.mjs'
export {
  gameShape,
  halfPlayed,
  halvesPlayed,
  chancesByInning,
  challengesByInningRole,
} from './chances.mjs'
export { ranOutBoard } from './ranout.mjs'
export { momentumCuts } from './momentum.mjs'
export { streaksByPlayer, streakBoards, STREAK_TOP } from './streaks.mjs'
export {
  inningsFromOuts,
  exposureRowsFor,
  exposureByPlayer,
  exposureRates,
  hasExposure,
  CATCHER,
} from './exposure.mjs'
export {
  MISS_BANDS,
  LAST_EARLY_INNING,
  challengerGain,
  summarizeLevel,
  buildExport,
  buildExposureExport,
  buildExposureClubsExport,
} from './export.mjs'
