// Pure builder for the play-by-play "call-out" notes — the season-context lines
// (leader / streak / situational-record) shown on an at-bat card. Reads only an
// atbat entry (see computeHalfInningFeed) plus a precomputed callouts bundle
// (see api/callouts.js) and returns an ordered list of notes the card renders.
// Kept pure + separate so the trigger rules and wording are checkable and
// PlayByPlay.jsx stays a view. Empty when there's no bundle (an un-generated
// date, or a MiLB game in a file predating the MiLB expansion), so the card
// renders exactly as before.
//
// Each note is `{ text, personId, side, oppSide, kind, score, dedupeKey }` —
// `personId` (nullable) is who the note is ABOUT, for a headshot; `side`/
// `oppSide` ('away'|'home') name whose club(s) the note concerns, for a
// team-logo fallback when there's no single person. `kind` names the note's
// family, `score` is its 0–100 worthiness (see noteScore below and
// docs/callouts.md for the rubric), and `dedupeKey` identifies "the same fact,
// restated" across plays so the box-score roll-up keeps only the most-current
// wording (a count note updates as the game adds to it — the roll-up should
// show the LAST number, not one card per occurrence). PlayByPlay's at-bat card
// only ever reads `.text`; the box score's Insights roll-up
// (computeGameCalloutNotes below) uses the identity fields to draw a
// headshot/logo card per note and `score` to rank them.
//
// TWO TENSES, ONE RULE (see ADR-0014): a note rendered on a play card inside
// the innings view may fold in only what the reader has already revealed —
// counts through THAT play ("that's No. 16 this season"), never the game's
// outcome. Result-aware wording ("moved to 18-2", "just the 2nd loss in 7
// games when he goes deep") exists ONLY in the box-score roll-up, where the
// whole game sits behind a single seal and the final score is already exposed
// by the time any note text renders.
//
// Split (ADR-0038, check-file-size.mjs) into src/api/callout-notes/ — one
// module per concern: shared.js (cross-cutting helpers/constants),
// progress.js (the in-game count walk), vsTeamNote.js + liveAtBat.js (the
// live, entering-tense per-at-bat builder), checkpoints.js + tto.js +
// inningAndStarter.js (the pre-half strip's entering-tense builders), and
// heldNotes.js + rollup.js (the box-score roll-up's result-aware builders and
// its computeGameCalloutNotes entry point). This file is a thin re-export so
// no caller needs to change: see src/api/callout-notes/*.js for the actual
// code.

export {
  HIT_CATEGORY_KEYS,
  parseRecord,
  foldedRecordText,
  gameResult,
  magnitudeOf,
  corroborationBonus,
  CORROBORATION_BONUS,
  rankNotes,
} from './callout-notes/shared.js'

export { computeCalloutProgress } from './callout-notes/progress.js'

export { foulCountsFromCodes, buildCallouts, SCORING_FIRST_MIN_GAMES } from './callout-notes/liveAtBat.js'

export {
  cumulativeInnings,
  buildLeadReversalNote,
  buildAfterInningNote,
  buildScorelessThroughNote,
  buildBothScorelessNote,
  gameWeekday,
  weekdayFromDate,
  buildDayOfWeekNote,
} from './callout-notes/checkpoints.js'

export { buildThirdTimeThroughNote, buildTtoPitchesNote } from './callout-notes/tto.js'

export {
  buildLeadHeldNote,
  buildTiedAfterHeldNotes,
  buildScorelessHeldNotes,
  buildBothScorelessHeldNotes,
  buildDayOfWeekNotes,
  buildRunsScoredNote,
  buildRunsAllowedNote,
  buildComebackNote,
  buildCloseGameNotes,
} from './callout-notes/heldNotes.js'

export {
  INNING_DIFF_MIN_GAMES,
  buildInningRunDiffNote,
  buildStarterTeamRecordNote,
  buildFoulVolumeNote,
  buildStarterPitchPaceNote,
  buildBullpenThinNote,
} from './callout-notes/inningAndStarter.js'

export { computeGameCalloutNotes } from './callout-notes/rollup.js'
