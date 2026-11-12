// The pure half of scripts/gen-notable.mjs, part 6: the rarity flags (#2968).
//
// A cycle row gets `natural` and a triple play row gets `unassisted`, read off the game's
// play-by-play with the detectors the page uses (src/api/notable/rarityCount.js, one spelling).
// A game whose feed has no plays (most games before the 1950s) gets no flag at all: an unknown
// is not a false, and the page counts only from the year every later row is flagged.
import { gameHasUnassistedTriplePlay, isNaturalCycle } from '../../../src/api/notable/rarityCount.js'
import { mapConcurrent } from '../concurrency.mjs'

const PBP_FIELDS = 'allPlays,about,atBatIndex,halfInning,result,eventType,matchup,batter,id,runners,credits,player,credit'
export const pbpUrl = (gamePk) => `/api/v1/game/${gamePk}/playByPlay?fields=${PBP_FIELDS}`

// The row with its flag, from that game's play-by-play; the row unchanged when the flag is unknown.
export function flagRow(kind, row, pbp) {
  const plays = pbp?.allPlays ?? []
  const v = kind === 'cycles' ? isNaturalCycle(plays, row.player?.id) : gameHasUnassistedTriplePlay(plays, row.side)
  const { natural, unassisted, ...rest } = row
  if (v === null) return rest
  return kind === 'cycles' ? { ...rest, natural: v } : { ...rest, unassisted: v }
}

// Every row of one kind, flagged. One play-by-play call per game, at 4, strict like the sweep.
export async function flagRows(get, kind, rows, concurrency = 4) {
  const games = [...new Set(rows.map((r) => r.gamePk))]
  const pbps = new Map(
    await mapConcurrent(games, concurrency, async (pk) => [pk, await get(pbpUrl(pk))], { strict: true }),
  )
  return rows.map((r) => flagRow(kind, r, pbps.get(r.gamePk)))
}
