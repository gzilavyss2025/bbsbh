import { fetchTeam, fetchStandings } from '../../api/team.js'
import { fetchManager } from '../../api/game.js'
import { seasonOf, cutoffFor, teamRecordFor } from './data/shared.js'

// The team hub's shared header data — everything TeamHubShell draws above the
// tab bar, and NOTHING else.
//
// Every tab pays for this on top of its own loader, so it must stay cheap: three
// requests, no roster, no schedule, no per-player fan-out. If you are tempted to
// add a fetch here because two tabs happen to want it, put it in both tabs'
// loaders instead — the whole point of the tab split is that a visitor who wants
// one section doesn't pay for the other four (see .scratch/team-page-ia/PRD.md).
//
// The Overview is the one tab that does NOT call this: its Standing preview
// already needs the standings response, so it shapes the header's three fields
// off that same fetch rather than paying for a second identical request (see
// data/loadOverview.js). The shaping itself is shared, so the two can't drift.
//
// Degrades the way every MiLB-facing loader here does: a thin feed with no
// standings row yields `record: null` and the record line simply hides, and
// fetchManager already swallows its own failure and answers null.

export async function loadTeamIdentity(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const season = seasonOf(asOf)

  const [standings, manager] = await Promise.all([
    // Standings as of the morning of a dated page — the day BEFORE the game
    // whose link carried `?d=`, so a visitor mid-scoring never sees a record
    // that already counts tonight's result (see cutoffFor).
    team.league?.id
      ? fetchStandings(team.league.id, season, cutoffFor(asOf))
      : Promise.resolve([]),
    fetchManager(id, season),
  ])

  return {
    team,
    season,
    sportId,
    record: teamRecordFor(standings, team, id),
    manager,
  }
}
