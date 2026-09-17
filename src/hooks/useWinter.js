import { useMemo } from 'react'
import { fetchWinterCalendar } from '../api/schedule.js'
import { useAsync } from './useAsync.js'
import { WINTER_SPORT_ID, isWinterSport } from '../lib/winter/leagues.js'
import {
  defaultWinterLeagueId,
  hasWinterTab,
  leaguesOnDate,
  resolveWinterLeagueId,
  winterSeasonFor,
} from '../lib/winter/window.js'

// DOES THE RAIL CARRY A WINTER TAB TODAY? — issue #1055's one gate, lifted out
// of GameSelect for the reason useOffseason.js beside it was: the screen is at
// its budget, and a gate that owns a fetch and a derivation is a hook.
//
// The rules themselves are pure and live in src/lib/winter/window.js. This file
// is the fetch around them and the cache under it, and nothing else.
//
// THE CACHE IS THE POINT. The calendar answers a question asked on EVERY slate
// render — is there a sixth tab, and which leagues are on it — but it changes
// about once a year. Held at module scope by season, it costs one parallel
// round trip per session instead of one per day paged to. A rejected season is
// not cached, so a bad morning at statsapi does not disable the tab until the
// reader reloads the app.
const cache = new Map()

function calendarFor(season) {
  if (!season) return Promise.resolve(null)
  if (!cache.has(season)) {
    cache.set(
      season,
      fetchWinterCalendar(season).catch((err) => {
        cache.delete(season)
        throw err
      }),
    )
  }
  return cache.get(season)
}

// `sportId` and `leagueId` are what the URL asked for. The return is what the
// slate should actually draw:
//
//   tabVisible   put WINTER on the rail, second, after MLB
//   leagues      the picker's chips, in rail order, with this day's game counts
//   leagueId     the league to fetch and highlight — null off the winter tab
//   ready        the calendar has landed, so the rail can stop guessing
//
// Every one of them fails closed. Before the calendar lands, and forever if it
// never does, `tabVisible` is false and the rail is exactly what it is today.
// That is deliberate: this tab RE-ORDERS the rail, so it must appear because a
// league's published schedule says so and never because a fetch is pending.
export function useWinter(dateStr, sportId, leagueId) {
  const season = winterSeasonFor(dateStr)
  const { data, loading } = useAsync(() => calendarFor(season), [season])

  return useMemo(() => {
    const calendar = data ?? null
    const tabVisible = hasWinterTab(calendar, dateStr)
    const onWinter = isWinterSport(sportId)
    return {
      tabVisible,
      ready: !loading,
      leagues: onWinter ? leaguesOnDate(calendar, dateStr) : [],
      // A URL naming a league that is out of season on this date falls back to
      // the default rather than drawing an empty tab — a shared '/fall/12152025'
      // lands on whichever league is actually playing in December.
      leagueId: onWinter ? resolveWinterLeagueId(calendar, dateStr, leagueId) : null,
      // Where a bare tap on WINTER goes, when no league is named.
      defaultLeagueId: defaultWinterLeagueId(calendar, dateStr),
      sportId: WINTER_SPORT_ID,
    }
  }, [data, dateStr, leagueId, loading, sportId])
}
