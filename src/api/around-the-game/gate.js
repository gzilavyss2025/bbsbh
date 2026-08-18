// The reader behind the two pages scripts/gen-gate.mjs feeds — /attendance
// ("The Gate") and /pace-of-play ("The Clock"). One static file, two boards.
//
// SPOILER-FREE. A crowd count and a clock reading say nothing about who won.
// Same footing as the weather string and the umpire crew, both of which this
// app has always shown live before a pitch is thrown. Nothing here reads a
// run, an inning or a result, so no SealBox and no reveal gate.
//
// THE GENERATOR SHIPS FACTS; THE RANKING LIVES HERE. gate.json holds each
// club's own totals and splits and nothing about the other 29. Everything
// comparative — rank, fill rate against the park's listed capacity, the gap
// from the league line — is derived here, where it is pure and testable
// (test/gate.test.js), and where the FILL RATE can join the attendance figure
// to lib/ballpark/ballparkData.js's capacity table without the generator
// having to carry a copy of it.
//
// WHY FILL RATE IS THE HEADLINE AND RAW AVERAGE IS NOT. A club's average gate
// mostly measures how many seats it built. Fenway seats 37,755 and Dodger
// Stadium 56,000; ranking the two by raw heads rewards the concrete. The share
// of the park that is FULL is the number that says whether a town shows up,
// and it reorders the league — which is why both are on the page and this one
// leads it.
//
// Capacity is a listed figure, not a turnstile cap: standing room, a sold-out
// club level and a generous listing all push a real gate past 100%, and the
// page prints those over-100 rates as they are rather than clamping them,
// because clamping would erase exactly the clubs the stat is finding.

import { staticJson } from '../staticJson.js'
import { BALLPARKS } from '../../lib/ballpark/ballparkData.js'

export const fetchGate = staticJson('/data/gate.json')

// Normalized venue key, mirroring lib/ballpark/ballparkData.js's own — kept as
// a local copy for the same reason that module keeps one: it is four lines,
// and exporting it would widen that module's surface for one caller.
function venueKey(name) {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// The listed capacity of a club's home park, or null when the park is not in
// the static table (the Athletics' temporary Triple-A home is the standing
// gap). A null capacity means no fill rate — the row still ranks on every
// other column rather than dropping off the board.
export function capacityFor(venue) {
  return BALLPARKS[venueKey(venue)]?.capacity ?? null
}

// The season a bare page load should open on: the newest one on file.
export function latestSeason(data) {
  const seasons = Object.keys(data?.seasons ?? {}).map(Number).filter(Number.isFinite)
  return seasons.length ? Math.max(...seasons) : null
}

// Rank a list of already-shaped rows on one numeric field, best first (or
// last, for a field whose good end is low). Ties SHARE the best rank, the same
// convention attendance.js and comebackWins.js already use, and a row with no
// value ranks null rather than last — it has not earned a place either way.
function ranked(rows, field, { lowIsBest = false } = {}) {
  const usable = rows.filter((r) => r[field] != null)
  return rows.map((r) => {
    if (r[field] == null) return { ...r, rank: null, tied: false }
    const ahead = usable.filter((o) =>
      lowIsBest ? o[field] < r[field] : o[field] > r[field],
    ).length
    const tied = usable.filter((o) => o[field] === r[field]).length > 1
    return { ...r, rank: ahead + 1, tied }
  })
}

// ---- The Gate ----

// Every club's home-gate row for one season, ranked. `sortBy` picks which
// column the board is ordered on; the RANK printed on each row always belongs
// to that same column, so a reader never sees "3rd" on a list sorted by
// something else.
//
// GATE_SORTS is exported alongside so the page's control strip and this
// function cannot disagree about which columns exist or which way each reads.
export const GATE_SORTS = [
  { key: 'fill', label: 'Fill rate', lowIsBest: false },
  { key: 'avg', label: 'Average', lowIsBest: false },
  { key: 'total', label: 'Season total', lowIsBest: false },
  { key: 'best', label: 'Best night', lowIsBest: false },
  { key: 'swing', label: 'Swing', lowIsBest: false },
]

export function gateBoard(data, season, sortBy = 'fill') {
  const clubs = data?.seasons?.[season]?.clubs
  if (!clubs) return null
  const sort = GATE_SORTS.find((s) => s.key === sortBy) ?? GATE_SORTS[0]

  const rows = Object.entries(clubs)
    .filter(([, c]) => c?.gate)
    .map(([teamId, c]) => {
      const g = c.gate
      const capacity = capacityFor(c.venue)
      return {
        teamId: Number(teamId),
        venue: c.venue,
        capacity,
        games: g.games,
        avg: g.avg,
        median: g.median,
        total: g.total,
        // Percent of the listed capacity, one decimal. Null without a listed
        // capacity — see this file's header on why it is never clamped.
        fill: capacity ? Math.round((g.avg / capacity) * 1000) / 10 : null,
        best: g.high?.n ?? null,
        bestDate: g.high?.date ?? null,
        bestOppId: g.high?.oppId ?? null,
        worst: g.low?.n ?? null,
        worstDate: g.low?.date ?? null,
        worstOppId: g.low?.oppId ?? null,
        // The distance between a club's biggest night and its smallest. A wide
        // swing is a club whose crowd depends on the opponent and the day; a
        // narrow one sells the same house whoever is in town.
        swing: g.high?.n != null && g.low?.n != null ? g.high.n - g.low.n : null,
        day: g.day,
        night: g.night,
        weekend: g.weekend,
        weekday: g.weekday,
        byMonth: g.byMonth,
        topOpponents: g.topOpponents ?? [],
      }
    })

  const withRank = ranked(rows, sort.key, { lowIsBest: sort.lowIsBest })
  withRank.sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    if (av == null) return 1
    if (bv == null) return -1
    return sort.lowIsBest ? av - bv : bv - av
  })
  return { rows: withRank, league: data.seasons[season].league, through: data.seasons[season].through }
}

