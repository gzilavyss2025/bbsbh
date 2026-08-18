// The reader behind /doubleheaders — "the doubleheader report".
//
// SPOILER-FREE, on the same footing as api/comebackWins.js: every figure here
// is a season-level aggregate over games statsapi has already called Final. A
// club's record in doubleheader games is a season total, not a score, and
// nothing in this module can name what happened in any one game — the page it
// feeds prints records, sweep counts and opponent totals, never runs.
//
// THE GENERATOR SHIPS PAIRS; THE ARITHMETIC LIVES HERE.
// public/data/doubleheaders.json holds one row per doubleheader — the date, the
// two clubs, and each club's wins in that pair — and nothing per club. Every
// number on the page (a club's W-L, its sweeps, who it met most often, its
// rank) is folded up from those rows HERE, because the page's year slider
// changes the answer to all of them. A generator that precomputed per-club
// totals would have to precompute them for every one of the 276 year ranges
// the slider can be set to, or the slider would be a page reload.
//
// Seven hundred-odd pairs over twenty-three seasons is a 20 KB file and a fold
// of a few thousand additions — fast enough that the slider recomputes as it is
// dragged, which is why nothing here is memoized beyond the one file read.

import { staticJson } from '../staticJson.js'

export const fetchDoubleheaders = staticJson('/data/doubleheaders.json', { fallback: null })

// Column positions in a pair row: [date, teamA, teamB, teamAWins, teamBWins, host].
// The date is carried for the record rather than read here — nothing on the
// board is per-day, and a season is the finest slice the page shows.
// The two club ids are sorted low-first by the generator, so neither side is
// the "home" side of the row — a makeup doubleheader can swap the home flag
// between its two games. Where the day was PLAYED is a separate column
// (`host`), resolved from the venue (scripts/gen-doubleheaders.mjs).
const TEAM_A = 1
const TEAM_B = 2
const WINS_A = 3
const WINS_B = 4
// The club whose PARK the day was played at — what "@" and "vs" are read from.
// Never the per-game home flag, which a makeup doubleheader flips between its
// two games while both are played at one address (scripts/gen-doubleheaders.mjs).
const HOST = 5

// The full span the file covers — what the year slider's two ends clamp to.
export function seasonBounds(data) {
  const seasons = Object.keys(data?.seasons ?? {})
    .map(Number)
    .filter(Number.isFinite)
  if (!seasons.length) return null
  return { first: Math.min(...seasons), last: Math.max(...seasons) }
}

function emptyRow(teamId) {
  return {
    teamId,
    dh: 0, // doubleheaders played
    w: 0,
    l: 0,
    t: 0, // a game that ended tied — counted, credited to no one
    sweeps: 0, // took both
    sweptBy: 0, // dropped both
    splits: 0, // one each
    bySeason: new Map(),
    byOpponent: new Map(),
  }
}

// Fold one side of one pair into a running club row.
//
// EVERY SEASON KEEPS ITS DAYS, not just their counts. The year drawer names the
// opponent of each doubleheader, marks whether it was home or away, and draws
// the mark of each club swept — none of which a count can answer. The list is
// the source of the season's counts too (they are derived from it below rather
// than tallied beside it), so a drawer showing three marks under a "2" is not
// a state this can reach.
function foldSide(row, season, oppId, mine, theirs, atHome) {
  row.dh += 1
  row.w += mine
  row.l += theirs
  row.t += 2 - mine - theirs
  if (mine === 2) row.sweeps += 1
  else if (theirs === 2) row.sweptBy += 1
  else row.splits += 1

  const s = row.bySeason.get(season) ?? { season, dh: 0, w: 0, l: 0, days: [] }
  s.dh += 1
  s.w += mine
  s.l += theirs
  s.days.push({ oppId, home: atHome, w: mine, l: theirs, swept: mine === 2, sweptBy: theirs === 2 })
  row.bySeason.set(season, s)

  const o = row.byOpponent.get(oppId) ?? { teamId: oppId, dh: 0, w: 0, l: 0 }
  o.dh += 1
  o.w += mine
  o.l += theirs
  row.byOpponent.set(oppId, o)
}

// Win percentage over doubleheader GAMES, to three places without the leading
// zero — the form every other record in this app prints (.615, not 0.615). A
// club with no decided games in the range has no percentage rather than .000.
export function pct(w, l) {
  const played = w + l
  if (!played) return null
  return (w / played).toFixed(3).replace(/^0/, '')
}

