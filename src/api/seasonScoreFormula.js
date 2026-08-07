// Vs. expectation's home-field constant and team-specific home-field factor.
// Pulled out of scripts/gen-season-score.mjs (which imports node:fs and
// statsapi and can't be bundled for the browser) so the "How this is
// calculated" modal and the Vs. expectation breakdown can show the league
// constant next to a team's own factor without a second hardcoded literal
// that could drift from the generator's — same reasoning as
// src/api/teamScoreFormula.js's own split from gen-team-score.mjs.

// The league-average home-field win probability. Every team's own factor
// (below) is shrunk toward this, and it's the fallback when a team has no
// trailing-season split to read (e.g. an expansion team).
export const HOME_WIN_PROBABILITY = 0.54

// Team-specific home-field factor. Vs. Expectation's whole point is judging a
// team's actual record against an expectation set BEFORE the fact, so this
// reads only the TRAILING prior seasons' home/road standings splits (the same
// rows the Marcel baseline already reads .wins/.losses off — fetchPriorRecords
// needs no change) and is held fixed for the whole season, never updated from
// this season's own results. Using this season's own home/road split instead
// would let a team's own hot home streak lower its own bar mid-season — a
// different, worse failure mode than the strength-of-schedule/park-factor
// adjustments in teamScoreFormula.js risked, since those read an opponent's
// or a venue's record, never the judged team's own outcome.
//
// HOME_FIELD_PRIOR_GAMES is a calibrated product coefficient, not an
// empirical truth (same caveat as SOS_WINS_PER_POINT/VENUE_FACTOR_PRIOR_GAMES
// in teamScoreFormula.js). A single trailing season's home/road split carries
// roughly 4 points of binomial noise against the ~4-point league-average
// home-field signal itself (SE ~= sqrt(2*0.54*0.46/81)/2), so even a full
// 3-season trailing sample (~480 combined home+road decisions) should get
// only about half weight toward its own observed split.
export const HOME_FIELD_PRIOR_GAMES = 480
export const HOME_FIELD_FACTOR_MIN = 0.50
export const HOME_FIELD_FACTOR_MAX = 0.60

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

export function teamHomeFieldFactor(priorSeasonRecords) {
  let homeWins = 0, homeGames = 0, roadWins = 0, roadGames = 0
  for (const record of priorSeasonRecords ?? []) {
    if (!record) continue
    const home = (record.records?.splitRecords ?? []).find((s) => s.type === 'home')
    const road = (record.records?.splitRecords ?? []).find((s) => s.type === 'away')
    if (home) { homeWins += home.wins; homeGames += home.wins + home.losses }
    if (road) { roadWins += road.wins; roadGames += road.wins + road.losses }
  }
  if (!homeGames || !roadGames) return HOME_WIN_PROBABILITY
  const observed = 0.5 + (homeWins / homeGames - roadWins / roadGames) / 2
  const games = Math.min(homeGames, roadGames) * 2
  const weight = games / (games + HOME_FIELD_PRIOR_GAMES)
  const blended = HOME_WIN_PROBABILITY + weight * (observed - HOME_WIN_PROBABILITY)
  return clamp(blended, HOME_FIELD_FACTOR_MIN, HOME_FIELD_FACTOR_MAX)
}
