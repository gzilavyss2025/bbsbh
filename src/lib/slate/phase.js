import { levelOffseasonPhase, levelOpeningDay, offseasonPhase } from '../time/seasonPhase.js'
import { readSeasonRow, rowFitsYear } from '../time/seasonRows.js'
import { LEVELS, SPORT_IDS } from '../teams.js'

// IS THE SLATE LOOKING AT A WINTER? — the offseason home page's one gate
// (issue #1038), lifted out of GameSelect so the screen reads as a screen.
//
// A slate that comes back empty is NOT evidence that a season is over. It is
// the same shape as a postponed day, a level's Monday off, and an endpoint
// having a bad morning — and the forward scan the slate falls back on
// (fetchNextGameDate) only looks ten days ahead, so in November it spends ten
// sequential fetches to answer null. Null is not an answer. So the season's end
// is read off the dates statsapi PUBLISHES for it (src/lib/time/seasonPhase.js
// carries that reading, and why the winter takes two rows to describe), never
// off an absence, and the slate skips the pointless scan once this says yes.
//
// It fails closed at every step: no row, an unreadable row, or a spring date
// that cannot be found returns null, and null leaves the ordinary empty slate
// exactly as it is today.
//
// TWO READINGS, ONE GATE. MLB's winter comes off sportId 1's own season row.
// The four minor levels cannot: a level is three leagues that finish on three
// different days, so its winter is read off the leagues themselves
// (levelOffseasonPhase, and fetchLevelSeasonDates for why the sport-wide row is
// not a stand-in). The two readings differ in three ways and no more — which
// dates bound the winter, how many rows it takes to say so, and what the
// countdown counts to, which is spring training at MLB and the level's own
// Opening Day below it, because no minor-league season row carries a spring
// date at all. Everything downstream of `winter` is shared.
//
// `seasonRow` is passed in rather than fetched: the slate already asks for it on
// any empty day (it is the same row the All-Star break bounds come off), so the
// offseason page costs an empty day no fetch it was not already spending. It
// also does double duty for the levels below MLB — the loader asks for that row
// ONLY on an empty day, at every level, so its arrival is the empty-day signal
// (levelFetchYear below). A level's own rows
// are never fetched on a day that has games on it.

// The slate's own level toggle, minus MLB — derived rather than restated so a
// sixth tab cannot appear on the rail and be missed by this gate.
const LEVEL_TABS = LEVELS.filter((l) => l.sportId !== SPORT_IDS.MLB).map((l) => l.sportId)

// The no-rows guess, per level: [first winter day, first season day] as MM-DD (#2936).
// Off statsapi's /league rows for 2023-2027 (the last league out, the first league back):
// AAA out Sep 28-Oct 1, back Mar 26-31; AA out Sep 24-28, back Apr 2-6; A+ out Sep 16-21 and
// A out Sep 17-21, both back Apr 2-6. Each bound is the EARLIEST measured date. In September a
// level's last week is all games, so guessing a winter a few days early holds no room on any
// day that draws one. In spring, after the first opener an empty day is most likely an off
// day, which must not get a winter's reserve. A level missing here guesses no winter.
export const LEVEL_WINTER_GUESS = {
  [SPORT_IDS.AAA]: ['09-28', '03-26'],
  [SPORT_IDS.AA]: ['09-24', '04-02'],
  [SPORT_IDS['A+']]: ['09-16', '04-02'],
  [SPORT_IDS.A]: ['09-17', '04-02'],
}
// MLB's: every measured offseasonStartDate is November 1 or 2; the winter runs to March.
const MLB_WINTER_GUESS = ['11-01', '03-01']

