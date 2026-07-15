// The Team Score formula — 60% actual wins blended with 40% Pythagorean
// "run-quality" wins, centered on .500 and damped for small samples. Pulled
// out of scripts/gen-team-score.mjs (which imports node:fs and can't be
// bundled for the browser) so the "How this is calculated" modal can compute
// the Current Form window's real ceiling/floor instead of hardcoding them.
export const MIN_GAMES = 10
export const CURRENT_FORM_GAMES = 10
export const PythagoreanExponent = 1.83

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const round1 = (n) => Math.round(n * 10) / 10

export function pythagoreanPct(runsScored, runsAllowed) {
  if (runsScored + runsAllowed <= 0) return 0.5
  const rs = runsScored ** PythagoreanExponent
  const ra = runsAllowed ** PythagoreanExponent
  return rs / (rs + ra)
}

export function qualityScoreFromGames({ wins, games, runsScored, runsAllowed }) {
  if (!games || games < MIN_GAMES) return null
  const pythagPct = pythagoreanPct(runsScored, runsAllowed)
  const pythagWins = games * pythagPct
  const weightedWins = 0.6 * wins + 0.4 * pythagWins
  const weightedWinsAbove500 = weightedWins - 0.5 * games
  const effectiveZ = weightedWinsAbove500 / Math.sqrt(0.25 * games + 9)
  return {
    score: round1(clamp(5 + 4.5 * Math.tanh(effectiveZ / 2), 0, 10)),
    pythagPct: round1(pythagPct * 100) / 100,
    pythagWins: round1(pythagWins),
    weightedWins: round1(weightedWins),
    weightedWinsAbove500: round1(weightedWinsAbove500),
  }
}
