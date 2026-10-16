import { fetchTeam } from '../../api/team.js'
import { seasonOf, cutoffFor, teamRecordFor } from './data/shared.js'
import { DIRECT } from './data/sources.js'

// The team page's shared header data — everything TeamHubShell draws above the
// jump bar, and NOTHING else.
//
// Every visit pays for this on top of the bands' own loaders, so it must stay cheap: three
// requests, no roster, no schedule, no per-player fan-out. If you are tempted to
// add a fetch here because two bands happen to want it, share it through data/sources.js
// instead.
//
// Degrades the way every MiLB-facing loader here does: a thin feed with no
// standings row yields `record: null` and the record line simply hides, and
// fetchManager already swallows its own failure and answers null.

// `src`: the shared reads (data/sources.js); the one-scroll page shares the standings.
export async function loadTeamIdentity(id, asOf, src = DIRECT) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const season = seasonOf(asOf, sportId)

  const [standings, manager] = await Promise.all([
    // Standings as of the morning of a dated page — the day BEFORE the game
    // whose link carried `?d=`, so a visitor mid-scoring never sees a record
    // that already counts tonight's result (see cutoffFor).
    team.league?.id
      ? src.fetchStandings(team.league.id, season, cutoffFor(asOf))
      : Promise.resolve([]),
    src.fetchManager(id, season),
  ])

  return {
    team,
    season,
    sportId,
    standings,
    record: teamRecordFor(standings, team, id),
    manager,
  }
}
