import { useMemo } from 'react'
import { fetchLevelSeasonDates, fetchSeasonMeta } from '../api/schedule.js'
import { useAsync } from './useAsync.js'
import { levelOffseasonPhase, levelOpeningDay, offseasonPhase } from '../lib/time/seasonPhase.js'
import { LEVELS, SPORT_IDS } from '../lib/teams.js'

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
// also does double duty for the levels below MLB — GameSelect asks for that row
// ONLY on an empty day, at every level, so its arrival is the empty-day signal
// this hook would otherwise need a sixth argument to learn. A level's own rows
// are never fetched on a day that has games on it.

// The slate's own level toggle, minus MLB — derived rather than restated so a
// sixth tab cannot appear on the rail and be missed by this gate.
const LEVEL_TABS = LEVELS.filter((l) => l.sportId !== SPORT_IDS.MLB).map((l) => l.sportId)

export function useOffseason(dateStr, sportId, seasonRow) {
  const isLevel = LEVEL_TABS.includes(sportId)
  // The calendar year the viewed DATE is in — the year whose rows describe the
  // winter around it. Never the current year: paging back to last October has
  // to answer about last October.
  const dateYear = dateStr?.length === 10 ? Number(dateStr.slice(0, 4)) : null
  const levelSeason = isLevel && seasonRow && dateYear ? dateYear : null

  const levelRows = useAsync(
    () => (levelSeason ? fetchLevelSeasonDates(sportId, levelSeason) : Promise.resolve(null)),
    [levelSeason, sportId],
  )

  const phase = useMemo(() => {
    if (isLevel) return levelOffseasonPhase(dateStr, levelRows.data)
    return sportId === SPORT_IDS.MLB ? offseasonPhase(dateStr, seasonRow) : null
  }, [dateStr, isLevel, levelRows.data, seasonRow, sportId])

  // November and December read forward one row for the two dates the winter
  // calendar is allowed to state as fact — spring training's first game and
  // Opening Day. January through February needs no second call: statsapi rolls
  // the season over on January 1, so by then both are on the row already in
  // hand. Verified live that a season's row is published well before its year
  // is (2027's existed in September 2026, at MLB and at all four levels).
  //
  // A level takes the same forward step for the same reason, one endpoint over:
  // its September-to-December branch has next season's opener on next year's
  // league rows. Only one of the two ever runs — a phase carries one forward
  // year or the other, never both.
  const next = useAsync(() => {
    if (phase?.springFromNextSeason) return fetchSeasonMeta(phase.springFromNextSeason)
    if (phase?.openerFromNextSeason) {
      return fetchLevelSeasonDates(sportId, phase.openerFromNextSeason)
    }
    return Promise.resolve(null)
  }, [phase?.openerFromNextSeason, phase?.springFromNextSeason, sportId])

  // Everything the offseason page draws itself from, or null. Held back until
  // the date it counts to is known, so the page cannot appear without its
  // countdown and then grow one under the reader a beat later.
  const winter = useMemo(() => {
    if (!phase) return null
    const forward = next.data
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
        // levels' measured starts run September 12 to September 29.
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
  }, [dateStr, isLevel, next.data, phase, seasonRow])

  // `phase` is what the slate gates its own behaviour on — it is known one
  // render before `winter` is, and "the season is over" is true whether or not
  // the date it counts to has landed yet. `winter` is what the page draws from.
  return { phase, winter }
}
