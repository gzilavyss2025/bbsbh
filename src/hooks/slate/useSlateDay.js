import { useEffect, useMemo, useState } from 'react'
import { preload } from 'react-dom'
import {
  fetchLevelSeasonDates,
  fetchSchedule,
  fetchSeasonMeta,
  fetchTeams,
  fetchWinterCalendar,
} from '../../api/schedule/fetch.js'
import { fetchAffiliates } from '../../api/team/fetch.js'
import { fetchLevelCounts } from '../../api/slate/levelCounts.js'
import { initialSlateDay, loadSlateDay } from '../../lib/slate/day.js'
import { readSeasonRow, saveSeasonRow } from '../../lib/time/seasonRows.js'
import { MVP_PHOTOS, MVP_PHOTO_SIZES, mvpPhotoSrcSet, mvpPhotoUrl } from '../../lib/postseason/mvpLine.js'
import { SPORT_IDS } from '../../lib/teams.js'

// The thin React half of the slate-day loader (lib/slate/day.js, #3035): it wires the real
// fetchers in, keeps the latest value, and re-reads the ladder counts on foreground.

// The winter calendar changes about once a year, so it is held per season for the session.
// A rejected season is not cached, so a bad morning does not hide the tab until a reload.
const calendars = new Map()
function calendarFor(season) {
  if (!season) return Promise.resolve(null)
  if (!calendars.has(season)) {
    calendars.set(
      season,
      fetchWinterCalendar(season).catch((err) => {
        calendars.delete(season)
        throw err
      }),
    )
  }
  return calendars.get(season)
}

const FETCHERS = {
  fetchSeasonMeta,
  fetchSchedule,
  fetchTeams,
  fetchAffiliates,
  fetchLevelCounts,
  fetchLevelSeasonDates,
  fetchWinterCalendar: calendarFor,
  readSeasonRow,
  saveSeasonRow,
}

export function useSlateDay({ dateStr, sportId, leagueId = null, favoriteTeamId = null }) {
  const key = `${dateStr}|${sportId}|${leagueId}|${favoriteTeamId}`
  const first = useMemo(
    () => initialSlateDay({ dateStr, sportId, leagueId, favoriteTeamId }, readSeasonRow),
    [dateStr, sportId, leagueId, favoriteTeamId],
  )
  const [state, setState] = useState({ key, value: first, ctl: null })

  useEffect(() => {
    // The loader reports its first value synchronously, before it has returned its controls.
    let ctl = null
    ctl = loadSlateDay({ dateStr, sportId, leagueId, favoriteTeamId }, FETCHERS, (value) =>
      setState({ key, value, ctl }),
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, ctl }))
    const onVisible = () => {
      if (document.visibilityState === 'visible') ctl.reload('counts')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      ctl.cancel()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key, dateStr, sportId, leagueId, favoriteTeamId])

  // The render where the key changes still holds the last key's value: answer the fresh one (#2925).
  const value = state.key === key ? state.value : first
  const ctl = state.key === key ? state.ctl : null

  // The MLB winter opens on the champion hero, whose photo URL is static: start it now, not after
  // the hero's chunk and the postseason schedule land (its LCP, #3042). React dedupes the call.
  const pick = sportId === SPORT_IDS.MLB ? MVP_PHOTOS[value.offseason.phase?.seasonEnded] : null
  if (pick) preload(mvpPhotoUrl(pick.id), { as: 'image', imageSrcSet: mvpPhotoSrcSet(pick.id), imageSizes: MVP_PHOTO_SIZES, fetchPriority: 'high' })

  return { ...value, reloadSlate: () => ctl?.reload('slate') }
}
