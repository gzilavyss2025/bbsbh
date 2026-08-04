import { fetchTeam } from '../../../api/team.js'
import { fetchTeamSchedule, fetchAllStarGame, recentDecidedGames, allDecidedGames } from '../../../api/schedule.js'
import { loadMoreTeamTransactions } from '../../../api/teamTransactions.js'

// The Games tab's own data — the season schedule, the last-ten strip, the
// All-Star game card, and the first transactions page. Copied out of
// TeamPage.jsx's loadTeam rather than shared with it (see
// .scratch/team-page-ia/PRD.md — issue 07 deletes loadTeam once nothing uses
// it, resolving the duplication then). Fetch nothing else here: roster, WAR,
// prospects, uniforms, league stats, standings and odds all belong to other
// tabs.
//
// MiLB clubs play through the break (no All-Star card) and get no
// transactions card in phase 1 — both degrade to null/empty rather than
// fetching.

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
// Same cutoff loadTeamIdentity.js uses: the day BEFORE the game whose link
// carried `?d=`, so a dated page's schedule never counts tonight's result
// early.
function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function loadGames(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const season = Number((asOf || isoToday()).slice(0, 4))
  const standingsDate = asOf ? dayBefore(asOf) : null

  const [schedule, allStarGame, transactionsPage] = await Promise.all([
    fetchTeamSchedule(id, season, sportId, standingsDate),
    // MLB only — MiLB clubs play through the break, so no All-Star card
    // belongs in their strip.
    sportId === 1 ? fetchAllStarGame(season) : Promise.resolve(null),
    // MLB only in phase 1 (see data-layer-scope.md) — a MiLB affiliate gets no
    // card. Just the first 45-day page; "Load more" pages further back on
    // demand from inside the card itself.
    sportId === 1
      ? loadMoreTeamTransactions(id, null, asOf).catch(() => ({ days: [], cursor: null, hasMore: false }))
      : Promise.resolve({ days: [], cursor: null, hasMore: false }),
  ])

  // Last 10 Games card, oldest -> newest — see recentDecidedGames' own header
  // for why this filters on `won != null` rather than Final status. The
  // header's W-L stays pinned to the true last 10 (recentGames); the strip
  // itself gets the FULL season's decided games so scrolling back keeps going
  // all the way to Opening Day instead of dead-ending at 10. `seasonGames` is
  // also what the Photos shelf is handed — never the raw schedule, since
  // `won` here is only ever non-null for a game at/before `asOf` (see
  // TeamPhotosRail's own header comment for why that matters).
  const recentGames = recentDecidedGames(schedule)
  const seasonGames = allDecidedGames(schedule)

  return {
    team,
    schedule,
    allStarGame,
    recentGames,
    seasonGames,
    transactionsPage,
  }
}
