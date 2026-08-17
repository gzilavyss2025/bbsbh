// One club's SITUATIONAL RECORDS — its W-L when it scores first, out-hits the
// opponent, leads after seven, faces a left-handed starter, plays a getaway
// day, and forty other conditions — plus the single-number season counts that
// are not records (come-from-behind wins, sweeps, days in first, longest
// streak). Rendered by the Numbers tab's Records card, under Team Leaders.
//
// Read from the static public/data/team-records/{season}/{teamId}.json a
// nightly scripts/gen-team-records.mjs precomputes (the build-time-fetch
// pattern; the per-game box-score sweep behind it is far too costly for a page
// load). The file holds a compact ROW PER GAME, not the finished records —
// which is what lets this module do two things a precomputed total could not:
//
//   1. Honour the `?d=` cutoff exactly. A dated team page filters the rows by
//      date here, so the records never look further ahead than the standings
//      beside them. That is the same guarantee the day-of-week card gets from
//      its own cutoff-gated schedule fetch.
//   2. Answer the pre-break / post-break lever without a second dataset.
//
// SPOILER-FREE, on the same footing as WAR, the team-score aggregates and
// comeback-wins: a season ledger of FINAL games carries no live-game score, and
// the team hub is an open surface by rule (ADR-0034 — "the cutoff is opt-in
// now"; gating an open surface is the regression, not the hardening). The file
// is written by a cron that runs before the day's games, so it cannot contain
// tonight even before the cutoff is applied. Degrades to null with no file.

import { staticJsonBy } from './staticJson.js'

// staticJsonBy memoizes on String(key), so the key has to be a string — a
// `{season, teamId}` object would collapse every club onto "[object Object]"
// and serve the first club's file to all of them.
const fetchShard = staticJsonBy((key) => `/data/team-records/${key}.json`, { fallback: null })

export async function fetchTeamRecords(teamId, season) {
  if (!teamId || !season) return null
  return fetchShard(`${season}/${teamId}`)
}

// ---------------------------------------------------------------------------
// Row predicates
// ---------------------------------------------------------------------------

// Every shipped row omits a falsy value rather than writing 0/false/null, so
// each accessor coalesces. `h` absent means an away game, `n` absent a day
// game, `oh` absent an unresolved starting hand.
const margin = (g) => Math.abs(g.rs - g.ra)
const starterOuts = (g) => g.si ?? null
const oppStarterOuts = (g) => g.oi ?? null

