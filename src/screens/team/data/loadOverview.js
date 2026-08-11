import { fetchTeam, fetchTeamRoster, fetchTeamIL, fetchStandings } from '../../../api/team.js'
import { fetchManager } from '../../../api/game.js'
import { fetchTeamSchedule, recentDecidedGames } from '../../../api/schedule.js'
import { fetchSeasonScores, leagueSurpriseScoresFor, seasonScoreFor } from '../../../api/seasonScore.js'
import { fetchTeamScores, teamScoreFor, leagueScoresFor, leagueSeasonGradesFor } from '../../../api/teamScore.js'
import { fetchPostseasonOdds, postseasonOddsFor } from '../../../api/postseasonOdds.js'
import { loadCombinedPoolForTeams } from '../../../api/statsLevels.js'
import { loadMoreTeamTransactions } from '../../../api/teamTransactions.js'
import {
  seasonOf,
  cutoffFor,
  scoreCutoffFor,
  standingsRowsFor,
  teamRecordFor,
  injuredIdsFrom,
  preferredLineupFrom,
  lineupDefenseFrom,
  fullPitchingLineFrom,
  topStartingPitchersFrom,
  closerFrom,
} from './shared.js'

// The Overview's own data — ONLY what its six previews need, and nothing a tab
// owns in full. A preview is a door, not a smaller duplicate, so this loader
// deliberately buys the cheap shape of each module and leaves the expensive one
// behind the tab it links to:
//
//   Standing       standings rows (three of them render)   -> Numbers
//   Form           the precomputed team/season score files  -> Numbers
//   Last 10        the season schedule, five stubs shown     -> Games
//   Lineup         the 40-man roster + IL: diamond, top 5 SP, the closer -> Roster
//   Leaders        the club's season stat pool, 3 categories -> Numbers
//   Latest moves   the first transactions page, 3 shown      -> Games
//
// What it deliberately does NOT fetch, and why the front door got fast: no
// per-pitcher game-log fan-out and no recent-form boxscore window (Roster), no
// photo walk-back or per-game uniform join (Games/Org), no league-wide team
// stats or comeback file (Numbers), no affiliate tree, complex clubs, org
// prospect roster fan-out or WAR/rookie badge files (Org/Roster).
//
// Unlike the other four tabs this does NOT sit alongside loadTeamIdentity: the
// Standing preview already needs the standings response, and re-fetching it just
// to shape the header's record line would be a second identical request. So this
// returns the same three identity fields TeamHubShell wants (team/record/manager)
// on top of its own body data, and TeamPage passes them straight through.
//
// MiLB degrades the way every loader here does: no precomputed scores, no
// transactions and no postseason odds exist below MLB, so those previews resolve
// to null/empty and simply don't render.

export async function loadOverview(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const isMilb = sportId !== 1
  const season = seasonOf(asOf)
  const cutoff = cutoffFor(asOf)
  const scoreCutoff = scoreCutoffFor(asOf)

  const [
    standings,
    manager,
    fullRoster,
    ilRoster,
    leaderPool,
    schedule,
    seasonScores,
    teamScores,
    postseasonOddsData,
    transactionsPage,
  ] = await Promise.all([
    team.league?.id ? fetchStandings(team.league.id, season, cutoff) : Promise.resolve([]),
    // Degrades to null on a thin MiLB feed (see fetchManager's own try/catch) —
    // the header line then hides.
    fetchManager(id, season),
    // 40Man rather than the active roster: the preferred lineup deliberately
    // keeps an injured regular, since a season's answer at a spot doesn't change
    // because he's hurt today (the diamond marks him instead).
    fetchTeamRoster(id, season, { sportId, rosterType: '40Man' }),
    fetchTeamIL(id, season),
    // The leaderboard pool is built from the club's season stats rather than its
    // current roster, so a player traded away or promoted off the club still
    // ranks, scoped to only his stats from while he was here.
    loadCombinedPoolForTeams([{ id }], season),
    // Cutoff-gated rows only — `won` stays null past `cutoff` (see
    // fetchTeamSchedule), which is what keeps the Last 10 stubs from showing a
    // result the visitor hasn't reached. Never re-derive it from Final status.
    fetchTeamSchedule(id, season, sportId, cutoff),
    isMilb ? Promise.resolve(null) : fetchSeasonScores(),
    isMilb ? Promise.resolve(null) : fetchTeamScores(),
    isMilb ? Promise.resolve(null) : fetchPostseasonOdds(),
    // MLB orgs only in phase 1 (see data-layer-scope.md). Just the first 45-day
    // page; the preview shows three of it and the Games tab pages further back.
    isMilb
      ? Promise.resolve({ days: [], cursor: null, hasMore: false })
      : loadMoreTeamTransactions(id, null, asOf).catch(() => ({ days: [], cursor: null, hasMore: false })),
  ])

  const standingsRows = standingsRowsFor(standings, team, id)
  // Postseason Odds — the whole division's snapshot, one row per team the
  // standings preview's own division lists, shown in a modal off the preview's
  // pill. A team with no snapshot yet (early season, or MiLB) drops out rather
  // than showing an all-dash row.
  const divisionPostseasonOdds = isMilb
    ? []
    : standingsRows
        .map((s) => ({ ...s, ...postseasonOddsFor(postseasonOddsData, s.id, season, scoreCutoff) }))
        .filter((r) => r.playoffPct != null)

  const injuredIds = injuredIdsFrom(ilRoster)

  // Starting Pitchers / Closer preview — the same season pitching line the
  // Roster tab's full staff sections use (fullPitchingLineFrom off the same
  // 40Man fullRoster already fetched above), just the top 5 by starts and the
  // saves leader, no per-pitcher game-log fan-out.
  const fullPitchers = fullPitchingLineFrom(fullRoster, id)
  const previewStartingPitchers = topStartingPitchersFrom(fullPitchers)
  const previewCloser = closerFrom(fullPitchers, new Set(previewStartingPitchers.map((p) => p.id)))

  return {
    team,
    season,
    sportId,
    isMilb,
    // Identity header (see the header comment on why this loader owns it).
    record: teamRecordFor(standings, team, id),
    manager,
    // Standing preview + its odds modal.
    standings: standingsRows,
    divisionPostseasonOdds,
    // Form preview.
    seasonScore: isMilb ? null : seasonScoreFor(seasonScores, id, season, scoreCutoff),
    teamScore: isMilb ? null : teamScoreFor(teamScores, id, season, scoreCutoff),
    leagueGradeScores: isMilb ? [] : leagueSeasonGradesFor(teamScores, seasonScores, season, scoreCutoff),
    leagueSeasonScores: isMilb ? [] : leagueScoresFor(teamScores, season, scoreCutoff, 'season'),
    leagueSurpriseScores: isMilb ? [] : leagueSurpriseScoresFor(seasonScores, season, scoreCutoff),
    leagueFormScores: isMilb ? [] : leagueScoresFor(teamScores, season, scoreCutoff, 'currentForm'),
    // Last 10 preview — the true last ten, which is both what the strip shows
    // and the W-L its header carries. Every game older than those is the Games
    // tab's grid, so the Overview never needs the full decided-game list.
    recentGames: recentDecidedGames(schedule),
    // Lineup preview.
    lineupDefense: lineupDefenseFrom(preferredLineupFrom(fullRoster, id), injuredIds),
    previewStartingPitchers,
    previewCloser,
    // Leaders preview.
    leaderPool,
    injuredIds,
    // Latest moves preview.
    transactionsPage,
  }
}
