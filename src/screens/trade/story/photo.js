import { fetchFinalScores } from '../../../api/boxlines/fetch.js'
import { MLB_LOG_GAME_TYPES } from '../../../api/boxlines/rows.js'
import { fetchGamePhotos, onlyPhotographer, photosForPlayer } from '../../../api/game/photos.js'
import { fetchPersonStats } from '../../../api/person-fetch.js'
import { newestFirst, photoCell, photoGames } from '../../player/next/modules/photos/photosView.js'

// One game photo of a player for the trade story's art: a photographer's
// still of him from his newest finished games, found the way the player
// page's Photos card walks them (modules/photos/), eight games a step and at
// most three steps. Null when none turns up: a minor leaguer, a quiet season.
const BATCH = 8
const STEPS = 3

export async function storyPhoto(id, role, season) {
  const splits = newestFirst(await fetchPersonStats(id, { type: 'gameLog', group: role, season, gameType: MLB_LOG_GAME_TYPES, sportId: 1 }))
  for (let i = 0; i < Math.min(splits.length, BATCH * STEPS); i += BATCH) {
    const batch = splits.slice(i, i + BATCH)
    const games = photoGames(batch, await fetchFinalScores(batch, role))
    // The game rides along for the caption: who he played, and whether it was the postseason.
    const split = new Map(batch.map((s) => [s.game?.gamePk, s]))
    const per = await Promise.all(games.map(async (g) => onlyPhotographer(photosForPlayer(await fetchGamePhotos(g.gamePk), id)).map((p) => ({ ...p, apiDate: g.apiDate, gamePk: g.gamePk }))))
    const first = per.flat()[0]
    if (first) {
      const sp = split.get(first.gamePk)
      return { ...photoCell(first), opponentId: sp?.opponent?.id ?? null, postseason: ['F', 'D', 'L', 'W'].includes(sp?.gameType) }
    }
  }
  return null
}