// The whole decision, pure, in two steps (the loader runs both on every update). `net` is what
// the network has answered so far ({ season, level, next }); anything it has not
// answered, or answered null, is read from the rows remembered on this device (`load`,
// see lib/time/seasonRows.js). Null is a FAILED read, not an answer: fetchSeasonMeta and
// fetchLevelSeasonDates answer null on any error (#2936). A real answer wins, so a stale
// remembered row is corrected the moment the fresh one arrives, and a first visit
// with nothing remembered behaves as it did before rows were remembered. Keyed by
// the DATE's year, so on 2027-01-02 a remembered 2026 row is never read, and a
// network row for another year (the render where the date just changed) is ignored.
export function phaseOf(dateStr, sportId, net, load = readSeasonRow) {
  const isLevel = LEVEL_TABS.includes(sportId)
  const year = dateStr?.length === 10 ? Number(dateStr.slice(0, 4)) : null
  // `undefined` (pending) or null (failed): use the saved row. A real answer decides,
  // even a degraded one (a row that is not this year's): that is phase null.
  const pick = (fresh, id) =>
    fresh == null ? load(id, year) : rowFitsYear(fresh, year) ? fresh : null
  const seasonRow = pick(net.season, SPORT_IDS.MLB)
  // A level reads its own rows only: the MLB row says nothing about it (#2936).
  const levelRows = isLevel ? pick(net.level, sportId) : null
  const phase = isLevel
    ? levelOffseasonPhase(dateStr, levelRows)
    : sportId === SPORT_IDS.MLB
      ? offseasonPhase(dateStr, seasonRow)
      : null
  // Is a winter to be expected (to hold room for it)? Only on a tab that can have one.
  // Yes when the rows say so. With no rows at all (a first visit, or storage blocked) the
  // calendar guesses, per sport: MLB_WINTER_GUESS, LEVEL_WINTER_GUESS. No when rows are in hand and say it is the
  // season: that day keeps its ordinary empty-day page.
  const known = isLevel ? Boolean(levelRows) : Boolean(seasonRow)
  const md = dateStr?.slice(5)
  const guess = isLevel ? LEVEL_WINTER_GUESS[sportId] : sportId === SPORT_IDS.MLB ? MLB_WINTER_GUESS : null
  const winterMonths = Boolean(guess) && (md >= guess[0] || md < guess[1])
  return { phase, seasonRow, expectWinter: Boolean(guess) && (Boolean(phase) || (!known && winterMonths)) }
}

export function winterOf(dateStr, sportId, base, nextRow, load = readSeasonRow) {
  const { phase, seasonRow } = base
  if (!phase) return null
  // A real answer beats a saved row; `undefined` (pending) and null (failed) read the saved one.
  const nextYear = phase.springFromNextSeason ?? phase.openerFromNextSeason
  const forward =
    nextRow != null
      ? rowFitsYear(nextRow, nextYear) ? nextRow : null
      : phase.springFromNextSeason
        ? load(SPORT_IDS.MLB, phase.springFromNextSeason)
        : phase.openerFromNextSeason
          ? load(sportId, phase.openerFromNextSeason)
          : null
  return winterFrom(dateStr, LEVEL_TABS.includes(sportId), phase, seasonRow, forward)
}

// Everything the offseason page draws itself from, or null. Held back until
// the date it counts to is known, so the page cannot appear without its
// countdown and then grow one under the reader a beat later. A saved row may
// decide the phase, but the countdown still needs a date (never one without).
function winterFrom(dateStr, isLevel, phase, seasonRow, forward) {
  if (isLevel) {
    // The opener is on the rows in hand from January on, and a year forward
    // before that. Either way it is the date the winter ends AND the date it
    // counts to: a minor league goes from no baseball to Opening Day with no
    // spring in between.
    const openingDay = phase.openingDay ?? levelOpeningDay(forward)
    if (!openingDay) return null
    return {
      seasonEnded: phase.seasonEnded,
      today: dateStr,
      // Only the calendar strip's lower bound, and only in the branch that
      // does not carry the real one: after the January rollover the rows in
      // hand describe the season AHEAD, so last September's exact date would
      // cost a third fetch to say what a floor says well enough. The four
      // levels' measured starts run September 16 to October 1 (LEVEL_WINTER_GUESS).
      startDate: phase.startDate ?? `${phase.seasonEnded}-09-01`,
      endDate: openingDay,
      springStartDate: null,
      openingDay,
    }
  }
  // True in January and February, when the row in hand is already NEXT
  // season's and carries both dates itself.
  const rolledOver = Boolean(phase.springStartDate)
  const springStartDate = phase.springStartDate ?? forward?.springStartDate ?? null
  if (!springStartDate) return null
  return {
    seasonEnded: phase.seasonEnded,
    today: dateStr,
    // The exact opening date when this date's own row carries it. After the
    // rollover it is on the previous year's row, which is not worth a third
    // fetch: the window only decides which typed milestones are in range, and
    // every offseasonStartDate measured falls on November 1 or 2.
    startDate: phase.startDate ?? `${phase.seasonEnded}-11-01`,
    endDate: springStartDate,
    springStartDate,
    openingDay:
      (rolledOver ? seasonRow?.regularSeasonStartDate : forward?.regularSeasonStartDate) ?? null,
  }
}

// The year to ask for a level's /league rows, or null. `seasonRow` is the slate's MLB read,
// asked only on an empty day: `undefined` until it answers, then the row or null. Its ANSWER is
// the empty-day signal, whatever it says, so a failed MLB read still asks for the level's rows
// (#2936).
export const levelFetchYear = (dateYear, sportId, seasonRow) =>
  LEVEL_TABS.includes(sportId) && seasonRow !== undefined && dateYear ? dateYear : null

