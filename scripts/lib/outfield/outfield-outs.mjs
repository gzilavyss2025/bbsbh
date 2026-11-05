// The pure half of scripts/gen-outfield-outs.mjs (issue #2976): did a batting
// side make an out to an outfielder in a regular-season game?
//
// A generator file RUNS on import, so the classifier lives here to be testable
// (the scripts/lib convention; test/outfield-outs.test.js).
//
// THE RULES, each one decided and tested (decisions are recorded in the PR and
// in docs/scripts/generators.md):
//   - Only plate appearances count (PLATE_APPEARANCE_EVENT_TYPES, shared with
//     the long-at-bats census). A caught stealing or pickoff is typed
//     result.type 'atBat' too, but it is a runner out, not a batted-ball out.
//   - The fielder of a batted ball is the FIRST credit on the BATTER's own
//     runner entry (`details.runner.id === matchup.batter.id`). A ball deflected
//     by an infielder and caught by an outfielder is therefore the infielder's.
//     A runner thrown out by an outfielder sits on another runner's entry and is
//     ignored. If the batter's entry carries no credit, the fielder falls back to
//     `hitData.location` on the last playEvent that has hitData.
//   - A field_error by an outfielder is neither an out nor an OF hit. The batter
//     reached base on the error, and the team made no out to the OF.
//   - A home run is allowed. It is not an OF out, and it is not counted as an OF
//     hit either (ofHits counts singles, doubles and triples only). Its fielder
//     is outside the coverage denominator, since no out can hide in it.
//   - Strikeouts, walks, hit-by-pitch and interference are not balls in play.

import { PLATE_APPEARANCE_EVENT_TYPES } from '../long-at-bats.mjs'

// Share of balls in play that must name a fielder before a team-game is trusted.
// Set at 0.9 as the issue asks. The guard is tuned against the 41 qualifiers and
// the sparse feed 823812 in the PR, not guessed.
export const COVERAGE_MIN = 0.9

const HITS = new Set(['single', 'double', 'triple'])
const HOME_RUN = 'home_run'
const OUTFIELD = new Set(['7', '8', '9'])

// Balls in play that end in an out, a hit, or a reach on an error. Anything
// not listed here (strikeouts, walks, HBP, interference, home runs) is not a
// batted ball the coverage guard should count.
const BALLS_IN_PLAY = new Set([
  'single', 'double', 'triple',
  'field_out', 'force_out', 'fielders_choice', 'fielders_choice_out', 'field_error',
  'double_play', 'triple_play', 'grounded_into_double_play', 'grounded_into_triple_play',
  'sac_fly', 'sac_fly_double_play', 'sac_bunt', 'sac_bunt_double_play',
])

// True when the feed holds at least one plate appearance. A game the schedule
// marks Final but whose playByPlay is empty (632457, 746577, 823490) fails this,
// and the generator skips it so neither team counts as a qualifier.
export function gameIsScorable(plays) {
  return (plays ?? []).some(
    (p) => p?.result?.type === 'atBat' && PLATE_APPEARANCE_EVENT_TYPES.has(p.result.eventType),
  )
}

// Share-based guard. A team-game with no balls in play passes (nothing to miss).
export function coverageOk({ balls, fielded }) {
  if (!balls) return true
  return fielded / balls >= COVERAGE_MIN
}

function batterEntry(play) {
  const batter = play?.matchup?.batter?.id
  if (batter == null) return null
  return (play.runners ?? []).find((r) => r?.details?.runner?.id === batter) ?? null
}

// The fielder's position code ('1'..'9') for a batted ball, or null.
function fielderOf(play) {
  const credit = batterEntry(play)?.credits?.[0]
  if (credit?.position?.code) return String(credit.position.code)
  const withHit = (play.playEvents ?? []).filter((e) => e?.hitData?.location != null)
  const last = withHit[withHit.length - 1]
  return last ? String(last.hitData.location) : null
}

// One batting side's outfield tally for one game.
//   plays: the game's allPlays (trimmed or full)
//   half:  'top' (away side bats) or 'bottom' (home side bats)
// Returns { ofOuts, ofHits, plateAppearances, coverage: { balls, fielded } }.
export function outfieldOutsFor(plays, half) {
  const out = { ofOuts: 0, ofHits: 0, plateAppearances: 0, coverage: { balls: 0, fielded: 0 } }
  for (const play of plays ?? []) {
    if (play?.result?.type !== 'atBat') continue
    if (play?.about?.halfInning !== half) continue
    const event = play.result.eventType
    if (!PLATE_APPEARANCE_EVENT_TYPES.has(event)) continue
    out.plateAppearances += 1
    if (event === HOME_RUN) continue

    if (!BALLS_IN_PLAY.has(event)) continue
    const fielder = fielderOf(play)
    out.coverage.balls += 1
    if (fielder != null) out.coverage.fielded += 1
    if (fielder == null || !OUTFIELD.has(fielder)) continue

    if (HITS.has(event)) out.ofHits += 1
    else if (event !== 'field_error') out.ofOuts += 1
  }
  return out
}
