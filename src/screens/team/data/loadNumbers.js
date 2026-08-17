import { fetchTeam, fetchStandings, fetchLeagueTeamStats, fetchTeamIL } from '../../../api/team.js'
import { fetchTeamSchedule } from '../../../api/schedule.js'
import { fetchComebackWins, comebackRatesFor } from '../../../api/comebackWins.js'
import { fetchTeamRecords } from '../../../api/teamRecords.js'
import { fetchPostseasonOdds, postseasonOddsFor } from '../../../api/postseasonOdds.js'
import { loadCombinedPoolForTeams } from '../../../api/statsLevels.js'
import { rankTeam, ordinal } from '../../../api/person.js'
import {
  fetchTeamUniformCatalog,
  fetchGameJerseys,
  fetchUniformNameOverrides,
  buildJerseyCombos,
} from '../../../api/uniforms.js'
import { teamClubName } from '../../../lib/teams.js'
import { dayOfWeekRecord } from '../modules/TeamStatsCard.jsx'
import { seasonOf, cutoffFor, scoreCutoffFor, standingsRowsFor, injuredIdsFrom } from './shared.js'

const DASH = '—'

// The Numbers tab's own data: standings, team batting/pitching ranks, the
// leaderboard pool, comeback-win rates, the day-of-week record, and jersey
// combos — see .scratch/team-page-ia/issues/05-numbers-tab.md.
//
// Fetches nothing else — no roster, 40-man, WAR, photos, prospects,
// affiliates or transactions. Those belong to the other tabs.

function statRank(rows, teamId, key, label, lowerBetter) {
  const mine = rows.find((r) => r.teamId === teamId)
  const r = rankTeam(rows, teamId, key, lowerBetter)
  const tone = r ? (r.rank <= 5 ? 'good' : r.rank >= 20 ? 'bad' : '') : ''
  const extreme = r ? (r.rank <= 5 ? 'best' : r.rank > r.of - 5 ? 'worst' : '') : ''
  return { k: label, v: mine?.stat?.[key] ?? DASH, rank: r ? ordinal(r.rank) : DASH, tone, extreme }
}

