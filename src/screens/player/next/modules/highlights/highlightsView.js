// The Highlights module's pure view (#2022): his clips for this season, newest first.
import { formatClipDuration } from '../../../../../api/highlights.js'
import { plural } from '../../parts/foulsFormat.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A clip title names the play ("walk-off single"). The page is open for a game played today
// (ADR-0117, which retired ADR-0110), so no date filter is applied. gen-highlights.mjs sweeps
// only games the schedule calls Final, whether it runs on the cron or by hand, so the file
// holds no clip of a game still on.
export function highlightsView({ clips, playerId, season }) {
  return clips
    .filter((c) => c.playerId === playerId && c.date.slice(0, 4) === String(season))
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
