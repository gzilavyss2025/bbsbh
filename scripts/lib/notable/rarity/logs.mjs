// Every player's hitting game log for one season, 100 players a call (as the cycles read them),
// for the rarity kinds that start from a player's game line (#2968): firstpitch.mjs, itpslam.mjs.
import { mapConcurrent } from '../../concurrency.mjs'
import { PLAYERS_PER_CALL } from '../sweep.mjs'

// The people of the season, each with his game log splits (`fields` must keep the stats path).
export async function fetchSeasonHittingLogs(get, season, fields, concurrency = 4) {
  const pool = await get(`/api/v1/sports/1/players?season=${season}&fields=people,id`)
  const ids = [...new Set((pool?.people ?? []).map((p) => p.id))].sort((a, b) => a - b)
  const batches = []
  for (let i = 0; i < ids.length; i += PLAYERS_PER_CALL) batches.push(ids.slice(i, i + PLAYERS_PER_CALL))
  // gameType=[R,F,D,L,W] with brackets: a comma list falls back to the regular season.
  const hydrate = `stats(group=[hitting],type=[gameLog],season=${season},gameType=[R,F,D,L,W])`
  const people = await mapConcurrent(batches, concurrency, async (batch) => {
    const data = await get(`/api/v1/people?personIds=${batch.join(',')}&hydrate=${hydrate}&fields=${fields}`)
    return data?.people ?? []
  }, { strict: true })
  return people.flat()
}
