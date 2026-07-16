// Shared run-expectancy (RE288) helpers — pure JS, no Node-only APIs, so this
// runs in BOTH scripts/gen-run-expectancy.mjs (builds the table from history),
// scripts/gen-umpire-accuracy.mjs (nightly season "favor" aggregate), and the
// live reveal-only box-score selector (src/api/umpireFavor.js). See
// .scratch/umpire-accuracy/consistency-favor-scope.md §2 for the full design.
//
// STATE MODEL: (baseMask 0–7, outs 0–2, balls 0–3, strikes 0–2) = 288 states.
// baseMask bit0=1B, bit1=2B, bit2=3B. RE(state) = mean runs scored from that
// exact pre-pitch state until the half-inning ends (inclusive of any runs the
// rest of that plate appearance itself drives in).

export const RE24_FALLBACK_MIN_N = 20 // below this many instances, use the
// base/out-only RE24 total (summed across all 4 counts) instead of a noisy
// per-count mean — same "don't trust a thin sample" guard as MIN_RANK_GAMES
// elsewhere in this codebase.

export function stateKey(baseMask, outs, balls, strikes) {
  return `${baseMask}-${outs}-${balls}-${strikes}`
}

export function re24Key(baseMask, outs) {
  return `${baseMask}-${outs}`
}

// A state with 3 outs has no more runs coming this half-inning by definition
// — never looked up in the table, always 0.
export function isTerminalOuts(outs) {
  return outs >= 3
}

// Force-advance runners on a walk/HBP (batter always takes 1B). A runner is
// forced only if every base behind him is occupied. Returns the new base
// mask and how many runs score immediately (bases loaded → 1, else 0) —
// the run that crosses the plate on the walk itself, which lookupRE's
// caller must add on top of RE(next state) since RE only counts runs AFTER
// the state it's evaluated at.
export function advanceOnWalk(baseMask) {
  const on1 = (baseMask & 1) !== 0
  const on2 = (baseMask & 2) !== 0
  const on3 = (baseMask & 4) !== 0
  if (!on1) return { baseMask: baseMask | 1, runsScored: 0 }
  if (!on2) return { baseMask: (baseMask | 1 | 2), runsScored: 0 } // 1B forced to 2B
  if (!on3) return { baseMask: (baseMask | 1 | 2 | 4), runsScored: 0 } // 1B->2B, 2B->3B
  return { baseMask, runsScored: 1 } // bases loaded — forced run, mask unchanged (all still occupied)
}

// The next pre-pitch state after one more ball, or the next batter's leadoff
// state if it's ball four (a walk — bases force-advance, count resets,
// outs/half unchanged). `immediateRuns` is 0 except a bases-loaded walk.
export function stateAfterBall(baseMask, outs, balls, strikes) {
  if (balls < 3) return { baseMask, outs, balls: balls + 1, strikes, immediateRuns: 0 }
  const { baseMask: nextMask, runsScored } = advanceOnWalk(baseMask)
  return { baseMask: nextMask, outs, balls: 0, strikes: 0, immediateRuns: runsScored }
}

// The next pre-pitch state after one more strike, or the next batter's
// leadoff state if it's strike three (a strikeout — bases unchanged, outs+1,
// count resets). Never scores a run itself.
export function stateAfterStrike(baseMask, outs, balls, strikes) {
  if (strikes < 2) return { baseMask, outs, balls, strikes: strikes + 1, immediateRuns: 0 }
  return { baseMask, outs: outs + 1, balls: 0, strikes: 0, immediateRuns: 0 }
}

// RE(state) from a built table, with the RE24 (base/out-only) fallback for
// thin per-count buckets, and 0 for a state with 3 outs (nothing more can
// score this half-inning). `table.states`/`table.re24` are plain
// { [key]: { sum, n } } maps as written by gen-run-expectancy.mjs.
export function lookupRE(table, baseMask, outs, balls, strikes) {
  if (isTerminalOuts(outs)) return 0
  const cell = table?.states?.[stateKey(baseMask, outs, balls, strikes)]
  if (cell && cell.n >= RE24_FALLBACK_MIN_N) return cell.sum / cell.n
  const fallback = table?.re24?.[re24Key(baseMask, outs)]
  if (fallback && fallback.n > 0) return fallback.sum / fallback.n
  return cell && cell.n > 0 ? cell.sum / cell.n : 0
}

// The full run-value swing of one missed call, in runs, SIGNED toward the
// batting team (positive = the miss helped the batter's side). `strikeCall`
// is what the umpire actually called; `actualStrike` is what the pitch
// geometrically was. Only ever called for pitches where they disagree (a
// miss) — see gen-umpire-accuracy.mjs's expanded/squeezed detection.
export function pitchFavor(table, baseMask, outs, balls, strikes, actualStrike) {
  // The "correct" outcome is whichever call actualStrike implies; the
  // "actual" outcome is the other one (that's what makes it a miss).
  const correct = actualStrike
    ? stateAfterStrike(baseMask, outs, balls, strikes)
    : stateAfterBall(baseMask, outs, balls, strikes)
  const actual = actualStrike
    ? stateAfterBall(baseMask, outs, balls, strikes) // squeezed: should've been a strike, called a ball
    : stateAfterStrike(baseMask, outs, balls, strikes) // expanded: should've been a ball, called a strike

  const correctValue =
    correct.immediateRuns + lookupRE(table, correct.baseMask, correct.outs, correct.balls, correct.strikes)
  const actualValue =
    actual.immediateRuns + lookupRE(table, actual.baseMask, actual.outs, actual.balls, actual.strikes)
  // actualValue MINUS correctValue, not the other way — this is the swing
  // FROM the batting team's perspective: actualValue is the run value of
  // what really happened to them, correctValue is what should have. A call
  // that hands them a gifted walk (actualValue high) instead of a correct
  // strikeout (correctValue low) is a swing IN their favor → positive. A
  // call that hands them a phantom strikeout (actualValue low) instead of a
  // correct walk (correctValue high) COSTS them → negative. (correctValue -
  // actualValue, the first version of this, had it backwards — verified by
  // hand: a blown ball-4-into-strikeout with bases loaded that robs the
  // batting team of a forced run read as "helped the batter.")
  return actualValue - correctValue
}
