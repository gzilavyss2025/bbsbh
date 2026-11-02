import { fetchStandings, fetchTeam } from '../../../api/team.js'
import { fetchManager } from '../../../api/game.js'
import { getJson } from '../../../api/statsapi.js'
import { franchiseLedger } from '../../../api/history/franchiseLedger.js'
import { isoToday } from '../../../lib/dates.js'
import { liveRow } from './ledgerRows.js'

// The franchise page's data (#2763): the club, its stored ledger (finished seasons, hand-run
// gen-franchise-ledger.mjs), and a live row for each season after the ledger's last, up to this
// year (usually one; two in a winter before the offseason re-run). History, open surface
// (ADR-0034): no cutoff, so `?d=` is not read here.

// The club's own games for one season, regular season and postseason, trimmed to what liveRow reads.
const FIELDS = 'dates,games,gameType,seriesDescription,gamesInSeries,status,abstractGameState,teams,away,home,team,id,isWinner'
async function clubGames(teamId, season) {
  const d = await getJson(`/api/v1/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R,F,D,L,W&fields=${FIELDS}`)
  return d.dates ?? []
}

async function liveSeason(team, season) {
  const [records, dates, manager] = await Promise.all([
    fetchStandings(team.league?.id, season),
    clubGames(team.id, season).catch(() => []),
    fetchManager(team.id, season).catch(() => null),
  ])
  return liveRow({ teamId: team.id, season, name: team.name, records, dates, manager })
}

// -> { team, rows } (rows oldest first), or { team, rows: [] } for a club with no ledger (MiLB).
export async function loadFranchise(id) {
  const team = await fetchTeam(id)
  if (!team) return null
  if ((team.sport?.id ?? 1) !== 1) return { team, rows: [] }
  const { through, rows } = await franchiseLedger(team.id)
  if (!rows.length) return { team, rows }
  const year = Number(isoToday().slice(0, 4))
  const seasons = []
  for (let s = (through ?? year) + 1; s <= year; s++) seasons.push(s)
  const live = (await Promise.all(seasons.map((s) => liveSeason(team, s)))).filter(Boolean)
  return { team, rows: [...rows, ...live] }
}
