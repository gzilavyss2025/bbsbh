// The scorecard's pure NOTATION rules — what a plate appearance is called on
// the sheet, independent of any game. Three pieces, all of them functions of
// a string: which event types are a plate appearance but not an at-bat, what
// KIND of out a description names, and what the diamond's center chip may
// hold. Split out of scorecardGame.js at the 600-line file cap (ADR-0038);
// that module keeps the grid, the clamp and the sheet's readings.
//
// SPOILER CLASSIFICATION: spoiler-free. Nothing here touches a feed, a
// linescore or a reveal mark — every input is an eventType, a description
// sentence or an already-derived scorebook code.

// Event types that are a plate appearance but NOT an official at-bat, so the
// per-row AB tally excludes them (a walk, HBP, sacrifice, catcher's interference).
export const NON_AB_EVENTS = new Set([
  'walk',
  'intent_walk',
  'hit_by_pitch',
  'sac_fly',
  // A sac fly that also turns a double play (a second runner retired on the
  // same play) is still excluded from at-bats by rule (9.02(a)(1)/9.08(d)) —
  // classifyOut and playbyplay.js's SAC_FLY_EVENTS already mark the batter's
  // own trip as the sacrifice, so this must agree or he's charged both a
  // sacrifice AND an at-bat for one plate appearance.
  'sac_fly_double_play',
  'sac_bunt',
  // sac_bunt_double_play is deliberately NOT listed here — unlike the fly
  // ball case, a sacrifice bunt is not credited at all when a runner is
  // retired advancing on it, so whether this is an at-bat depends on how MLB
  // actually scored it, which this eventType name doesn't say on its own.
  // See docs/unresolved-scoring-conventions.md.
  'catcher_interf',
])

// The KIND of out for the box's top-left corner (GO groundout, FO flyout, LO
// lineout, PO popout, SO strikeout, DP double play, FC fielder's choice, SAC
// sacrifice) — read off the result description the same way scorebookCode reads
// the fielder chain, so the two agree. '' when it's an out we can't classify;
// the fielder chain still shows in the diamond center. Only meaningful for outs.
export function classifyOut(eventType, desc = '') {
  if (eventType === 'strikeout' || eventType === 'strikeout_double_play') return 'SO'
  // Sacrifices first, so a sac fly/bunt that also turned a double play is still
  // marked as the sacrifice it was for the batter (matches scorebookCode's SF/SAC).
  if (eventType === 'sac_fly' || eventType === 'sac_fly_double_play' || /sacrifice fly/i.test(desc)) return 'SF'
  if (eventType === 'sac_bunt' || eventType === 'sac_bunt_double_play' || /sacrifice (bunt|hit)/i.test(desc)) return 'SAC'
  if (/double play|grounded into/i.test(desc)) return 'DP'
  if (/lines? (out|into)/i.test(desc)) return 'LO'
  if (/pops? (out|into)/i.test(desc)) return 'PO'
  if (/flies? (out|into)/i.test(desc)) return 'FO'
  if (/grounds? (out|into)|grounded/i.test(desc)) return 'GO'
  if (/force(d)? out|fielder'?s choice/i.test(desc)) return 'FC'
  if (/sac(rifice)? bunt|bunt/i.test(desc)) return 'SAC'
  return ''
}

// What the scorecard sheet pencils in the DIAMOND CENTER, given a card's
// scorebook `code`. The play-by-play surface can break a code across lines —
// a GIDP reads "GIDP" over its relay chain (see scorebookCode) — but the
// sheet's center is a single-line chip (.sc-ab__center is `white-space:
// nowrap`) inside a 90px box, so a multi-line code arrives there as one
// unwrapped run that overhangs the box. Take the fielding chain alone: the
// box's top-left corner already carries the play KIND ("DP", via classifyOut),
// which is exactly how the paper sheet splits the two.
export function scorecardCenterCode(code) {
  return (code ?? '').split('\n').pop()
}
