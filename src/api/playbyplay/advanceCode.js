// Runner-leg advance/out notation: how a runner (not the batter) ADVANCED to
// a base on a given play (BB/GO/2B/SB/WP…) or was RETIRED on the bases
// (CS/PK/DP/FC + fielding chain), plus battingSlot (which lineup slot gets
// credit for driving a runner over) and the "at-bat not completed" carry-over
// marker. See ../playbyplay.js's header for the module's overall spoiler
// footing. Split (ADR-0038, check-file-size.mjs) out of src/api/playbyplay.js.

// Short code for how a runner ADVANCED to a base on a given play — written by
// the base he moved up to, scorebook-style (BB forced him over, GO/FO moved
// him up on an out, 1B/2B on the hit that drove him, SB stole, WP/PB/BK, etc).
const ADVANCE_CODES = {
  single: '1B', double: '2B', triple: '3B', home_run: 'HR',
  walk: 'BB', intent_walk: 'IBB', hit_by_pitch: 'HBP',
  sac_fly: 'SF', sac_bunt: 'SAC',
  stolen_base_2b: 'SB', stolen_base_3b: 'SB', stolen_base_home: 'SB',
  wild_pitch: 'WP', passed_ball: 'PB', balk: 'BK',
  // A bases-loaded balk — the one that forces a run in — is its own
  // runner-level eventType, NOT the plain `balk` above (found in a July 2026
  // sweep of the MLB slate). It's a balk on the scoresheet either way; without
  // this key the leg fell through to advanceCode's ground-out "GO".
  forced_balk: 'BK',
  field_error: 'E', error: 'E', fielders_choice: 'FC', fielders_choice_out: 'FC',
  // Verified against gamePk 777747's bottom of the 10th (Brice Turang
  // 1B->2B during Jackson Chourio's walk): without this entry,
  // legAdvanceCode fell back to the enclosing play's own result type
  // ('walk'), mislabeling the advance "BB" as if Chourio's own plate
  // appearance had driven it.
  defensive_indiff: 'DI',
  // Same REACH_CODES entry (scorebookCode) already uses for the batter's
  // OWN reach-on-CI — without this, a runner forced up by someone else's
  // catcher's-interference call fell all the way through advanceCode's
  // fallback to the generic ground-out "GO", mislabeling the leg (verified
  // live: Michael Harris II to 2nd on Mauricio Dubón's catcher interference
  // showed "GO5" — a ground-out code for a play that was neither a ground
  // ball nor an out).
  catcher_interf: 'CI',
}

function advanceCode(play) {
  const et = play.result?.eventType
  if (ADVANCE_CODES[et]) return ADVANCE_CODES[et]
  if (/(flies|fly ball|pops|lines|line drive|sacrifice fly)/i.test(play.result?.description ?? '')) return 'FO'
  // Two rare runner-level eventTypes ('other_out' — advancing on an uncaught
  // third strike whose recovery throw goes elsewhere; 'caught_stealing_3b' —
  // a trail runner taking a base while the lead man is thrown out) still
  // land here and read as this ground-out fallback, which is wrong (no ball
  // was put in play). Left as a documented gap rather than a guessed code —
  // see docs/unresolved-scoring-conventions.md.
  return 'GO'
}

// A runner's leg-advance code, preferring the position-specific error code
// (E8, E5…) straight off THIS movement's own error credit — a plain "E" (the
// ADVANCE_CODES/advanceCode fallback) doesn't say who bobbled it, and the
// runner-level eventType the feed uses for an error-driven advance ("error")
// doesn't match ADVANCE_CODES' "field_error" key (that one's the BATTER's own
// reach-on-error, from scorebookCode) — verified against gamePk 823036's top
// 2nd (Bauers 2nd->3rd on a CF fielding error).
export function legAdvanceCode(play, r) {
  const errCred = (r.credits ?? []).find((c) => /error/.test(c.credit ?? ''))
  if (errCred) return `E${errCred.position?.code ?? ''}`
  const rEt = r.details?.eventType
  if (rEt && ADVANCE_CODES[rEt]) return ADVANCE_CODES[rEt]
  return advanceCode(play)
}

// The scorer's mark penciled above an INTERRUPTED at-bat's diamond: the
// shorthand for the baserunning event that ended the half plus the
// carry-over arrow ("CS →", "PK →") — the paper-scorebook convention of
// pointing at the next inning's column, where this batter's at-bat restarts
// from scratch. Tags mirror runnerOutCode's (CS/PK/…) so the interrupted
// card and the caught runner's own out notation can't drift apart.
export function interruptedCode(eventType) {
  const et = eventType ?? ''
  let tag = ''
  if (et.startsWith('caught_stealing')) tag = 'CS'
  else if (et.startsWith('pickoff')) tag = 'PK' // includes pickoff_caught_stealing
  else if (et.startsWith('stolen_base')) tag = 'SB'
  else if (et === 'wild_pitch') tag = 'WP'
  else if (et === 'passed_ball') tag = 'PB'
  else if (et === 'balk') tag = 'BK'
  return tag ? `${tag} →` : '→'
}

