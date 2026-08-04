import { fetchTeam, fetchStandings } from '../../api/team.js'
import { fetchManager } from '../../api/game.js'

// The team hub's shared header data — everything TeamHubShell draws above the
// tab bar, and NOTHING else.
//
// Every tab pays for this on top of its own loader, so it must stay cheap: three
// requests, no roster, no schedule, no per-player fan-out. If you are tempted to
// add a fetch here because two tabs happen to want it, put it in both tabs'
// loaders instead — the whole point of the tab split is that a visitor who wants
// one section doesn't pay for the other four (see .scratch/team-page-ia/PRD.md).
//
// Degrades the way every MiLB-facing loader here does: a thin feed with no
// standings row yields `record: null` and the record line simply hides, and
// fetchManager already swallows its own failure and answers null.

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
// Standings as of the morning of a dated page: the day BEFORE the game whose
// link carried `?d=`, so a visitor mid-scoring never sees a record that already
// counts tonight's result. Same cutoff loadTeam uses.
function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function loadTeamIdentity(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const season = Number((asOf || isoToday()).slice(0, 4))
  const standingsDate = asOf ? dayBefore(asOf) : null

  const [standings, manager] = await Promise.all([
    team.league?.id
      ? fetchStandings(team.league.id, season, standingsDate)
      : Promise.resolve([]),
    fetchManager(id, season),
  ])

  const div = standings.find((r) => r.division?.id === team.division?.id)
  const myRec = div?.teamRecords?.find((t) => t.team.id === id)

  return {
    team,
    season,
    sportId,
    record: myRec
      ? {
          wins: myRec.wins,
          losses: myRec.losses,
          rank: myRec.divisionRank,
          div: team.division?.name,
        }
      : null,
    manager,
  }
}