// ---- The Clock ----

export const PACE_SORTS = [
  // `rankOn` is the field the RANK and the tie flag are computed from, when it
  // differs from the field the board is sorted by. On game length they differ
  // on purpose: the board sorts on the float (164.3) so the order is stable,
  // but the rank is computed on the MINUTE the reader actually sees. Without
  // that split the board printed "T3 2:47 / T3 2:47 / T3 2:47 / 6 2:47" —
  // three clubs marked as tied and a fourth showing the identical clock denied
  // the same tie, which reads as a broken table and is the correct reading.
  { key: 'avg', label: 'Longest', lowIsBest: false, rankOn: 'avgMin' },
  { key: 'avgFast', label: 'Quickest', lowIsBest: true, field: 'avg', rankOn: 'avgMin' },
  // Sorted on the SHARE, not the count. The caption promises a club that has
  // played more games is not penalised for it, and a raw count breaks that
  // promise the moment games played stop being level across the league — which
  // is most of April, and any week after a rainout cluster.
  { key: 'over180Pct', label: 'Three-hour games', lowIsBest: false },
  { key: 'delayMinutes', label: 'Time in delay', lowIsBest: false },
]

// How far a club's own average could sit from its true pace on this many
// games, at roughly 95% confidence — two standard errors, where the standard
// error is the league's per-game spread over the square root of games played.
//
// THE PAGE PRINTS THIS, and the board is unhonest without it. Game length has
// a per-game standard deviation near 19 minutes; over ~125 games that is about
// ±3.4 minutes on every club, against a slowest-to-quickest gap near 11. Most
// of a thirty-club ranking is therefore inside its own margin, and in April —
// at ~18 games each — effectively all of it is.
export function paceMargin(sd, games) {
  if (!sd || !games || games < 2) return null
  return Math.round((2 * (sd / Math.sqrt(games))) * 10) / 10
}

// Below this many games a club's average says almost nothing, so the board
// stops printing a 1-30 order over it and says why. Set where two standard
// errors fall under about five minutes — around half the league's own
// season-long spread, which is the point at which an ordering starts to carry
// more signal than coin flips.
export const PACE_RANK_MIN_GAMES = 60

export function paceBoard(data, season, sortBy = 'avg') {
  const clubs = data?.seasons?.[season]?.clubs
  if (!clubs) return null
  const sort = PACE_SORTS.find((s) => s.key === sortBy) ?? PACE_SORTS[0]
  const field = sort.field ?? sort.key
  const league = data.seasons[season].league

  const rows = Object.entries(clubs)
    .filter(([, c]) => c?.pace)
    .map(([teamId, c]) => {
      const p = c.pace
      return {
        teamId: Number(teamId),
        games: p.games,
        avg: p.avg,
        median: p.median,
        longest: p.longest?.n ?? null,
        longestDate: p.longest?.date ?? null,
        longestOppId: p.longest?.oppId ?? null,
        shortest: p.shortest?.n ?? null,
        shortestDate: p.shortest?.date ?? null,
        shortestOppId: p.shortest?.oppId ?? null,
        over180: p.over180,
        over210: p.over210,
        // Share of this club's games that ran past three hours — the column
        // that makes a 125-game club comparable to a 120-game one.
        over180Pct: p.games ? Math.round((p.over180 / p.games) * 1000) / 10 : null,
        // The minute the reader sees, kept as a field so rank and display are
        // computed from the same number (see PACE_SORTS's `rankOn`).
        avgMin: p.avg == null ? null : Math.round(p.avg),
        // This club's own ± at 95%, from the league's per-game spread and its
        // own games played. Printed beside its average.
        margin: paceMargin(league?.paceSd, p.games),
        delayGames: p.delays?.games ?? 0,
        delayMinutes: p.delays?.minutes ?? 0,
        day: p.day,
        night: p.night,
        byMonth: p.byMonth,
      }
    })

  const withRank = ranked(rows, sort.rankOn ?? field, { lowIsBest: sort.lowIsBest })
  withRank.sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (av == null) return 1
    if (bv == null) return -1
    return sort.lowIsBest ? av - bv : bv - av
  })
  // Every club is measured on the same schedule, so "enough games to rank" is a
  // league-level fact, not a per-club one: either the season is far enough
  // along for the board to mean something or it is not.
  const median = withRank.length
    ? [...withRank].sort((a, b) => a.games - b.games)[withRank.length >> 1].games
    : 0
  return {
    rows: withRank,
    league,
    through: data.seasons[season].through,
    sortLabel: sort.label,
    // The ± every club on this board carries, at the median club's games
    // played — the figure the page states once above the table.
    margin: paceMargin(league?.paceSd, median),
    rankable: median >= PACE_RANK_MIN_GAMES,
    medianGames: median,
  }
}

// Minutes as a broadcast clock reading — 164 -> '2:44'. Baseball talks about
// game length in hours and minutes and never in minutes alone, so every
// surface that prints a duration goes through this.
export function asClock(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '—'
  const whole = Math.round(minutes)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// The month keys present across every club, in calendar order — the x-axis for
// both pages' trend strip. Read off the data rather than assumed, so a season
// that opened in Seoul in March and one that opened in April both draw right.
export function monthsIn(rows) {
  const seen = new Set()
  for (const r of rows ?? []) for (const m of Object.keys(r.byMonth ?? {})) seen.add(m)
  return [...seen].sort()
}
