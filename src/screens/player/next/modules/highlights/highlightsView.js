// The Highlights module's pure view (#2022): his clips for this season, newest first.
import { formatClipDuration } from '../../../../../api/highlights.js'
import { baseballToday } from '../../../../../lib/time/standingsDates.js'
import { plural } from '../../parts/foulsFormat.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A clip title names the play ("walk-off single"), so a game dated the baseball day never shows one (ADR-0110):
// the nightly file keeps Final games only, but a hand-dispatched run can put today's in. This filters; it adds no source.
export function highlightsView({ clips, playerId, season, now = new Date() }) {
  const today = baseballToday(now)
  return clips
    .filter((c) => c.playerId === playerId && c.date.slice(0, 4) === String(season) && c.date < today)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((c) => ({
      clipId: c.clipId,
      clip: c,
      title: c.title || '',
      length: formatClipDuration(c.duration),
      when: `${MONTHS[Number(c.date.slice(5, 7)) - 1]} ${Number(c.date.slice(8, 10))}`,
    }))
}

export const clipsTag = (n) => plural(n, 'clip')
