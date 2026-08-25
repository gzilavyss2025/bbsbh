// Shared rookie-status crossing-detection for gen-rookies.mjs (nightly) and
// gen-rookies-backfill.mjs (historical). Extracted from what used to be two
// independent copies so the same logic can't drift between them, and so it's
// unit-testable — a generator file is a top-level script (importing one RUNS
// it), so a helper worth testing lives here instead (see scripts/CLAUDE.md).
import { levelSeasonStat } from '../../src/api/person.js'
import { ipToOuts } from '../../src/api/rehab-policy.js'

export const ROOKIE_AB_LIMIT = 130
export const ROOKIE_IP_OUTS_LIMIT = 150 // 50 IP == 150 outs
export const LIMIT = { hitting: ROOKIE_AB_LIMIT, pitching: ROOKIE_IP_OUTS_LIMIT }

// The American and National Leagues — the only two a rookie limit is scored
// against. MLB's 2020 decision to grant the Negro Leagues (1920-1948)
// major-league status means statsapi now returns Negro League seasons under
// the SAME sport.id=1 as the AL/NL for any player who crossed over,
// interleaved in the same yearByYear/gameLog response with no other marker —
// so a walk over "his MLB stats" must filter to these two league ids, or it
// can count a pre-integration Negro League season toward an AL/NL rookie
// limit. Verified live: Pedro Dibut (personId 113334) crossed 50 IP in 1923
// pitching for the Cuban Stars West (Negro National League (I), league.id
// 430) — a full season before his real 1924-05-01 Reds/NL debut. Left
// unfiltered, that produced 35 players in rookies.json whose rookieUntil
// predates their debutDate.
const AL_NL_LEAGUE_IDS = new Set([103, 104])
export const isAlNlSplit = (split) => AL_NL_LEAGUE_IDS.has(split?.league?.id)

function statValue(group, agg) {
  if (!agg) return 0
  return group === 'pitching' ? ipToOuts(agg.inningsPitched) : Number(agg.atBats) || 0
}

// Walk one group's career, season by season, to find the season cumulative
// AB/outs first crosses the limit. Returns { crossingSeason, priorTotal }
// (priorTotal = cumulative total ENTERING the crossing season) or null if his
// whole career never crosses.
//
// Uses levelSeasonStat (not a raw aggregateSplits over the season's rows) —
// yearByYear can include a synthetic team-less row summing a same-season
// trade's per-team rows, and aggregateSplits doesn't recognize it as a
// duplicate, so summing every row double-counts the season. That inflation
// was pinning a false, too-early crossing season for anyone traded during his
// rookie window (verified live: Mauricio Dubón, traded mid-2019 — the
// inflated 2019 total falsely crossed 130 AB, but his real 2019 AB total was
// 106, so the game-log walk never confirmed it and his record stuck open
// forever instead of closing on his real crossing date).
export function findCrossingSeason(yearSplits, group) {
  const bySeason = new Map()
  for (const s of yearSplits) {
    if (!isAlNlSplit(s)) continue
    const yr = Number(s.season)
    if (!Number.isFinite(yr)) continue
    if (!bySeason.has(yr)) bySeason.set(yr, [])
    bySeason.get(yr).push(s)
  }
  const seasons = [...bySeason.keys()].sort((a, b) => a - b)
  let running = 0
  for (const yr of seasons) {
    const value = statValue(group, levelSeasonStat(bySeason.get(yr), group))
    if (running + value >= LIMIT[group]) return { crossingSeason: yr, priorTotal: running }
    running += value
  }
  return null
}

// Pin the exact date within the crossing season by walking that one season's
// game log (already sorted ascending by date) from priorTotal. Also filtered
// to AL/NL, for the rare case a player split games between a Negro League
// club and an AL/NL club within the same calendar year.
export function crossingDateFromGameLog(sortedGames, group, priorTotal) {
  let running = priorTotal
  for (const g of sortedGames) {
    if (!isAlNlSplit(g)) continue
    running += group === 'pitching' ? ipToOuts(g.stat?.inningsPitched) : Number(g.stat?.atBats) || 0
    if (running >= LIMIT[group]) return g.date
  }
  return null
}
