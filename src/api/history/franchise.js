import { fetchSeasonVenue, fetchStandings, fetchTeam } from '../team/fetch.js'
import { fetchManager } from '../game/fetch.js'
import { getJson } from '../statsapi.js'
import { franchiseLedger } from './franchiseLedger.js'
import { summarizeFranchise } from './franchiseSummary.js'
import { pennantsFor } from './leaguePennants.js'
import { hallOfFamersFor } from './franchiseHof.js'
import { retiredNumbersFor } from './retiredNumbers.js'
import { franchiseLeaders } from './franchiseLeaders.js'
import { franchiseFor, temporaryParksFor } from './franchiseSeasons.js'
import { isoToday } from '../../lib/dates.js'

// The franchise page's data (#2763, #3036): the club, its stored ledger (finished seasons,
// hand-run gen-franchise-ledger.mjs), and a live row for each season after the ledger's last, up
// to this year (usually one; two in a winter before the offseason re-run). History, open surface
// (ADR-0034): no cutoff, so `?d=` is not read here. The screen imports only this module.

const thisYear = () => Number(isoToday().slice(0, 4))

// The live tail: every season after a stored file's last (`through`) up to `year`. Empty when
// `through` is null (no file) or already this year. One rule for the ledger and the parks.
export function liveSeasons(through, year) {
  const out = []
  if (through != null) for (let s = through + 1; s <= year; s++) out.push(s)
  return out
}

// The club's own games for one season, regular season and postseason, trimmed to what liveRow
// reads. Null when the read fails: liveRow then drops the row rather than guess.
const FIELDS = 'dates,games,gamePk,gameType,seriesDescription,gamesInSeries,status,abstractGameState,teams,away,home,team,id,isWinner'
async function clubGames(get, teamId, season) {
  try {
    const d = await get(`/api/v1/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R,F,D,L,W&fields=${FIELDS}`)
    return d.dates ?? []
  } catch {
    return null
  }
}

const LIVE_DEPS = { getJson, fetchStandings, fetchManager }

// The stored rows plus a live row per season after `through`, up to `year`, oldest first.
// Standings first: a season the club has not played yet (January to Opening Day) costs one read,
// not three. A live row takes the ledger's newest name, so it never draws a band of its own.
// `deps` is the seam the node test fakes.
export async function ledgerWithLiveTail({ team, through, stored, year }, deps = LIVE_DEPS) {
  const name = stored.at(-1)?.name
  const live = await Promise.all(
    liveSeasons(through, year).map(async (season) => {
      const records = await deps.fetchStandings(team.league?.id, season)
      if (!clubRecord(records, team.id)) return null
      const [dates, manager] = await Promise.all([
        clubGames(deps.getJson, team.id, season),
        deps.fetchManager(team.id, season).catch(() => null),
      ])
      return liveRow({ teamId: team.id, season, name, records, dates, manager })
    }),
  )
  return [...stored, ...live.filter(Boolean)]
}

// -> { team, rows, summary } (rows oldest first), or { team, rows: [] } for a club with no ledger
// (MiLB). The summary (#2784) reads every row the table shows, live ones too, so a title won this
// season counts before the offseason ledger run.
export async function loadFranchise(id) {
  const team = await fetchTeam(id)
  if (!team) return null
  if ((team.sport?.id ?? 1) !== 1) return { team, rows: [] }
  const [{ through, rows: stored }, pennants] = await Promise.all([franchiseLedger(team.id), pennantsFor(team.id)])
  if (!stored.length) return { team, rows: stored }
  const rows = await ledgerWithLiveTail({ team, through, stored, year: thisYear() })
  return { team, rows, summary: summarizeFranchise(rows, pennants) }
}

