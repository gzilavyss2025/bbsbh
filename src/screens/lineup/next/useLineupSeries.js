import { gameStatusLine } from '../../../api/postseason/text.js'
import { seriesForGame } from '../../../api/postseason/bracket.js'
import { usePostseasonBracket } from '../../../hooks/postseason/usePostseasonBracket.js'
import { seriesMarkForFeed } from '../../../lib/postseason/seriesMarks.js'
import { gameSeriesHref } from '../../../lib/route.js'

// The series a postseason game belongs to: its mark, the status line ("Game 3 · Brewers
// Lead 2–0") and the series page. Null for a regular-season game or a season with no art.
// The bracket is read only for a postseason game, and it is cutoff-gated (results before
// this game's date), so nothing here knows how this game went.
export function useLineupSeries(feed, officialDate) {
  const mark = seriesMarkForFeed(feed)
  const { bracket } = usePostseasonBracket(mark ? officialDate : null)
  if (!mark) return null
  const hit = seriesForGame(bracket, feed?.gamePk)
  return {
    mark,
    gameNumber: hit?.gameNumber ?? null,
    status: gameStatusLine(hit?.series, hit?.gameNumber),
    href: gameSeriesHref(hit?.series, officialDate),
  }
}
