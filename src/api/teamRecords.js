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
//
// Every row carries a stable `id` as well as its printed `k`. The id is what a
// URL names (`/situational-records?metric=scored-4-plus`) and what
// situationalRecordRankings
// pivots 30 clubs on, so it must NOT be derived from the label — a reworded row
// would silently break every shared link. Add rows freely; never renumber one.
export const RECORD_GROUPS = [
  {
    title: 'Scoring',
    rows: [
      { id: 'scored-first', k: 'Scoring first', p: (g) => g.sf === 1 },
      { id: 'opp-scored-first', k: 'Opponent scores first', p: (g) => g.sf === -1 },
      { id: 'scored-4-plus', k: 'Scoring 4+ runs', p: (g) => g.rs >= 4 },
      { id: 'scored-3-fewer', k: 'Scoring 3 or fewer', p: (g) => g.rs <= 3 },
    ],
  },
  {
    title: 'Hits and homers',
    rows: [
      { id: 'out-hitting', k: 'Out-hitting opponent', p: (g) => g.hi > g.ha },
      { id: 'out-hit', k: 'Out-hit by opponent', p: (g) => g.hi < g.ha },
      { id: 'hits-even', k: 'Hit totals even', p: (g) => g.hi === g.ha },
      { id: 'hits-10-plus', k: '10 or more hits', p: (g) => g.hi >= 10 },
      { id: 'homered', k: 'Hitting a home run', p: (g) => (g.hr ?? 0) >= 1 },
      { id: 'no-homer', k: 'Not hitting a home run', p: (g) => (g.hr ?? 0) === 0 },
      { id: 'homers-2-plus', k: 'Hitting 2+ homers', p: (g) => (g.hr ?? 0) >= 2 },
      { id: 'opp-homered', k: 'Opponent homers', p: (g) => (g.hra ?? 0) >= 1 },
      { id: 'opp-homerless', k: 'Opponent held homerless', p: (g) => (g.hra ?? 0) === 0 },
      { id: 'opp-homers-2-plus', k: 'Opponent hits 2+ homers', p: (g) => (g.hra ?? 0) >= 2 },
    ],
  },
  {
    title: 'Defense',
    rows: [
      { id: 'error-committed', k: 'Committing an error', p: (g) => (g.e ?? 0) >= 1 },
      { id: 'error-free', k: 'Committing no errors', p: (g) => (g.e ?? 0) === 0 },
    ],
  },
  {
    title: 'Leading and trailing',
    rows: [
      { id: 'lead-6', k: 'Leading after 6 innings', p: (g) => g.l6 === 1 },
      { id: 'trail-6', k: 'Trailing after 6 innings', p: (g) => g.l6 === -1 },
      { id: 'tied-6', k: 'Tied after 6 innings', p: (g) => g.l6 === 0 },
      { id: 'lead-7', k: 'Leading after 7 innings', p: (g) => g.l7 === 1 },
      { id: 'trail-7', k: 'Trailing after 7 innings', p: (g) => g.l7 === -1 },
      { id: 'tied-7', k: 'Tied after 7 innings', p: (g) => g.l7 === 0 },
      { id: 'lead-8', k: 'Leading after 8 innings', p: (g) => g.l8 === 1 },
      { id: 'trail-8', k: 'Trailing after 8 innings', p: (g) => g.l8 === -1 },
      { id: 'tied-8', k: 'Tied after 8 innings', p: (g) => g.l8 === 0 },
    ],
  },
  {
    title: 'Close games',
    rows: [
      { id: 'one-run', k: 'One-run games', p: (g) => margin(g) === 1 },
      { id: 'two-run', k: 'Two-run games', p: (g) => margin(g) === 2 },
      { id: 'extra-innings', k: 'Extra innings', p: (g) => g.x === 1 },
      { id: 'last-at-bat', k: 'Decided in last at-bat', p: (g) => g.la === 1 },
      { id: 'walk-off-game', k: 'Walk-off games', p: (g) => g.wo === 1 || g.wo === -1 },
    ],
  },
  {
    title: 'Starting pitching',
    rows: [
      { id: 'quality-start', k: 'Quality start', p: (g) => g.qs === 1 },
      { id: 'starter-6-plus', k: 'Starter goes 6+ innings', p: (g) => starterOuts(g) != null && g.si >= 18 },
      { id: 'starter-under-6', k: 'Starter goes under 6', p: (g) => starterOuts(g) != null && g.si < 18 },
      { id: 'opp-starter-6-plus', k: 'Opposing starter 6+', p: (g) => oppStarterOuts(g) != null && g.oi >= 18 },
      { id: 'opp-starter-under-6', k: 'Opposing starter under 6', p: (g) => oppStarterOuts(g) != null && g.oi < 18 },
      { id: 'vs-rhs', k: 'Vs. right-handed starter', p: (g) => g.oh === 'R' },
      { id: 'vs-lhs', k: 'Vs. left-handed starter', p: (g) => g.oh === 'L' },
    ],
  },
  {
    title: 'Schedule',
    rows: [
      { id: 'day-game', k: 'Day games', p: (g) => g.n !== 1 },
      { id: 'night-game', k: 'Night games', p: (g) => g.n === 1 },
      { id: 'doubleheader', k: 'Doubleheaders', p: (g) => g.dh === 1 },
      { id: 'series-opener', k: 'Series opener', p: (g) => g.op === 1 },
      { id: 'series-finale', k: 'Series finale', p: (g) => g.fi === 1 },
      { id: 'getaway-day', k: 'Getaway day', p: (g) => g.ga === 1 },
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
  const decided = t.wins + t.losses
  // `rate` is the same number `pct` prints, kept unrounded and unformatted so
  // the cross-club ranking page can sort on it. Null with nothing decided —
  // NOT 0, which would rank a club that has never been in the split below one
  // that is genuinely 0-8 there.
  const rate = decided ? t.wins / decided : null
  if (!played) return { v: DASH, pct: DASH, wins: 0, losses: 0, ties: 0, rate: null }
  const v = t.ties ? `${t.wins}-${t.losses}-${t.ties}` : `${t.wins}-${t.losses}`
  return {
    v,
    pct: rate == null ? DASH : rate.toFixed(3).replace(/^0/, ''),
    wins: t.wins,
    losses: t.losses,
    ties: t.ties,
    rate,
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
// The complete series in the filtered games, grouped by opponent and the
// date of the series opener (unique per club, since `sg` counts up from 1
// within each series). A series straddling the filter's edge — a rained-out
// middle game, a set split by the All-Star break — never appears whole here,
// which is what "complete" means below.
function completeSeries(games) {
  const bySeries = new Map()
  for (const g of games) {
    if (!g.sl || g.sl < 2) continue
    const openerIndex = games.indexOf(g) - (g.sg - 1)
    const opener = games[openerIndex]
    if (!opener) continue
    const key = `${g.o}-${opener.d}`
    if (!bySeries.has(key)) bySeries.set(key, { len: g.sl, rows: [] })
    bySeries.get(key).rows.push(g)
  }
  return [...bySeries.values()].filter((s) => s.rows.length === s.len)
}

export function sweepCounts(games) {
  let swept = 0
  let sweptBy = 0
  for (const s of completeSeries(games)) {
    if (s.rows.every((r) => r.r === 'W')) swept++
    else if (s.rows.every((r) => r.r === 'L')) sweptBy++
  }
  return { swept, sweptBy }
}

// The plain series result — won more games than lost, whether or not it was a
// sweep. An even-length series split down the middle (2-2 in a 4-game set) is
// neither a series win nor a series loss, the same way a tied W-L split has no
// winning side.
export function seriesRecordCounts(games) {
  let won = 0
  let lost = 0
  for (const s of completeSeries(games)) {
    const wins = s.rows.filter((r) => r.r === 'W').length
    const losses = s.rows.filter((r) => r.r === 'L').length
    if (wins > losses) won++
    else if (losses > wins) lost++
  }
  return { won, lost }
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
// The season counts, as a catalog
// ---------------------------------------------------------------------------

// The single-number counts, in the order the card prints them. Each one names
// which END of the column is the good one, because that is NOT uniform here:
// more wins after trailing is a club's resilience, more losses after leading is
// the same trait failing, and ranking both "highest first" would put the worst
// bullpen in the league at the top of a list titled the same way as the best.
//
//   high    — the leader is first when the list is sorted best-first
//   low     — fewest is the achievement, even though the ranking page's
//             browse default still opens every count biggest-first
//             (situationalRecordRankings.js's defaultOrder vs. bestOrder)
//   neutral — an honest ordering exists but neither end is praise. Days in 2nd
//             and 3rd place are the case: a lot of them can mean a good club
//             that never caught the division or a bad one that never fell out
//             of it, so the ranking page ranks them without a best/worst tone.
//
// `get` reads the counts block teamRecordsFor returns, so this catalog is the
// one place a count is named, ordered and judged — the card prints it and the
// cross-club page ranks it from the same entry.
const PLACES = ['1st', '2nd', '3rd', '4th', '5th']
export const COUNT_METRICS = [
  // "Wins after trailing", not "comeback wins" — the Comeback wins card
  // further down the Numbers tab counts a different thing (games where the
  // club's win probability sank below 10/20/30%, api/comebackWins.js), and two
  // cards on one page using one name for two numbers reads as a bug. This one
  // is the plain ledger fact: it trailed at the end of some half-inning and
  // won anyway.
  { id: 'count-wins-after-trailing', k: 'Wins after trailing', better: 'high', get: (c) => c.comebackWins },
  { id: 'count-losses-after-leading', k: 'Losses after leading', better: 'low', get: (c) => c.lossesAfterLeading },
  // A W-L record for these would be redundant with the win column itself — a
  // shutout thrown is a game the pitching side cannot lose, and a shutout
  // suffered is one the batting side cannot win. Counting them, like every
  // other single-number achievement here, is the honest shape.
  { id: 'count-shutouts-thrown', k: 'Shutouts thrown', better: 'high', get: (c) => c.shutoutsThrown },
  { id: 'count-shutouts-suffered', k: 'Times shut out', better: 'low', get: (c) => c.shutoutsSuffered },
  { id: 'count-walk-off-wins', k: 'Walk-off wins', better: 'high', get: (c) => c.walkOffWins },
  { id: 'count-walk-off-losses', k: 'Walk-off losses', better: 'low', get: (c) => c.walkOffLosses },
  { id: 'count-batted-around', k: 'Times batted around', better: 'high', get: (c) => c.battedAround },
  { id: 'count-sweeps', k: 'Series sweeps', better: 'high', get: (c) => c.swept },
  { id: 'count-swept', k: 'Series swept', better: 'low', get: (c) => c.sweptBy },
  // The plain series result, sweep or not — won more games in the set than it
  // lost. A series split down the middle counts toward neither.
  { id: 'count-series-won', k: 'Series wins', better: 'high', get: (c) => c.seriesWon },
  { id: 'count-series-lost', k: 'Series losses', better: 'low', get: (c) => c.seriesLost },
  { id: 'count-win-streak', k: 'Longest win streak', better: 'high', get: (c) => c.streaks.wins },
  { id: 'count-losing-streak', k: 'Longest losing streak', better: 'low', get: (c) => c.streaks.losses },
  ...PLACES.map((place, i) => ({
    id: `count-days-${i + 1}`,
    k: `Days in ${place} place`,
    // First place is the only unambiguous end of this one; last place in a
    // five-club division is the other. The middle three are neutral.
    better: i === 0 ? 'high' : i === 4 ? 'low' : 'neutral',
    get: (c) => c.daysAtPlace[i],
  })),
]

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
        return { id: row.id, k: row.k, played: t.wins + t.losses + t.ties, ...formatRecord(t) }
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
      .map(([m, t]) => ({
        id: `month-${m}`,
        k: MONTHS[m - 1],
        played: t.wins + t.losses + t.ties,
        ...formatRecord(t),
      })),
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
  // `prefix` keys the metric id by the KIND of opponent group (a division id
  // and a league id come from different statsapi number spaces and could
  // otherwise collide).
  const namedRows = (tallies, labels, prefix) =>
    [...tallies.entries()]
      .map(([id, t]) => ({
        id: `${prefix}-${id}`,
        k: labels[id] ? `Vs. ${labels[id]}` : null,
        played: t.wins + t.losses + t.ties,
        ...formatRecord(t),
      }))
      .filter((r) => r.k && r.played > 0)
      .sort((a, b) => a.k.localeCompare(b.k))

  const opponentGroups = []
  const divisionRows = namedRows(byDivision, names.divisions ?? {}, 'div')
  if (divisionRows.length) opponentGroups.push({ title: 'By division', rows: divisionRows })
  // MLB only: below it, a club's own league IS its schedule, so the row would
  // just restate the season record.
  if (data.sportId === 1) {
    const leagueRows = namedRows(byLeague, names.leagues ?? {}, 'lg')
    if (leagueRows.length) opponentGroups.push({ title: 'By league', rows: leagueRows })
  }

  const seriesRecord = seriesRecordCounts(games)

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
      shutoutsThrown: games.filter((g) => g.ra === 0).length,
      shutoutsSuffered: games.filter((g) => g.rs === 0).length,
      ...sweepCounts(games),
      seriesWon: seriesRecord.won,
      seriesLost: seriesRecord.lost,
      streaks: longestStreaks(games),
      daysAtPlace: daysAtPlace(data.dailyRank, { cutoff, half, allStarDate }),
    },
  }
}
