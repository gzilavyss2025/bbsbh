import { fetchTeam, fetchLeagueTeamStats } from '../../../api/team.js'
import { fetchComebackWins, comebackRatesFor } from '../../../api/comebackWins.js'
import { fetchTeamRecords } from '../../../api/teamRecords.js'
import { fetchScheduleShape } from '../../../api/scheduleShape.js'
import { fetchPostseasonOdds, postseasonOddsFor } from '../../../api/postseasonOdds.js'
import { fetchRunValue, clubRunValue, clubBoard } from '../../../api/around-the-game/runValue.js'
import {
  exposureClubLevelFor,
  fetchAbsExposureClubs,
} from '../../../api/around-the-game/absExposure.js'
import { loadCombinedPoolForTeams } from '../../../api/statsLevels.js'
import { rankTeam, rankText } from '../../../api/person.js'
import {
  fetchTeamUniformCatalog,
  fetchGameJerseys,
  fetchUniformNameOverrides,
  buildJerseyCombos,
} from '../../../api/uniforms.js'
import { teamClubName } from '../../../lib/teams.js'
import { seasonOf, cutoffFor, scoreCutoffFor, standingsRowsFor, injuredIdsFrom, ledgerIsComplete, dayOfWeekRecord } from './shared.js'
import { DIRECT } from './sources.js'

const DASH = '—'

// The Standings, Ranks and About (jerseys) bands' data: standings, team batting/pitching
// ranks, the leaderboard pool, comeback-win rates, the day-of-week record, the club's
// season run value, and jersey combos.
//
// Fetches nothing else — no roster, 40-man, WAR, photos, prospects,
// affiliates or transactions. Those belong to the other bands.

function statRank(rows, teamId, key, label, lowerBetter) {
  const mine = rows.find((r) => r.teamId === teamId)
  const r = rankTeam(rows, teamId, key, lowerBetter)
  const tone = r ? (r.rank <= 5 ? 'good' : r.rank >= 20 ? 'bad' : '') : ''
  const extreme = r ? (r.rank <= 5 ? 'best' : r.rank > r.of - 5 ? 'worst' : '') : ''
  return { k: label, v: mine?.stat?.[key] ?? DASH, rank: r ? rankText(r.rank) : DASH, tone, extreme }
}

// Each band of the one-scroll page (#1107) buys only its own share: Standings (the
// standings, the record cards) and Ranks (the rank tables, the leaders, the run value and the
// challenge card); About buys the jerseys. Each takes a `src` (sources.js; the page passes SHARED).

// An affiliate wears one jersey at home and one away: its record in each is the standings split.
const homeAway = (rows) => {
  const mine = rows.find((s) => s.isMe)
  return { jerseyCombos: [], homeRecord: mine?.homeRecord ?? { wins: 0, losses: 0 }, awayRecord: mine?.awayRecord ?? { wins: 0, losses: 0 } }
}

// The jersey strip's data (MLB: record by jersey; MiLB: the home and away splits). It sits
// in the About band on the one-scroll page and on the Numbers tab, so it is its own load
// (ADR-0082, #1107 row 6f). It moves with `?d=`: the schedule it reads gives `won` only to
// a game on or before the cutoff, and the worn-jersey join below asks about those games
// alone, so a jersey W-L never counts the game being scored. A record by jersey is a sum
// of results; at `?d=` it must agree with the Standings record beside it.
export async function loadJerseys(team, asOf, src = DIRECT) {
  const id = team.id
  const sportId = team.sport?.id ?? 1
  const isMilb = sportId !== 1
  const season = seasonOf(asOf, sportId)
  const standingsDate = cutoffFor(asOf)
  if (isMilb) {
    const rows = team.league?.id ? await src.fetchStandings(team.league.id, season, standingsDate) : []
    return homeAway(standingsRowsFor(rows, team, id))
  }
  const [schedule, uniformCatalog, uniformNameOverrides] = await Promise.all([
    src.fetchTeamSchedule(id, season, sportId, standingsDate),
    fetchTeamUniformCatalog([id], season),
    fetchUniformNameOverrides(),
  ])
  const decided = schedule.filter((g) => g.won != null)
  const wornByGame = decided.length ? await fetchGameJerseys(decided.map((g) => g.gamePk)) : {}
  return {
    jerseyCombos: buildJerseyCombos({
      catalogAssets: uniformCatalog[id] ?? [],
      clubName: teamClubName(id),
      schedule,
      wornByGame,
      teamId: id,
      nameOverrides: uniformNameOverrides,
    }),
    homeRecord: null,
    awayRecord: null,
  }
}

async function numbersScope(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const standingsDate = cutoffFor(asOf)
  return { team, sportId, isMilb: sportId !== 1, season: seasonOf(asOf, sportId), standingsDate, scoreCutoff: scoreCutoffFor(asOf) }
}

