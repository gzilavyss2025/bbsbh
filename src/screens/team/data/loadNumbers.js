import { fetchTeam, fetchStandings, fetchLeagueTeamStats, fetchTeamIL } from '../../../api/team.js'
import { fetchTeamSchedule } from '../../../api/schedule.js'
import { fetchComebackWins, comebackRatesFor } from '../../../api/comebackWins.js'
import { fetchPostseasonOdds, postseasonOddsFor } from '../../../api/postseasonOdds.js'
import { loadCombinedPoolForTeams } from '../../../api/statsLevels.js'
import { rankTeam, ordinal } from '../../../api/person.js'
import { dayOfWeekRecord } from '../modules/TeamStatsCard.jsx'

const DASH = '—'

// The Numbers tab's own data: standings, team batting/pitching ranks, the
// leaderboard pool, comeback-win rates, and the day-of-week record — see
// .scratch/team-page-ia/issues/05-numbers-tab.md. Copied out of TeamPage.jsx's
// loadTeam rather than shared with it (see the PRD's file-ownership section);
// the temporary duplication is intentional and issue 07 removes it.
//
// Fetches nothing else — no roster, 40-man, WAR, uniforms, photos, prospects,
// affiliates or transactions. Those belong to the other tabs.

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
// Standings (and every precomputed score below) use the day BEFORE a dated
// page's asOf cutoff, so a visitor mid-scoring never sees a record that
// already counts tonight's result — same cutoff TeamPage.jsx's loadTeam uses.
function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
function nickname(name) {
  return (name || '').split(/\s+/).slice(-1)[0] || name || DASH
}
function splitWL(rec, type) {
  const t = (rec.records?.splitRecords ?? []).find((s) => s.type === type)
  return t ? `${t.wins}-${t.losses}` : DASH
}
function lastTen(rec) {
  return splitWL(rec, 'lastTen')
}
function runDiff(rec) {
  const d = rec.runDifferential
  if (!Number.isFinite(d)) return DASH
  return d > 0 ? `+${d}` : `${d}`
}
function runDiffTone(rec) {
  const d = rec.runDifferential
  if (!Number.isFinite(d) || d === 0) return ''
  return d > 0 ? 'is-positive' : 'is-negative'
}
function statRank(rows, teamId, key, label, lowerBetter) {
  const mine = rows.find((r) => r.teamId === teamId)
  const r = rankTeam(rows, teamId, key, lowerBetter)
  const tone = r ? (r.rank <= 5 ? 'good' : r.rank >= 20 ? 'bad' : '') : ''
  const extreme = r ? (r.rank <= 5 ? 'best' : r.rank > r.of - 5 ? 'worst' : '') : ''
  return { k: label, v: mine?.stat?.[key] ?? DASH, rank: r ? ordinal(r.rank) : DASH, tone, extreme }
}
// The IL cross that flags a hurt player in the leaders list — just the ids,
// same status-code filter TeamPage.jsx's loadTeam uses for its own Injured
// List section (issue 03 owns that section itself; this tab only needs the
// id set).
function injuredIdsFrom(ilRoster) {
  return new Set(
    ilRoster
      .filter((r) => /^D\d+$/.test(r.status?.code ?? '') || r.status?.code === 'ILF')
      .map((r) => r.person?.id)
      .filter(Boolean),
  )
}

export async function loadNumbers(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const season = Number((asOf || isoToday()).slice(0, 4))
  const standingsDate = asOf ? dayBefore(asOf) : null
  const scoreCutoff = asOf ? dayBefore(asOf) : dayBefore(isoToday())

  const [standings, league, leaderPool, postseasonOddsData, comebackWinsData, schedule, ilRoster] =
    await Promise.all([
      team.league?.id
        ? fetchStandings(team.league.id, season, standingsDate)
        : Promise.resolve([]),
      sportId === 1 ? fetchLeagueTeamStats(season) : Promise.resolve({ hitting: [], pitching: [] }),
      loadCombinedPoolForTeams([{ id }], season),
      sportId === 1 ? fetchPostseasonOdds() : Promise.resolve(null),
      sportId === 1 ? fetchComebackWins() : Promise.resolve(null),
      // Cutoff-gated rows only — `won` stays null past standingsDate (see
      // fetchTeamSchedule), which is what keeps the day-of-week record from
      // looking ahead. Don't re-derive it from Final status.
      fetchTeamSchedule(id, season, sportId, standingsDate),
      fetchTeamIL(id, season),
    ])

  const div = standings.find((r) => r.division?.id === team.division?.id)
  const standingsRows = (div?.teamRecords ?? []).map((t) => ({
    id: t.team.id,
    name: nickname(t.team.name),
    wins: t.wins,
    losses: t.losses,
    gb: t.gamesBack,
    streak: t.streak?.streakCode ?? DASH,
    l10: lastTen(t),
    home: splitWL(t, 'home'),
    away: splitWL(t, 'away'),
    diff: runDiff(t),
    diffTone: runDiffTone(t),
    isMe: t.team.id === id,
  }))
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

  return {
    team,
    standings: standingsRows,
    divisionPostseasonOdds,
    batting,
    pitching,
    leaderPool,
    comeback,
    dayOfWeek,
    injuredIds: injuredIdsFrom(ilRoster),
  }
}
