import { fetchStandings, fetchTeam } from '../../../api/team.js'
import { fetchManager } from '../../../api/game.js'
import { getJson } from '../../../api/statsapi.js'
import { franchiseLedger } from '../../../api/history/franchiseLedger.js'
import { summarizeFranchise } from '../../../api/history/franchiseSummary.js'
import { pennantsFor } from '../../../api/history/leaguePennants.js'
import { hallOfFamersFor } from '../../../api/history/franchiseHof.js'
import { retiredNumbersFor } from '../../../api/history/retiredNumbers.js'
import { franchiseLeaders } from '../../../api/history/franchiseLeaders.js'
import { isoToday } from '../../../lib/dates.js'
import { clubRecord, liveRow } from './ledgerRows.js'

// The franchise page's data (#2763): the club, its stored ledger (finished seasons, hand-run
// gen-franchise-ledger.mjs), and a live row for each season after the ledger's last, up to this
// year (usually one; two in a winter before the offseason re-run). History, open surface
// (ADR-0034): no cutoff, so `?d=` is not read here.

// The club's own games for one season, regular season and postseason, trimmed to what liveRow
// reads. Null when the read fails: liveRow then drops the row rather than guess.
const FIELDS = 'dates,games,gamePk,gameType,seriesDescription,gamesInSeries,status,abstractGameState,teams,away,home,team,id,isWinner'
async function clubGames(teamId, season) {
  try {
    const d = await getJson(`/api/v1/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R,F,D,L,W&fields=${FIELDS}`)
    return d.dates ?? []
  } catch {
    return null
  }
}

// Standings first: a season the club has not played yet (January to Opening Day) costs one read,
// not three. `name` is the ledger's newest name, so the live row never draws a band of its own.
async function liveSeason(team, season, name) {
  const records = await fetchStandings(team.league?.id, season)
  if (!clubRecord(records, team.id)) return null
  const [dates, manager] = await Promise.all([clubGames(team.id, season), fetchManager(team.id, season).catch(() => null)])
  return liveRow({ teamId: team.id, season, name, records, dates, manager })
}

// -> { team, rows, summary, hof, retired, leaders } (rows oldest first), or { team, rows: [] } for a
// club with no ledger (MiLB). The summary (#2784) reads every row the table shows, live ones too,
// so a title won this season counts before the offseason ledger run. The stores are static files.
export async function loadFranchise(id) {
  const team = await fetchTeam(id)
  if (!team) return null
  if ((team.sport?.id ?? 1) !== 1) return { team, rows: [] }
  const [{ through, rows: stored }, pennants, hof, retired, leaders] = await Promise.all([
    franchiseLedger(team.id),
    pennantsFor(team.id),
    hallOfFamersFor(team.id),
    retiredNumbersFor(team.id),
    franchiseLeaders(team.id),
  ])
  if (!stored.length) return { team, rows: stored }
  const year = Number(isoToday().slice(0, 4))
  const seasons = []
  for (let s = (through ?? year) + 1; s <= year; s++) seasons.push(s)
  const live = (await Promise.all(seasons.map((s) => liveSeason(team, s, stored[stored.length - 1].name)))).filter(Boolean)
  const rows = [...stored, ...live]
  return { team, rows, summary: summarizeFranchise(rows, pennants), hof, retired, leaders }
}
