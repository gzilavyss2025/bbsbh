import { useMemo } from 'react'
import { fetchSeasonMeta } from '../../api/schedule.js'
import {
  baseballToday,
  resolveStandingsSeason,
  shiftDays,
  standingsSeasonPhase,
  standingsSeasonsFrom,
} from '../../lib/time/standingsDates.js'
import { useAsync } from '../useAsync.js'

// WHICH SEASON /standings AND /postseason-race SHOW, and whether it is over.
// Both pages answer it the same way, so it is read once here.
//
// `seasonYear` is the address's season (lib/seasons/route.js); nothing, or a year
// off the list, is the current one. The current season is final from the day the
// regular season ends, not the day the offseason opens (standingsSeasonPhase).
// Any OTHER season is final by definition.
//
// `final` means "ask statsapi for no date": the season's own closing table. An
// open season is a table dated `yesterday`, which is what keeps today's games out.
//
// `ready` is false until statsapi's season row has answered. Pages hold their
// fetch until then: in October the row is what says the dated request would come
// back empty, and asking first would flash "No standings" before the real table.
// `from` is the first season the page offers (default: the six-division era).
export function useStandingsSeason(seasonYear, { from } = {}) {
  const today = useMemo(() => baseballToday(), [])
  const yesterday = useMemo(() => shiftDays(today, -1), [today])
  const { data: seasonRow, loading } = useAsync(
    () => fetchSeasonMeta(Number(today.slice(0, 4))),
    [today],
  )
  const phase = useMemo(() => standingsSeasonPhase(today, seasonRow), [today, seasonRow])
  const season = resolveStandingsSeason(seasonYear, phase.season, from)
  const past = season !== phase.season
  const seasons = useMemo(() => standingsSeasonsFrom(phase.season, from), [phase.season, from])
  return {
    today,
    yesterday,
    ready: !loading,
    final: phase.final || past,
    past,
    season,
    current: phase.season,
    seasons,
    seasonRow,
  }
}
