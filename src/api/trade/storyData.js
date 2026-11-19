// What the trade simulator's news story reads beyond the deal itself
// (src/screens/trade/story/): the stored awards and All-Star files, both
// leagues' final standings for the season, and the postseason history. Every
// reader is the one another page already uses; each degrades to empty, so a
// missing file only drops the sentences that needed it.
import { loadAwardsHistory } from '../awards/history.js'
import { loadAllStarRosters } from '../awards/allStarRosters.js'
import { loadPostseasonHistory } from '../postseason/archive/history.js'
import { fetchLeagueStandings } from '../team/fetch.js'

// The season a story looks back on: the one just played, from October on;
// before that, the one before it.
export const storySeason = (now = new Date()) => now.getFullYear() - (now.getMonth() >= 9 ? 0 : 1)

const standingsLoad = new Map()
function standingsFor(season) {
  if (!standingsLoad.has(season)) {
    standingsLoad.set(season, fetchLeagueStandings(season).then((r) => {
      if (!r.length) standingsLoad.delete(season)
      return r
    }))
  }
  return standingsLoad.get(season)
}

export async function loadStoryData(season = storySeason()) {
  const [awards, allStars, standings, postseason] = await Promise.all([
    loadAwardsHistory().catch(() => null),
    loadAllStarRosters().catch(() => null),
    standingsFor(season).catch(() => []),
    loadPostseasonHistory().catch(() => null),
  ])
  return { season, awards, allStars, standings, postseason }
}
