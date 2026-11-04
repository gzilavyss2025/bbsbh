// The franchise page's season ledger, shaped for the table (#2763). Pure: no fetch, no clock.
// A row is franchiseLedger's shape (api/history/franchiseLedger.js); the live row liveRow builds
// for a season the stored ledger has not reached yet has the same shape plus `inProgress`.

import { ordinal } from '../../../lib/format.js'

const DASH = '—'

// A round's short form (the phone) and long form (the wide table). Before 1969 only the World
// Series is on file; the wild card rounds are a game (2012-2021) or a series (2020, 2022 on).
function roundNames(round) {
  if (round === 'World Series') return ['WS', 'World Series']
  const lg = round.slice(0, 2)
  if (/Championship Series$/.test(round)) return [`${lg}CS`, `${lg}CS`]
  if (/Division Series$/.test(round)) return [`${lg}DS`, `${lg}DS`]
  if (/Wild Card/.test(round)) return ['WC', 'Wild Card']
  return [round, round]
}

// { round, won } -> the cell. `won` null is a series still being played (the live row).
export function postLabel(postseason) {
  if (!postseason) return { short: DASH, long: DASH, title: false }
  const [short, long] = roundNames(postseason.round)
  const verb = postseason.won == null ? 'In' : postseason.won ? 'Won' : 'Lost'
  return { short: `${verb} ${short}`, long: `${verb} ${long}`, title: postseason.round === 'World Series' && postseason.won === true }
}

// One row's cells. The finish is the division rank, or the league rank before divisions.
export function seasonCells(row) {
  const games = row.w + row.l
  const rank = row.divisionRank ?? row.leagueRank
  const diff = row.rs == null || row.ra == null ? null : row.rs - row.ra
  return {
    season: row.season,
    wl: `${row.w}-${row.l}`,
    pct: games ? (row.w / games).toFixed(3).replace(/^0/, '') : DASH,
    finish: rank ? ordinal(rank) : DASH,
    gb: row.gb ? String(row.gb) : DASH,
    post: postLabel(row.postseason),
    rs: row.rs ?? DASH,
    ra: row.ra ?? DASH,
    diff: diff == null ? DASH : diff > 0 ? `+${diff}` : String(diff),
    managers: (row.managers ?? []).map((m) => ({ id: m.id, name: m.name })),
    note: row.note ?? null,
    inProgress: Boolean(row.inProgress),
  }
}

// Rows (any order) -> the table's items, newest first: { kind: 'season', row } and, above the
// newest season of every name but the current one, { kind: 'band', name, from, to }.
export function ledgerItems(rows) {
  const list = [...(rows ?? [])].sort((a, b) => b.season - a.season)
  const items = []
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    if (i > 0 && r.name !== list[i - 1].name) {
      let j = i
      while (j + 1 < list.length && list[j + 1].name === r.name) j++
      items.push({ kind: 'band', name: r.name, from: list[j].season, to: r.season })
    }
    items.push({ kind: 'season', row: r })
  }
  return items
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
export function clubRecord(records, teamId) {
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
    managers: manager?.personId ? [{ id: manager.personId, name: manager.name }] : [],
    postseason: furthestSeries(all, teamId),
    note: null,
    inProgress: all.some((gm) => gm.status?.abstractGameState !== 'Final'),
  }
}