// THE MOST-MET OPPONENT, as the page's own column. Ties are real and common at
// the short end of the slider — two clubs each met twice — so this returns
// EVERY club sharing the top count and lets the page word it. Returning one of
// them and dropping the rest would print a fact the data does not support.
export function topOpponents(byOpponent) {
  const all = [...byOpponent.values()]
  if (!all.length) return null
  const most = Math.max(...all.map((o) => o.dh))
  return {
    dh: most,
    ids: all
      .filter((o) => o.dh === most)
      .map((o) => o.teamId)
      .sort((a, b) => a - b),
  }
}

// Rank rows on one field, best first, ties SHARING the best rank — the
// convention gate.js and comebackWins.js already use. A row with no value
// ranks null rather than last.
function ranked(rows, field) {
  const usable = rows.filter((r) => r[field] != null)
  return rows.map((r) => {
    if (r[field] == null) return { ...r, rank: null, tied: false }
    const ahead = usable.filter((o) => o[field] > r[field]).length
    const tied = usable.filter((o) => o[field] === r[field]).length > 1
    return { ...r, rank: ahead + 1, tied }
  })
}

// What each sort column ranks on. `pctValue` is the numeric win percentage
// (the printed `pct` is a string), kept beside it so the column can rank and
// print from the same fold.
const SORT_FIELD = {
  pct: 'pctValue',
  dh: 'dh',
  sweeps: 'sweeps',
  sweptBy: 'sweptBy',
}

// The board: one row per club that played at least one doubleheader inside
// [from, to], folded from the pair rows and ranked on `sortBy`.
//
// A club with none in the range is left OFF rather than shown at 0-0. Over a
// single season that is most of the league — thirty rows of dashes would bury
// the eight clubs the page is about — and the caption says how many clubs the
// board holds, so nothing is dropped silently.
export function buildBoard(data, { from, to, sortBy = 'pct' } = {}) {
  const rows = new Map()
  let pairs = 0

  for (const [seasonKey, list] of Object.entries(data?.seasons ?? {})) {
    const season = Number(seasonKey)
    if (!Number.isFinite(season) || season < from || season > to) continue
    for (const pair of list ?? []) {
      const a = pair[TEAM_A]
      const b = pair[TEAM_B]
      const aw = pair[WINS_A]
      const bw = pair[WINS_B]
      pairs += 1
      if (!rows.has(a)) rows.set(a, emptyRow(a))
      if (!rows.has(b)) rows.set(b, emptyRow(b))
      // NULL, not false, at a neutral site: "not this club's park" and "nobody's
      // park" are different facts, and the drawer prints "@" for the first and
      // no preposition at all for the second.
      const host = pair[HOST] ?? null
      foldSide(rows.get(a), season, b, aw, bw, host == null ? null : host === a)
      foldSide(rows.get(b), season, a, bw, aw, host == null ? null : host === b)
    }
  }

  const shaped = [...rows.values()].map((r) => ({
    ...r,
    pctValue: r.w + r.l ? r.w / (r.w + r.l) : null,
    pct: pct(r.w, r.l),
    top: topOpponents(r.byOpponent),
    seasons: [...r.bySeason.values()]
      .map((s) => ({
        ...s,
        // Derived from the days, never tallied alongside them, so the marks the
        // drawer draws and the count beside them cannot disagree.
        swept: s.days.filter((d) => d.swept).map((d) => d.oppId),
        sweptBy: s.days.filter((d) => d.sweptBy).map((d) => d.oppId),
      }))
      .sort((x, y) => y.season - x.season),
    opponents: [...r.byOpponent.values()].sort((x, y) => y.dh - x.dh || x.teamId - y.teamId),
  }))

  const field = SORT_FIELD[sortBy] ?? SORT_FIELD.pct
  // Second key is always the sample: between two clubs at .500, the one that
  // played six doubleheaders has said more than the one that played one.
  const order = ranked(shaped, field).sort(
    (x, y) => (y[field] ?? -1) - (x[field] ?? -1) || y.dh - x.dh || x.teamId - y.teamId,
  )
  return { rows: order, pairs, clubs: order.length }
}

// The three clubs the page's slabs open on, over the same range. Read off the
// built board rather than re-folded, so a slab can never disagree with the row
// under it.
export function boardHighlights(board) {
  const rows = board?.rows ?? []
  if (!rows.length) return null
  const best = (field) =>
    rows.reduce((top, r) => ((r[field] ?? -1) > (top?.[field] ?? -1) ? r : top), null)
  return {
    pairs: board.pairs,
    busiest: best('dh'),
    mostSweeps: best('sweeps'),
    mostSweptBy: best('sweptBy'),
  }
}
