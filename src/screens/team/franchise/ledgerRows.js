// The franchise page's season ledger, shaped for the table (#2763). Pure: no fetch, no clock.
// A row is franchiseLedger's shape (api/history/franchiseLedger.js), or the live row
// api/history/franchise.js builds, which adds `inProgress`.

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

// A winning percentage, ".492"; a dash with no games.
export const pct = (w, l) => (w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : DASH)

// One row's cells. The finish is the division rank, or the league rank before divisions.
export function seasonCells(row) {
  const rank = row.divisionRank ?? row.leagueRank
  const diff = row.rs == null || row.ra == null ? null : row.rs - row.ra
  return {
    season: row.season,
    wl: `${row.w}-${row.l}`,
    pct: pct(row.w, row.l),
    finish: rank ? ordinal(rank) : DASH,
    gb: row.gb ? String(row.gb) : DASH,
    post: postLabel(row.postseason),
    rs: row.rs ?? DASH,
    ra: row.ra ?? DASH,
    diff: diff == null ? DASH : diff > 0 ? `+${diff}` : String(diff),
    managers: (row.managers ?? []).map((m) => ({ id: m.id, name: m.name })),
    tag: row.note ? (NOTE_TAG[row.note] ?? 'Note') : null,
    inProgress: Boolean(row.inProgress),
  }
}

// An odd season's short tag on its row (#2784). The ledger writes three notes; any other reads "Note".
const NOTE_TAG = { 'split season': 'Split', strike: 'Strike', '60-game season': '60 G' }

// Rows (any order) -> the noted seasons as one line under the table, oldest first, or null.
export function oddSeasons(rows) {
  const noted = (rows ?? []).filter((r) => r.note).sort((a, b) => a.season - b.season)
  return noted.length ? noted.map((r) => `${r.season} ${r.note}`).join(' · ') : null
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
