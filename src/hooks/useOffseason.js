import { useMemo } from 'react'
import { fetchSeasonMeta } from '../api/schedule.js'
import { useAsync } from './useAsync.js'
import { offseasonPhase } from '../lib/time/seasonPhase.js'
import { SPORT_IDS } from '../lib/teams.js'

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
// MLB ONLY, for now. The four MiLB tabs go dark far longer than MLB's does —
// measured across 2025-26, the MLB tab had no played game for 110 days against
// 175 for AAA, 179 for AA and 196-197 for the two A levels — but the row read
// here is sportId 1's, and a minor level's offseason has three leagues finishing
// on three different dates. That is step 3 of the issue, and it is gated on work
// this does not do.
//
// `seasonRow` is passed in rather than fetched: the slate already asks for it on
// any empty day (it is the same row the All-Star break bounds come off), so the
// offseason page costs an empty day no fetch it was not already spending.
export function useOffseason(dateStr, sportId, seasonRow) {
  const phase = useMemo(
    () => (sportId === SPORT_IDS.MLB ? offseasonPhase(dateStr, seasonRow) : null),
    [dateStr, seasonRow, sportId],
  )

  // November and December read forward one row for the two dates the winter
  // calendar is allowed to state as fact — spring training's first game and
  // Opening Day. January through February needs no second call: statsapi rolls
  // the season over on January 1, so by then both are on the row already in
  // hand. Verified live that a season's row is published well before its year
  // is (2027's existed in September 2026).
  const nextSeason = useAsync(
    () =>
      phase?.springFromNextSeason
        ? fetchSeasonMeta(phase.springFromNextSeason)
        : Promise.resolve(null),
    [phase?.springFromNextSeason],
  )

  // Everything the offseason page draws itself from, or null. Held back until
  // the spring date is known, so the page cannot appear without its countdown
  // and then grow one under the reader a beat later.
  const winter = useMemo(() => {
    if (!phase) return null
    const next = nextSeason.data
    // True in January and February, when the row in hand is already NEXT
    // season's and carries both dates itself.
    const rolledOver = Boolean(phase.springStartDate)
    const springStartDate = phase.springStartDate ?? next?.springStartDate ?? null
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
        (rolledOver ? seasonRow?.regularSeasonStartDate : next?.regularSeasonStartDate) ?? null,
    }
  }, [dateStr, nextSeason.data, phase, seasonRow])

  // `phase` is what the slate gates its own behaviour on — it is known one
  // render before `winter` is, and "the season is over" is true whether or not
  // the spring date has landed yet. `winter` is what the page draws from.
  return { phase, winter }
}
