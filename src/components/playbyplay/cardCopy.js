// THE WORDS OF A NOTIFICATION CARD (ADR-0113, slice 2). Pure, so `npm test` can pin
// them. The tab names the event; the club is a logo at the card's right end, never text.

export const TABS = {
  batting: 'Now batting',
  pitching: 'Now pitching',
  reminder: 'Pitching',
  pinchRun: 'Pinch running',
  departing: 'Departing',
  final: 'Final line for',
  moundVisit: 'Mound visit',
  ejection: 'Ejection',
}

// The real scorer's shorthand for a baserunning/misc event with no plate
// appearance of its own — the same abbreviation a scorer pencils on paper,
// (the half report's `codeOf`, GamedayEngine.jsx).
//
// A pickoff is PK, not PO, and the tags here must keep matching the two places
// in api/playbyplay.js that write the same event onto a diamond —
// runnerOutCode's out notation ("PK 1-3", "PKCS 1-3") and interruptedCode's carry-over
// mark ("PK →"). Two spellings for one event on the same page reads as two
// different events, and "PO" is doubly wrong here: it's already this app's
// mark for a POP OUT (loadScorecard.js's classifyOut), besides being the
// scorebook's own abbreviation for a putout.
export const EVENT_CODES = {
  stolen_base_2b: 'SB', stolen_base_3b: 'SB', stolen_base_home: 'SB',
  caught_stealing_2b: 'CS', caught_stealing_3b: 'CS', caught_stealing_home: 'CS',
  pickoff_1b: 'PK', pickoff_2b: 'PK', pickoff_3b: 'PK',
  pickoff_caught_stealing_2b: 'PKCS', pickoff_caught_stealing_3b: 'PKCS', pickoff_caught_stealing_home: 'PKCS',
  wild_pitch: 'WP', passed_ball: 'PB', balk: 'BK',
  // Not observed as a standalone top-level play in either sampled game (both
  // always nested inside a real plate appearance) — included for the same
  // reason every other NON_PA-adjacent code above is, so IF one ever does
  // surface on its own, it gets this card's real shorthand instead of
  // EventNote's generic fallback icon.
  runner_placed: 'RP', defensive_indiff: 'DI',
}