export async function loadNumbers(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const isMilb = sportId !== 1
  const season = seasonOf(asOf)
  const standingsDate = cutoffFor(asOf)
  const scoreCutoff = scoreCutoffFor(asOf)

  const [
    standings,
    league,
    leaderPool,
    postseasonOddsData,
    comebackWinsData,
    // The situational-records ledger — one static file per club per season,
    // every level. The card tallies it against `standingsDate` itself, so it
    // reads no further ahead than the standings and the day-of-week card.
    teamRecordsData,
    schedule,
    ilRoster,
    uniformCatalog,
    uniformNameOverrides,
  ] = await Promise.all([
    team.league?.id ? fetchStandings(team.league.id, season, standingsDate) : Promise.resolve([]),
    sportId === 1 ? fetchLeagueTeamStats(season) : Promise.resolve({ hitting: [], pitching: [] }),
    loadCombinedPoolForTeams([{ id }], season),
    sportId === 1 ? fetchPostseasonOdds() : Promise.resolve(null),
    sportId === 1 ? fetchComebackWins() : Promise.resolve(null),
    fetchTeamRecords(id, season),
    // Cutoff-gated rows only — `won` stays null past standingsDate (see
    // fetchTeamSchedule), which is what keeps the day-of-week record from
    // looking ahead. Don't re-derive it from Final status. Also feeds the
    // jersey-record join below (MLB only).
    fetchTeamSchedule(id, season, sportId, standingsDate),
    fetchTeamIL(id, season),
    isMilb ? Promise.resolve({}) : fetchTeamUniformCatalog([id], season),
    isMilb ? Promise.resolve({}) : fetchUniformNameOverrides(),
  ])

  const standingsRows = standingsRowsFor(standings, team, id)
  const divisionPostseasonOdds =
    sportId === 1
      ? standingsRows
          .map((s) => ({ ...s, ...postseasonOddsFor(postseasonOddsData, s.id, season, scoreCutoff) }))
          .filter((r) => r.playoffPct != null)
      : []

  const batting = league.hitting.length
    ? [
        statRank(league.hitting, id, 'runs', 'Runs', false),
        statRank(league.hitting, id, 'homeRuns', 'Home runs', false),
        statRank(league.hitting, id, 'avg', 'AVG', false),
        statRank(league.hitting, id, 'ops', 'OPS', false),
        statRank(league.hitting, id, 'stolenBases', 'Stolen bases', false),
        statRank(league.hitting, id, 'hits', 'Hits', false),
        statRank(league.hitting, id, 'groundIntoDoublePlay', 'GIDP', true),
        statRank(league.hitting, id, 'atBatsPerHomeRun', 'AB/HR', true),
        statRank(league.hitting, id, 'babip', 'BABIP', false),
      ]
    : null
  const pitching = league.pitching.length
    ? [
        statRank(league.pitching, id, 'era', 'ERA', true),
        statRank(league.pitching, id, 'whip', 'WHIP', true),
        statRank(league.pitching, id, 'strikeOuts', 'Strikeouts', false),
        statRank(league.pitching, id, 'saves', 'Saves', false),
        statRank(league.pitching, id, 'shutouts', 'Shutouts', false),
        statRank(league.pitching, id, 'completeGames', 'Complete games', false),
        statRank(league.pitching, id, 'avg', 'AVG against', true),
        statRank(league.pitching, id, 'strikeoutsPer9Inn', 'SO/9', false),
        statRank(league.pitching, id, 'walksPer9Inn', 'BB/9', true),
        statRank(league.pitching, id, 'strikeoutWalkRatio', 'K/BB', false),
        statRank(league.pitching, id, 'groundIntoDoublePlay', 'GDP', false),
        statRank(league.pitching, id, 'wildPitches', 'WP', true),
        statRank(league.pitching, id, 'pitchesPerInning', 'P/IP', true),
      ]
    : null

  const comebackData = comebackRatesFor(comebackWinsData, id, season)
  const comeback =
    comebackData && comebackData.thresholds.some((t) => t.wins > 0) ? comebackData : null

  const dayOfWeek = schedule.some((g) => g.won != null) ? dayOfWeekRecord(schedule) : null

  // Record-by-jersey strip (MLB only) — one card per catalog jersey, tagged
  // with its logo treatment and the club's W-L in the games it wore it. The
  // worn-jersey join needs the per-game uniform assignment, one extra batched
  // /uniforms/game call over just the games with a VISIBLE result (`won`
  // already cutoff-gated by fetchTeamSchedule above), so an `asOf` team page
  // never counts a game past its own spoiler cutoff. Skipped for a club with
  // no catalog (MiLB) — buildJerseyCombos then returns [].
  const decidedGames = schedule.filter((g) => g.won != null)
  const wornByGame =
    !isMilb && decidedGames.length ? await fetchGameJerseys(decidedGames.map((g) => g.gamePk)) : {}
  const jerseyCombos = isMilb
    ? []
    : buildJerseyCombos({
        catalogAssets: uniformCatalog[id] ?? [],
        clubName: teamClubName(id),
        schedule,
        wornByGame,
        teamId: id,
        nameOverrides: uniformNameOverrides,
      })

  // This club's own home/away split, off the standings row — feeds the
  // Home/Away jersey cards below (MiLB only; an MLB club's cards carry a
  // real per-jersey-worn record instead, from buildJerseyCombos above).
  const myStanding = standingsRows.find((s) => s.isMe)
  const homeRecord = myStanding?.homeRecord ?? { wins: 0, losses: 0 }
  const awayRecord = myStanding?.awayRecord ?? { wins: 0, losses: 0 }

  return {
    team,
    standings: standingsRows,
    divisionPostseasonOdds,
    batting,
    pitching,
    leaderPool,
    comeback,
    teamRecords: teamRecordsData,
    // The card tallies rows itself (it owns the pre/post-break lever), so the
    // cutoff travels with the data rather than being applied here.
    recordsCutoff: standingsDate,
    dayOfWeek,
    jerseyCombos,
    homeRecord,
    awayRecord,
    injuredIds: injuredIdsFrom(ilRoster),
  }
}
