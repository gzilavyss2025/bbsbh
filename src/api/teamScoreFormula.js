// The Team Score formula — 60% actual wins blended with 40% Pythagorean
// "run-quality" wins, centered on .500 and damped for small samples. Pulled
// out of scripts/gen-team-score.mjs (which imports node:fs and can't be
// bundled for the browser) so the "How this is calculated" modal can compute
// the Current Form window's real ceiling/floor instead of hardcoding them.
export const MIN_GAMES = 10
export const CURRENT_FORM_GAMES = 10
export const PythagoreanExponent = 1.83

// Season Quality is a true-talent estimate, so it shrinks hard toward .500
// for a small sample (the "+9" prior is roughly 36 games' worth of pull).
const SEASON_PRIOR_GAMES = 9
const SEASON_TANH_SCALE = 2

// Current Form is a hot/cold-streak gauge over CURRENT_FORM_GAMES, not a
// talent estimate — a real short stretch is *supposed* to read as volatile,
// so it shrinks much less than the season formula.
export const CURRENT_FORM_PRIOR_GAMES = 2
export const CURRENT_FORM_TANH_SCALE = 1.4

// Late-innings swing nudge (Current Form only — see lateGameSwing.js for the
// per-game classification). A base credit/penalty for any blown lead or
// clutch win from the 8th inning on, plus a smaller per-run scale for how
// big the lead/deficit was, capped per game so one wild finish can't
// dominate and capped again in total so a whole window of them can't either.
export const LATE_SWING_BASE = 0.25
export const LATE_SWING_PER_RUN = 0.06
export const LATE_SWING_RUN_CAP = 4
export const LATE_SWING_TOTAL_CAP = 1.5

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const round1 = (n) => Math.round(n * 10) / 10

export function pythagoreanPct(runsScored, runsAllowed) {
  if (runsScored + runsAllowed <= 0) return 0.5
  const rs = runsScored ** PythagoreanExponent
  const ra = runsAllowed ** PythagoreanExponent
  return rs / (rs + ra)
}

export function qualityScoreFromGames({
  wins,
  games,
  runsScored,
  runsAllowed,
  priorGames = SEASON_PRIOR_GAMES,
  tanhScale = SEASON_TANH_SCALE,
  adjustment = 0,
}) {
  if (!games || games < MIN_GAMES) return null
  const pythagPct = pythagoreanPct(runsScored, runsAllowed)
  const pythagWins = games * pythagPct
  const weightedWins = 0.6 * wins + 0.4 * pythagWins
  const weightedWinsAbove500 = weightedWins - 0.5 * games + adjustment
  const effectiveZ = weightedWinsAbove500 / Math.sqrt(0.25 * games + priorGames)
  return {
    score: round1(clamp(5 + 4.5 * Math.tanh(effectiveZ / tanhScale), 0, 10)),
    pythagPct: round1(pythagPct * 100) / 100,
    pythagWins: round1(pythagWins),
    weightedWins: round1(weightedWins),
    weightedWinsAbove500: round1(weightedWinsAbove500),
  }
}

// Current Form's own entry point — bakes in the looser prior/tanh scale
// above so gen-team-score.mjs's precompute and TeamScoreCard's explainer
// ceiling/floor can't drift apart from using different constants.
// `lateSwingAdjustment` (see lateGameAdjustment below) is optional so the
// illustrative ceiling/floor anchors can keep calling this with plain
// win/run totals.
export function currentFormScoreFromGames({ lateSwingAdjustment = 0, ...gameStats }) {
  return qualityScoreFromGames({
    ...gameStats,
    priorGames: CURRENT_FORM_PRIOR_GAMES,
    tanhScale: CURRENT_FORM_TANH_SCALE,
    adjustment: lateSwingAdjustment,
  })
}

// Sums each game's late-innings swing (see lateGameSwing.js's
// classifyLateGame — one of these per team per game, `blownLead`/
// `clutchWin` mutually exclusive) into one capped wins-equivalent nudge for
// the Current Form window.
export function lateGameAdjustment(games) {
  const raw = games.reduce((sum, g) => {
    if (g.blownLead) return sum - (LATE_SWING_BASE + LATE_SWING_PER_RUN * Math.min(g.blownLeadRuns, LATE_SWING_RUN_CAP))
    if (g.clutchWin) return sum + (LATE_SWING_BASE + LATE_SWING_PER_RUN * Math.min(g.clutchWinRuns, LATE_SWING_RUN_CAP))
    return sum
  }, 0)
  return clamp(raw, -LATE_SWING_TOTAL_CAP, LATE_SWING_TOTAL_CAP)
}
