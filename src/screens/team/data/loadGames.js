import { fetchTeam } from '../../../api/team.js'
import { fetchTeamSchedule, fetchAllStarGame } from '../../../api/schedule.js'
import { allDecidedGames, allStartedGames } from '../../../api/scheduleGames.js'
import { loadMoreTeamTransactions } from '../../../api/teamTransactions.js'
import { seasonOf, cutoffFor } from './shared.js'

// The Games tab's own data — the season schedule, every decided game so far,
// the All-Star game card, and the first transactions page. Fetch nothing else here:
// roster, WAR, prospects, uniforms, league stats, standings and odds all belong
// to other tabs.
//
// MiLB clubs play through the break (no All-Star card) and get no
// transactions card in phase 1 — both degrade to null/empty rather than
// fetching.

export async function loadGames(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const season = seasonOf(asOf)
  // The day BEFORE the game whose link carried `?d=`, so a dated page's
  // schedule never counts tonight's result early (see cutoffFor).
  const standingsDate = cutoffFor(asOf)

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

  // The games grid, oldest -> newest (the grid reverses it for display) — see
  // allDecidedGames'/recentDecidedGames' own headers for why this filters on
  // `won != null` rather than Final status. The whole season's decided games,
  // since this tab shows all of them rather than the Overview's last ten.
  // Also what the Highlights rail is handed, for the same reason — a clip's
  // title/description narrates a result.
  const seasonGames = allDecidedGames(schedule)
  // The Photos rail's own list — an explicit, narrower override than the one
  // above: on the CURRENT (undated) tab it includes a game still in progress
  // (allStartedGames, keyed on game state, never on `won`), same posture as
  // TeamPhotosPage. A dated view (`asOf` set) falls back to `seasonGames`
  // instead — the whole point of a `?d=` link is to freeze the page at that
  // date, and a live game newer than the cutoff but older than "now" would
  // break that freeze for exactly the surface built to honor it.
  const photoGames = asOf ? seasonGames : allStartedGames(schedule)

  return {
    team,
    schedule,
    allStarGame,
    seasonGames,
    photoGames,
    transactionsPage,
  }
}
