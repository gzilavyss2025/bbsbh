// useGameRound(feed) \u2014 "ALDS \u00b7 Game 3" for a postseason game, '' for any other.
//
// The round name comes straight off the feed, so it is there on the first paint.
// The game number is a schedule fact the feed does not carry, so it is one small
// read (`fetchSeriesGameNumber`, by gamePk), made only for a postseason game; the
// line is just the round name until it lands, or if it fails. Both are pregame
// facts (lib/postseason/gameRound.js), so the print sheet and the preview poster
// may print them for any game, played or not.
import { useAsync } from '../useAsync.js'
import { fetchSeriesGameNumber } from '../../api/game.js'
import { feedRoundName, roundLine } from '../../lib/postseason/gameRound.js'

export function useGameRound(feed) {
  const name = feedRoundName(feed)
  const gamePk = feed?.gamePk ?? feed?.gameData?.game?.pk ?? null
  const number = useAsync(
    () => (name && gamePk ? fetchSeriesGameNumber(gamePk) : Promise.resolve(null)),
    [name, gamePk],
  )
  return roundLine(name, number.data)
}