export async function loadStandings(id, asOf, src = DIRECT) {
  const scope = await numbersScope(id, asOf)
  if (!scope) return null
  const { team, sportId, season, standingsDate, scoreCutoff } = scope

  const [
    standings,
    postseasonOddsData,
    comebackWinsData,
    // The situational-records ledger — one static file per club per season,
    // every level. The card tallies it against `standingsDate` itself, so it
    // reads no further ahead than the standings and the day-of-week card.
    teamRecordsData,
    // The decade-deep schedule-shape ledger behind the Last Time card. MLB
    // only — gen-schedule-shape.mjs sweeps sportId 1, so an affiliate has no
    // shard and the card simply doesn't render.
    scheduleShapeData,
    schedule,
  ] = await Promise.all([
    team.league?.id ? src.fetchStandings(team.league.id, season, standingsDate) : Promise.resolve([]),
    sportId === 1 ? fetchPostseasonOdds() : Promise.resolve(null),
    sportId === 1 ? fetchComebackWins() : Promise.resolve(null),
    fetchTeamRecords(id, season),
    sportId === 1 ? fetchScheduleShape(id) : Promise.resolve(null),
    // Cutoff-gated rows only — `won` stays null past standingsDate (see
    // fetchTeamSchedule), which is what keeps the day-of-week record from
    // looking ahead. Don't re-derive it from Final status. Also feeds the
    // jersey-record join below (MLB only).
    src.fetchTeamSchedule(id, season, sportId, standingsDate),
  ])

  const standingsRows = standingsRowsFor(standings, team, id)
  const divisionPostseasonOdds =
    sportId === 1
      ? standingsRows
          .map((s) => ({ ...s, ...postseasonOddsFor(postseasonOddsData, s.id, season, scoreCutoff) }))
          .filter((r) => r.postseasonPct != null)
      : []

  const comebackData = comebackRatesFor(comebackWinsData, id, season)
  const comeback =
    comebackData && comebackData.thresholds.some((t) => t.wins > 0) ? comebackData : null

  // The schedule now runs into October. The day-of-week record and the Records
  // card's completeness check reconcile with regular-season ledgers (standings,
  // gen-team-records), so they count the 'R' rows only.
  const regularSchedule = schedule.filter((g) => g.gameType === 'R')
  const dayOfWeek = regularSchedule.some((g) => g.won != null) ? dayOfWeekRecord(regularSchedule) : null

  return {
    team,
    standings: standingsRows,
    divisionPostseasonOdds,
    comeback,
    // A ledger that holds only part of the season is not shown (#1363).
    teamRecords: ledgerIsComplete(teamRecordsData, regularSchedule, standingsDate) ? teamRecordsData : null,
    scheduleShape: scheduleShapeData,
    // The card tallies rows itself (it owns the pre/post-break lever), so the
    // cutoff travels with the data rather than being applied here.
    recordsCutoff: standingsDate,
    dayOfWeek,
  }
}

// The club's postseason leaders pool (#1437), or null until the club has a postseason game with
// a result (`won` is null past ?d=, so the cutoff holds). Reuses the schedule the page already
// bought; the stats reads go out only after that gate, never in July.
export async function loadPostseasonLeaders(id, asOf, src = DIRECT) {
  const scope = await numbersScope(id, asOf)
  if (!scope) return null
  const { sportId, season, standingsDate } = scope
  const schedule = await src.fetchTeamSchedule(id, season, sportId, standingsDate)
  if (!schedule.some((g) => g.gameType !== 'R' && g.won != null)) return null
  const fetchStats = (teamId, group, yr) => src.fetchTeamSeasonStats(teamId, group, yr, 'P')
  return { pool: await loadCombinedPoolForTeams([{ id }], season, { withHand: true, fetchStats }) }
}

export async function loadRanks(id, asOf, src = DIRECT) {
  const scope = await numbersScope(id, asOf)
  if (!scope) return null
  const { team, sportId, season } = scope
  // Null below Triple-A, which is what keeps the challenge card off a level
  // that runs no ABS rig — and keeps its file off that page's fetch list.
  const absExposureLevel = exposureClubLevelFor(sportId)

  const [
    league,
    leaderPool,
    // Baseball Savant's season run values, MLB only — it runs no minor-league
    // board, so an affiliate's card simply doesn't render. One static file,
    // read through staticJson and shared with the player card and the league
    // board, so a reader who has opened either already has it.
    runValueData,
    // The ABS challenge card's denominators, one row per player per CLUB
    // (ADR-0076, scripts/lib/abs/export.mjs). Its own file rather than a key
    // in the league list precisely so this tab does not download the 418 KB
    // that page reads — and one file per LEVEL for the same reason again, so
    // a major-league club never carries Triple-A's 129 KB. MLB and Triple-A
    // run the rig; below that there is no level, no fetch, and no card.
    absExposureClubs,
    ilRoster,
  ] = await Promise.all([
    sportId === 1 ? fetchLeagueTeamStats(season) : Promise.resolve({ hitting: [], pitching: [] }),
    loadCombinedPoolForTeams([{ id }], season, { withHand: true, fetchStats: src.fetchTeamSeasonStats }),
    sportId === 1 ? fetchRunValue() : Promise.resolve(null),
    fetchAbsExposureClubs(absExposureLevel),
    src.fetchTeamIL(id, season),
  ])

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

  // The club's own run value ledger plus where it stands among the clubs — the
  // ranking is derived here, in the reader, never shipped in the file (see
  // api/around-the-game/runValue.js). Null when the club has nobody in the
  // file at all, which is every MiLB affiliate and, in the first days of a
  // season, possibly a real club too.
  const clubRuns = clubRunValue(runValueData, id)
  const clubs = clubRuns ? clubBoard(runValueData) : []
  const runValue = clubRuns
    ? {
        club: clubRuns,
        rank: clubs.find((r) => r.teamId === id)?.rank ?? null,
        of: clubs.length,
        // Every club, best to worst: the card's league strip (#2295).
        league: clubs,
        // The file's own date, for the card's source line.
        generatedAt: runValueData?.generatedAt ?? null,
      }
    : null

  return {
    team,
    batting,
    pitching,
    // The clubs the rank cells were computed against: "rank of N" (24 in 1969, 30 now). MiLB
    // has no rank cells, so no count.
    clubCount: league.hitting.length || league.pitching.length || null,
    leaderPool,
    runValue,
    // Handed through whole rather than sliced here: the card ranks this club
    // against every other one in the file, so it needs them all. The level
    // travels with it because the rows are keyed on it inside the file too.
    absExposureClubs,
    absExposureLevel,
    injuredIds: injuredIdsFrom(ilRoster),
  }
}
