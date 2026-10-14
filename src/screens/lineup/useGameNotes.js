import { useEffect, useMemo } from 'react'
import { selectGameInfo, selectTeamMeta } from '../../api/select.js'
import { resolveGameNotes } from '../../api/gameNotes.js'
import { useAsync } from '../../hooks/useAsync.js'

// A club's official pre-game press notes (a PDF) for this game, or null. MLB only, and null
// when there is no note to link (every MiLB game, or a date the club never posted). The
// note posts in the afternoon or evening ET, after the page first loads, so on the game's own
// day with no note yet this re-checks every few minutes; once a note is in hand the poll
// stops. Past games never gain a note, so they do not poll (api/gameNotes.js has the gate).

// How often to re-check for a not-yet-posted note.
const NOTES_POLL_MS = 5 * 60 * 1000
// Today's calendar date in America/New_York: the zone the game's officialDate and the notes'
// publish dates are keyed to.
const ET_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
const etToday = () => ET_TODAY.format(new Date())

export function useGameNotes(feed, side) {
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const info = useMemo(() => selectGameInfo(feed), [feed])
  const isMlb = (meta.sportId ?? 1) === 1
  const { data: notes, reload } = useAsync(
    () => (isMlb && meta.id ? resolveGameNotes(meta.id, info.officialDate) : Promise.resolve(null)),
    [isMlb, meta.id, info.officialDate],
  )
  const isGameDay = isMlb && !!info.officialDate && info.officialDate === etToday()
  useEffect(() => {
    if (!isGameDay || notes?.url) return
    const id = setInterval(reload, NOTES_POLL_MS)
    return () => clearInterval(id)
  }, [isGameDay, notes?.url, reload])
  return notes?.url ? notes : null
}
