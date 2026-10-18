// How many games each level has on a date — the counts under the D1 masthead's
// level ladder (components/slatehead/LevelLadder.jsx).
//
// ONE call for all five levels. statsapi takes a comma list of sportIds, and
// with hydrate=team each game names its away club's sport, which is the level.
// Verified 2026-10-18 against 2026-07-22: MLB 17, AAA 16, AA 16, A+ 16, A 15.
//
// SPOILER-FREE BY ITS FIELD LIST. `fields=` keeps the gamePk and the away
// club's sport id and nothing else, so no score, status or linescore reaches
// the browser. A count says how many games are on, never how one went.
//
// The winter tab's count is not asked here: useWinter's calendar already holds
// each winter league's games by date (lib/winter/window.js).
import { LEVELS } from '../../lib/teams.js'
import { getJson } from '../statsapi.js'

const LEVEL_IDS = LEVELS.map((l) => l.sportId)
const FIELDS = 'dates,games,gamePk,teams,away,team,sport,id'

export function countGamesBySport(raw) {
  const out = Object.fromEntries(LEVEL_IDS.map((id) => [id, 0]))
  for (const day of raw?.dates ?? []) {
    for (const g of day.games ?? []) {
      const sport = g.teams?.away?.team?.sport?.id
      if (sport in out) out[sport] += 1
    }
  }
  return out
}

// Degrades to {} on any failure, so the ladder shows a dash for every level
// rather than an error (the MiLB fallback rule, root CLAUDE.md).
export async function fetchLevelCounts(dateStr) {
  try {
    const raw = await getJson(
      `/api/v1/schedule?sportId=${LEVEL_IDS.join(',')}&date=${dateStr}&hydrate=team&fields=${FIELDS}`,
      { retries: 0 },
    )
    return countGamesBySport(raw)
  } catch {
    return {}
  }
}
