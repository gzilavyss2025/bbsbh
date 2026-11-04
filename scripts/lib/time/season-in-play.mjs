// WHICH SEASON A NIGHTLY GENERATOR IS ABOUT — issue #1465.
//
// Not the calendar year. On January 1 `new Date().getFullYear()` says 2027, but
// no 2027 game exists until Opening Day at the end of March. A generator that
// asks statsapi or Savant for "2027" in that span gets an empty board and, if
// it has no guard, writes it over the finished 2026 file
// (docs/duplicate-derivations.md, row U12).
//
// The rule: the season in play is this year from its regular-season start
// date on, and last year before it. So it is 2026 from Opening Day 2026, all
// through October and the winter, and it turns to 2027 on Opening Day 2027.
// Spring training stays on the old season too: the boards these generators
// build are regular-season boards, and a spring week has none.
//
// The start date comes off statsapi's own season row for the date's calendar
// year (the same row src/lib/time/seasonPhase.js reads), so the turn lands on
// the real Opening Day, not a guess. The row is optional: with no row, or a row
// for some other year, the answer falls back to the calendar — the old season
// before April 1, this year from then on. Opening Day has fallen in late March
// for years, so the fallback can be a few days late at worst, and late is the
// safe side: a generator that rebuilds last season once more writes the same
// data, one that opens the new season early writes an empty one.
//
// The pure half is seasonInPlay(); fetchSeasonInPlay() adds the one statsapi
// read. A generator that takes --season keeps it: the helper is only its
// default.
import { getJson } from '../statsapi.mjs'

const ISO = /^\d{4}-\d{2}-\d{2}$/

// The calendar fallback's turn, as MM-DD. Used only when no season row is on
// hand. See the header for why April 1.
const FALLBACK_TURN = '04-01'

// `todayIso` is a YYYY-MM-DD day (UTC: the nightly job runs in UTC). `row` is
// statsapi's season row for that day's calendar year, or null.
export function seasonInPlay(todayIso, row) {
  if (typeof todayIso !== 'string' || !ISO.test(todayIso)) {
    throw new TypeError(`seasonInPlay: expected YYYY-MM-DD, got ${todayIso}`)
  }
  const year = Number(todayIso.slice(0, 4))
  const start = Number(row?.seasonId) === year ? row?.regularSeasonStartDate : null
  if (typeof start === 'string' && ISO.test(start)) return todayIso < start ? year - 1 : year
  return todayIso.slice(5) < FALLBACK_TURN ? year - 1 : year
}

// THE SEASON THAT IS OVER — issue #2778, ADR-0074's rule for scripts.
//
// A season is over once statsapi's offseason for it has opened: on or after its
// row's `offseasonStartDate` (Nov 1 in 2026; the postseason runs to Oct 31 and
// is still the season). From Jan 1 to the next Opening Day the season in play is
// last year's (seasonInPlay above), and that season is over by definition. The
// answer is the season that just ended, or null for "not over".
//
// Without a usable row (missing, wrong year, no valid offseasonStartDate) it
// never guesses. Before November the season is still on (the postseason runs to
// Oct 31), so that is null. In November and December the answer turns on the row,
// so it THROWS, naming the season it cannot decide on: the freeze step then fails
// that night instead of waiting in silence (Gary, #2887).
export function seasonOver(todayIso, row) {
  const season = seasonInPlay(todayIso, row)
  const year = Number(todayIso.slice(0, 4))
  if (season < year) return season
  const opens = Number(row?.seasonId) === year ? row?.offseasonStartDate : null
  if (typeof opens === 'string' && ISO.test(opens)) return todayIso >= opens ? season : null
  if (todayIso.slice(5) < '11-01') return null
  throw new Error(`cannot tell whether ${year} is over: statsapi's ${year} season row has no usable offseasonStartDate`)
}

// statsapi's season row for `year`, or null on a failed read. Never throws.
async function fetchSeasonRow(year) {
  try {
    const data = await getJson(
      `/api/v1/seasons?sportId=1&season=${year}&fields=seasons,seasonId,regularSeasonStartDate,offseasonStartDate`,
    )
    return data?.seasons?.[0] ?? null
  } catch {
    return null
  }
}

// The season in play for `today` (a Date; now by default). One statsapi read;
// a failed read falls back to the calendar rule above and never throws.
export async function fetchSeasonInPlay(today = new Date()) {
  const todayIso = today.toISOString().slice(0, 10)
  return seasonInPlay(todayIso, await fetchSeasonRow(todayIso.slice(0, 4)))
}

// The season that is over on `today`, or null. Same one read; a failed read in
// November or December throws (seasonOver above).
export async function fetchSeasonOver(today = new Date()) {
  const todayIso = today.toISOString().slice(0, 10)
  return seasonOver(todayIso, await fetchSeasonRow(todayIso.slice(0, 4)))
}