// The record rows, in the order the card prints them, grouped by subject.
// A predicate returning false EXCLUDES the game from that row entirely (it is
// neither a win nor a loss there) — which is different from returning false
// for "the club lost". Rows whose predicate can never be answered for a game
// (a starter with no innings on file, a game that never reached the 8th) are
// skipped for that game alone, so a thin MiLB feed thins a row instead of
// voiding the table.
export const RECORD_GROUPS = [
  {
    title: 'Scoring',
    rows: [
      { k: 'Scoring first', p: (g) => g.sf === 1 },
      { k: 'Opponent scores first', p: (g) => g.sf === -1 },
      { k: 'Scoring 4+ runs', p: (g) => g.rs >= 4 },
      { k: 'Scoring 3 or fewer', p: (g) => g.rs <= 3 },
      { k: 'Pitching a shutout', p: (g) => g.ra === 0 },
      { k: 'Shut out', p: (g) => g.rs === 0 },
    ],
  },
  {
    title: 'Hits and homers',
    rows: [
      { k: 'Out-hitting opponent', p: (g) => g.hi > g.ha },
      { k: 'Out-hit by opponent', p: (g) => g.hi < g.ha },
      { k: 'Hit totals even', p: (g) => g.hi === g.ha },
      { k: '10 or more hits', p: (g) => g.hi >= 10 },
      { k: 'Hitting a home run', p: (g) => (g.hr ?? 0) >= 1 },
      { k: 'Not hitting a home run', p: (g) => (g.hr ?? 0) === 0 },
      { k: 'Hitting 2+ homers', p: (g) => (g.hr ?? 0) >= 2 },
      { k: 'Opponent homers', p: (g) => (g.hra ?? 0) >= 1 },
      { k: 'Opponent held homerless', p: (g) => (g.hra ?? 0) === 0 },
      { k: 'Opponent hits 2+ homers', p: (g) => (g.hra ?? 0) >= 2 },
    ],
  },
  {
    title: 'Defense',
    rows: [
      { k: 'Committing an error', p: (g) => (g.e ?? 0) >= 1 },
      { k: 'Committing no errors', p: (g) => (g.e ?? 0) === 0 },
    ],
  },
  {
    title: 'Leading and trailing',
    rows: [
      { k: 'Leading after 6', p: (g) => g.l6 === 1 },
      { k: 'Trailing after 6', p: (g) => g.l6 === -1 },
      { k: 'Leading after 7', p: (g) => g.l7 === 1 },
      { k: 'Trailing after 7', p: (g) => g.l7 === -1 },
      { k: 'Tied after 7', p: (g) => g.l7 === 0 },
      { k: 'Leading after 8', p: (g) => g.l8 === 1 },
      { k: 'Trailing after 8', p: (g) => g.l8 === -1 },
      { k: 'Tied after 8', p: (g) => g.l8 === 0 },
    ],
  },
  {
    title: 'Close games',
    rows: [
      { k: 'One-run games', p: (g) => margin(g) === 1 },
      { k: 'Two-run games', p: (g) => margin(g) === 2 },
      { k: 'Extra innings', p: (g) => g.x === 1 },
      { k: 'Decided in last at-bat', p: (g) => g.la === 1 },
      { k: 'Walk-off games', p: (g) => g.wo === 1 || g.wo === -1 },
    ],
  },
  {
    title: 'Starting pitching',
    rows: [
      { k: 'Quality start', p: (g) => g.qs === 1 },
      { k: 'Starter goes 6+ innings', p: (g) => starterOuts(g) != null && g.si >= 18 },
      { k: 'Starter goes under 6', p: (g) => starterOuts(g) != null && g.si < 18 },
      { k: 'Opposing starter 6+', p: (g) => oppStarterOuts(g) != null && g.oi >= 18 },
      { k: 'Opposing starter under 6', p: (g) => oppStarterOuts(g) != null && g.oi < 18 },
      { k: 'Vs. right-handed starter', p: (g) => g.oh === 'R' },
      { k: 'Vs. left-handed starter', p: (g) => g.oh === 'L' },
    ],
  },
  {
    title: 'Schedule',
    rows: [
      { k: 'Day games', p: (g) => g.n !== 1 },
      { k: 'Night games', p: (g) => g.n === 1 },
      { k: 'Doubleheaders', p: (g) => g.dh === 1 },
      { k: 'Series opener', p: (g) => g.op === 1 },
      { k: 'Series finale', p: (g) => g.fi === 1 },
      { k: 'Getaway day', p: (g) => g.ga === 1 },
    ],
  },
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ---------------------------------------------------------------------------
// Tally
// ---------------------------------------------------------------------------

const DASH = '—'

function blank() {
  return { wins: 0, losses: 0, ties: 0 }
}
function fold(tally, result) {
  if (result === 'W') tally.wins++
  else if (result === 'L') tally.losses++
  else tally.ties++
}
// A row's printable pair. A club with no games in the split shows a dash
// rather than "0-0", the same convention dayOfWeekRecord already uses. Ties are
// counted but only PRINTED when there are any — a tie is vanishingly rare and
// a permanent "-0" on every row would be noise.
function formatRecord(t) {
  const played = t.wins + t.losses + t.ties
  if (!played) return { v: DASH, pct: DASH }
  const v = t.ties ? `${t.wins}-${t.losses}-${t.ties}` : `${t.wins}-${t.losses}`
  const decided = t.wins + t.losses
  return {
    v,
    pct: decided ? (t.wins / decided).toFixed(3).replace(/^0/, '') : DASH,
  }
}

// The three levers the card offers: the whole season, or one side of the
// All-Star break. `allStarDate` absent (an early-season file, or a level whose
// season has not reached it) leaves only 'all' meaningful, and the card hides
// the other two.
export const HALVES = [
  { key: 'all', label: 'Full season' },
  { key: 'pre', label: 'Pre-All-Star' },
  { key: 'post', label: 'Post-All-Star' },
]

function inHalf(game, half, allStarDate) {
  if (half === 'all' || !allStarDate) return true
  return half === 'pre' ? game.d < allStarDate : game.d > allStarDate
}

// ---------------------------------------------------------------------------
// Streaks and season counts
// ---------------------------------------------------------------------------

// The longest run of wins and of losses in the filtered games. A tie breaks
// neither streak and extends neither — it is not a result, which is how MLB's
// own streak field treats a suspended-then-tied game.
export function longestStreaks(games) {
  let bestW = 0
  let bestL = 0
  let runW = 0
  let runL = 0
  for (const g of games) {
    if (g.r === 'W') {
      runW++
      runL = 0
    } else if (g.r === 'L') {
      runL++
      runW = 0
    } else continue
    if (runW > bestW) bestW = runW
    if (runL > bestL) bestL = runL
  }
  return { wins: bestW, losses: bestL }
}

// Series sweeps for and against, over the filtered games. Read off the
// per-row series tags the generator wrote (`sg`/`sl`/`op`), so a rained-out
// middle game cannot invent a series that never happened. A series is only
// counted when ALL of its games are inside the filter — a set straddling the
// All-Star break belongs to neither half.
export function sweepCounts(games) {
  const bySeries = new Map()
  for (const g of games) {
    if (!g.sl || g.sl < 2) continue
    // A series is keyed by its opponent and the date of its opener, which is
    // unique per club: `sg` counts up from 1 within each series.
    const openerIndex = games.indexOf(g) - (g.sg - 1)
    const opener = games[openerIndex]
    if (!opener) continue
    const key = `${g.o}-${opener.d}`
    if (!bySeries.has(key)) bySeries.set(key, { len: g.sl, rows: [] })
    bySeries.get(key).rows.push(g)
  }
  let swept = 0
  let sweptBy = 0
  for (const s of bySeries.values()) {
    if (s.rows.length !== s.len) continue
    if (s.rows.every((r) => r.r === 'W')) swept++
    else if (s.rows.every((r) => r.r === 'L')) sweptBy++
  }
  return { swept, sweptBy }
}

// Days spent at each division place, 1st through 5th, from the generator's
// per-date rank series. Counted only over dates inside the cutoff and the
// chosen half, so the pre-break figure is a real "where did we sit at the
// break" answer rather than a season total.
export function daysAtPlace(dailyRank, { cutoff, half, allStarDate }) {
  const days = [0, 0, 0, 0, 0]
  for (const [date, rank] of Object.entries(dailyRank ?? {})) {
    if (cutoff && date > cutoff) continue
    if (!inHalf({ d: date }, half, allStarDate)) continue
    if (rank >= 1 && rank <= 5) days[rank - 1]++
  }
  return days
}

// ---------------------------------------------------------------------------
// The card's whole payload
// ---------------------------------------------------------------------------

// `data` is the fetched shard; `cutoff` is the dated page's day-before cutoff
// (null on a live page); `half` is one of HALVES' keys. Returns null when the
// club has no file or no games inside the filter, and the card then hides.
export function teamRecordsFor(data, { cutoff = null, half = 'all' } = {}) {
  if (!data?.games?.length) return null
  const allStarDate = data.allStarDate ?? null
  const games = data.games.filter(
    (g) => (!cutoff || g.d <= cutoff) && inHalf(g, half, allStarDate),
  )
  if (!games.length) return null

  const groups = RECORD_GROUPS.map((group) => ({
    title: group.title,
    rows: group.rows
      .map((row) => {
        const t = blank()
        for (const g of games) if (row.p(g)) fold(t, g.r)
        return { k: row.k, played: t.wins + t.losses + t.ties, ...formatRecord(t) }
      })
      .filter((r) => r.played > 0),
  })).filter((g) => g.rows.length > 0)

  // By month, in calendar order over the months actually played.
  const byMonth = new Map()
  for (const g of games) {
    const m = Number(g.d.slice(5, 7))
    if (!byMonth.has(m)) byMonth.set(m, blank())
    fold(byMonth.get(m), g.r)
  }
  const monthGroup = {
    title: 'By month',
    rows: [...byMonth.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([m, t]) => ({ k: MONTHS[m - 1], played: t.wins + t.losses + t.ties, ...formatRecord(t) })),
  }

  // Opponent groups. Every club gets its own level's divisions; only an MLB
  // club gets the two-league split, because only there does "vs. the American
  // League" name interleague play rather than most of the schedule.
  const opponents = data.opponents ?? {}
  const names = data.names ?? { divisions: {}, leagues: {} }
  const byDivision = new Map()
  const byLeague = new Map()
  for (const g of games) {
    const meta = opponents[g.o]
    if (meta?.v != null) {
      if (!byDivision.has(meta.v)) byDivision.set(meta.v, blank())
      fold(byDivision.get(meta.v), g.r)
    }
    if (meta?.l != null) {
      if (!byLeague.has(meta.l)) byLeague.set(meta.l, blank())
      fold(byLeague.get(meta.l), g.r)
    }
  }
  const namedRows = (tallies, labels) =>
    [...tallies.entries()]
      .map(([id, t]) => ({
        k: labels[id] ? `Vs. ${labels[id]}` : null,
        played: t.wins + t.losses + t.ties,
        ...formatRecord(t),
      }))
      .filter((r) => r.k && r.played > 0)
      .sort((a, b) => a.k.localeCompare(b.k))

  const opponentGroups = []
  const divisionRows = namedRows(byDivision, names.divisions ?? {})
  if (divisionRows.length) opponentGroups.push({ title: 'By division', rows: divisionRows })
  // MLB only: below it, a club's own league IS its schedule, so the row would
  // just restate the season record.
  if (data.sportId === 1) {
    const leagueRows = namedRows(byLeague, names.leagues ?? {})
    if (leagueRows.length) opponentGroups.push({ title: 'By league', rows: leagueRows })
  }

  return {
    allStarDate,
    gamesCounted: games.length,
    groups: [...groups, monthGroup, ...opponentGroups],
    counts: {
      comebackWins: games.filter((g) => g.cb === 1).length,
      lossesAfterLeading: games.filter((g) => g.ll === 1).length,
      battedAround: games.reduce((n, g) => n + (g.ba ?? 0), 0),
      walkOffWins: games.filter((g) => g.wo === 1).length,
      walkOffLosses: games.filter((g) => g.wo === -1).length,
      ...sweepCounts(games),
      streaks: longestStreaks(games),
      daysAtPlace: daysAtPlace(data.dailyRank, { cutoff, half, allStarDate }),
    },
  }
}