// People and places, loaded after the ledger so the table never waits on it (#2784 review): the
// Hall of Famers, the retired numbers, the all-time leaders (whose ids link the number tiles) and
// the parks (#2788): the franchise-history file, plus the park of each season after it, since a
// club can move (the Rays, back at Tropicana in 2026).
export async function loadFranchisePeople(teamId) {
  const [hof, retired, leaders, history, temporary] = await Promise.all([
    hallOfFamersFor(teamId),
    retiredNumbersFor(teamId),
    franchiseLeaders(teamId),
    franchiseFor(teamId),
    temporaryParksFor(teamId),
  ])
  const after = liveSeasons(history.through, thisYear())
  const venues = await Promise.all(after.map(async (s) => ({ season: s, venue: await fetchSeasonVenue(teamId, s) })))
  return { hof, retired, leaders, history, venues, temporary }
}

const POST_ROUND = { F: 1, D: 2, L: 3, W: 4 }

// The club's furthest postseason series in a season, from its own schedule: { round, won } with
// `won` null while the series is undecided. A series is the games against one opponent in one
// round; it is decided once a side has more than half of `gamesInSeries`.
function furthestSeries(games, teamId) {
  const series = new Map()
  const seen = new Set()
  for (const gm of games) {
    const round = POST_ROUND[gm.gameType]
    if (!round) continue
    // A suspended game is listed on its first date and again on the day it resumed: count it once.
    if (gm.gamePk != null && gm.status?.abstractGameState === 'Final') {
      if (seen.has(gm.gamePk)) continue
      seen.add(gm.gamePk)
    }
    const mine = gm.teams.home.team.id === teamId ? gm.teams.home : gm.teams.away
    const other = mine === gm.teams.home ? gm.teams.away : gm.teams.home
    const key = `${round}-${other.team.id}`
    const s = series.get(key) ?? { round, name: gm.seriesDescription, need: Math.floor((gm.gamesInSeries ?? 1) / 2) + 1, w: 0, l: 0 }
    if (gm.status?.abstractGameState === 'Final' && typeof mine.isWinner === 'boolean') mine.isWinner ? s.w++ : s.l++
    series.set(key, s)
  }
  const top = [...series.values()].sort((a, b) => b.round - a.round)[0]
  if (!top) return null
  return { round: top.name, won: top.w >= top.need ? true : top.l >= top.need ? false : null }
}

const games = (v) => (v == null || v === '-' || v === '' ? 0 : Number(v))
const rank = (v) => (v == null || v === '' ? null : Number(v))

// The club's standings record in `records`, or null when it has played no game yet.
function clubRecord(records, teamId) {
  const t = (records ?? []).flatMap((r) => r.teamRecords ?? []).find((x) => x.team?.id === teamId)
  return t && t.wins + t.losses > 0 ? t : null
}

// A season the stored ledger does not hold yet, read live: `records` from standings
// (regularSeason), `dates` from the club's own schedule for the season (regular season and
// postseason), `manager` from fetchManager. Null before the club's first game, and null when the
// schedule could not be read (`dates` null): without it the row cannot say whether the season is
// over or how far the club went, and a missing row is better than a wrong one. `inProgress` while
// any game of the club's is not final: once its last game is, the row reads like any other.
export function liveRow({ teamId, season, name, records, dates, manager }) {
  const t = clubRecord(records, teamId)
  if (!t || dates == null) return null
  const all = dates.flatMap((d) => d.games ?? [])
  return {
    season,
    name,
    w: t.wins,
    l: t.losses,
    gb: games(t.gamesBack),
    divisionRank: rank(t.divisionRank),
    leagueRank: rank(t.leagueRank),
    rs: t.runsScored ?? null,
    ra: t.runsAllowed ?? null,
    // No w/l: fetchManager names one manager (an interim first), not who managed which games. The
    // page marks him † for this season until the offseason ledger run splits it (#2784 review).
    managers: manager?.personId ? [{ id: manager.personId, name: manager.name }] : [],
    postseason: furthestSeries(all, teamId),
    note: null,
    inProgress: all.some((gm) => gm.status?.abstractGameState !== 'Final'),
  }
}