// The base a batter's OWN reach code (scorebookCode's REACH_CODES) already
// implies he's on — so his diamond only needs a FURTHER leg notation when he
// advances past it on the SAME play (e.g. a single plus a fielding error that
// lets him take an extra 90 feet), never for the base his own hit already
// names (a double's "2B" up top already explains 2nd; it doesn't also need
// "2B" penciled at the base itself).
export const NATURAL_BASE = {
  single: 1, double: 2, triple: 3, home_run: 4,
  walk: 1, intent_walk: 1, hit_by_pitch: 1,
  fielders_choice: 1, fielders_choice_out: 1, catcher_interf: 1, field_error: 1,
  force_out: 1,
}

// The fielder charged with an error anywhere on this play (Error position,
// scorebook-style E-code) — used to attribute a BATTER's own bonus base to
// the same misplay even when the feed's error credit landed on a different
// runner's movement entry than his (see gamePk 823036: the CF's fielding
// error credit sits on the trailing runner's leg, not the batter's own
// 1st->2nd leg, even though the same misplay is what let the batter move up
// too). Prefers whichever error is charged to the SAME fielder who fielded
// the batted ball (`f_fielded_ball`, recorded on the batter's own leg) —
// that's the fielder whose misplay actually let the batter advance — so a
// play with two DISTINCT errors (one enabling the batter's own extra base,
// a separate one advancing an unrelated runner) doesn't misattribute the
// batter's leg to whichever error happens to appear first in the feed. Falls
// back to the first error found when there's no fielded-ball credit to
// match against. Null when the play carries no error at all — its usual case.
export function playErrorCredit(play) {
  let fielderCode = null
  const errorCodes = []
  for (const r of play.runners ?? []) {
    for (const c of r.credits ?? []) {
      if (c.credit === 'f_fielded_ball' && fielderCode == null) fielderCode = c.position?.code ?? ''
      if (/error/.test(c.credit ?? '')) errorCodes.push(c.position?.code ?? '')
    }
  }
  if (!errorCodes.length) return null
  const matched = fielderCode != null ? errorCodes.find((code) => code === fielderCode) : undefined
  return `E${matched ?? errorCodes[0]}`
}

// The lineup slot (1-9) a player bats in, from his boxscore battingOrder —
// starters are exact multiples of 100 (500 → 5), subs are offset (503 → 5).
// Used to credit which hitter drove a runner over, and by the Scorecard Lab's
// full-reveal grid to place each plate appearance on its batting-order row.
export function battingSlot(feed, side, id) {
  const order = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`]?.battingOrder
  const n = parseInt(order, 10)
  return Number.isFinite(n) ? Math.floor(n / 100) : null
}

// How a runner (not the batter) was retired on the bases, for the notation by
// the base where his path is capped: "CS 2-4" caught stealing, "PK 3-6" pickoff,
// "DP 4-6" a runner erased on the batter's double play, "FC 6" a runner forced
// out or retired on a fielder's choice (the batter put the ball in play and the
// defense chose this runner), else the bare fielding chain (6-4, 4-6…).
//
// The kind of out is read from the RUNNER's own event, not `play.result` — a
// caught stealing / pickoff shows up as a runners[] entry INSIDE whatever
// batter's plate appearance it happened during, so the play's own result is
// that batter's (a strikeout, a groundout), not the baserunning out. (For a
// rare top-level CS/PK play with no batter, fall back to the play result.)
// Runner-event types where the batter put the ball in play and the defense
// elected to retire this runner. A runner erased on the batter's double play
// gets "DP"; a bare force out or a true fielder's choice gets "FC".
const DOUBLE_PLAY_EVENTS = new Set(['grounded_into_double_play', 'double_play'])
const FORCED_OUT_EVENTS = new Set([
  'force_out',
  'fielders_choice',
  'fielders_choice_out',
])

export function runnerOutCode(play, runnerEntry) {
  const et = runnerEntry.details?.eventType ?? play.result?.eventType ?? ''
  // Exact-matched, not a substring test: the feed also tags an outfielder's
  // assist with a SECOND credit, `f_assist_of` (for outfield-assist totals),
  // on the very same throw as his `f_assist` — a substring match on "assist"
  // catches both and doubles that fielder up in the chain (verified against
  // gamePk 817477's bottom 2nd, Cameron Sisneros out at 2nd on the throw:
  // right fielder 9 credited f_assist AND f_assist_of for the one throw to
  // short, which rendered "9-9-6" instead of "9-6").
  const chain = (runnerEntry.credits ?? [])
    .filter((c) => c.credit === 'f_putout' || c.credit === 'f_assist')
    .map((c) => c.position?.code ?? '')
    .join('-')
  let tag = ''
  if (et.startsWith('caught_stealing')) tag = 'CS'
  else if (et.startsWith('pickoff')) tag = 'PK' // includes pickoff_caught_stealing
  else if (DOUBLE_PLAY_EVENTS.has(et)) tag = 'DP'
  // Verified against gamePk 778442's top of the 2nd (Jacob Wilson grounds
  // into a 5-4-3 triple play): each of the two runners retired beyond the
  // batter carries this eventType on their own runners[] entry.
  else if (et === 'triple_play') tag = 'TP'
  else if (FORCED_OUT_EVENTS.has(et)) tag = 'FC'
  if (tag) return chain ? `${tag} ${chain}` : tag
  return chain || 'OUT'
}
