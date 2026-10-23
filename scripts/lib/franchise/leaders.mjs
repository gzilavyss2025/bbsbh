// Pure half of scripts/franchise/gen-franchise-leaders.mjs (#2596): a club's career and
// single-season leaders from the Stats API's stats/leaders feed. A generator file runs on import
// (scripts/CLAUDE.md), so the testable part lives here. No clock: same input, same bytes.

// The 26 categories (15 hitting, 11 pitching), checked 2026-10-23 for team 158 to answer for both
// stat types. `strikeouts` is in both groups, so the pitching one is stored as `pitchingStrikeouts`
// (a key must be unique: `career.strikeouts` is the batter's, as the issue's names read).
export const CATEGORIES = [
  ...['gamesPlayed', 'atBats', 'runs', 'hits', 'doubles', 'triples', 'homeRuns', 'runsBattedIn', 'stolenBases', 'walks', 'battingAverage', 'onBasePercentage', 'sluggingPercentage', 'onBasePlusSlugging', 'strikeouts'].map((c) => ({ group: 'hitting', category: c, key: c })),
  ...['wins', 'losses', 'earnedRunAverage', 'gamesPitched', 'gamesStarted', 'saves', 'inningsPitched', 'strikeouts', 'shutouts', 'completeGames', 'walksAndHitsPerInningPitched'].map((c) => ({ group: 'pitching', category: c, key: c === 'strikeouts' ? 'pitchingStrikeouts' : c })),
]

export const STAT_TYPES = { career: 'career', season: 'statsSingleSeason' }

// stats/leaders `leagueLeaders` -> [{ rank, id, name, value, season? }], in the feed's order. The
// call returns ties at the cutoff, so a list can run past `limit`: keep what the feed gives.
// `value` stays the feed's own string (".298", "3.10", "1,234.2" as written), so a rate keeps its
// formatting. `season` is on single-season rows only.
export function leadersFrom(leagueLeaders) {
  const rows = leagueLeaders?.[0]?.leaders ?? []
  return rows.map((r) => ({
    rank: r.rank,
    id: r.person.id,
    name: r.person.fullName,
    value: String(r.value),
    ...(r.season ? { season: Number(r.season) } : {}),
  }))
}

// answers: [{ type: 'career'|'season', key, leagueLeaders }] for one club -> its shard.
export function buildClubLeaders({ teamId, through, answers }) {
  const out = { teamId, through, career: {}, season: {} }
  for (const a of answers) out[a.type][a.key] = leadersFrom(a.leagueLeaders)
  // Key order is the category order, so a re-run writes the same bytes whatever order calls finished in.
  for (const type of ['career', 'season']) {
    out[type] = Object.fromEntries(CATEGORIES.filter((c) => c.key in out[type]).map((c) => [c.key, out[type][c.key]]))
  }
  return out
}
