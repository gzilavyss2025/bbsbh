// Every player's hitting game log for one season, 100 players a call. Read ONCE a season by
// sweep.mjs (#3173) and shared by every pass that starts from a player's game line (#2968): the
// cycles and four-homer games (kinds.mjs), firstpitch.mjs and itpslam.mjs.
import { mapConcurrent } from '../../concurrency.mjs'

export const PLAYERS_PER_CALL = 100

// The union of the fields those passes read. Add a field here, never a second read.
const PEOPLE_LOG_FIELDS =
  'people,id,fullName,mlbDebutDate,stats,splits,stat,hits,doubles,triples,homeRuns,rbi,plateAppearances,team,isHome,game,gamePk'

// The people of the season, each with his game log splits.
export async function fetchSeasonHittingLogs(get, season, concurrency = 4) {
  const pool = await get(`/api/v1/sports/1/players?season=${season}&fields=people,id`)
  const ids = [...new Set((pool?.people ?? []).map((p) => p.id))].sort((a, b) => a - b)
  const batches = []
  for (let i = 0; i < ids.length; i += PLAYERS_PER_CALL) batches.push(ids.slice(i, i + PLAYERS_PER_CALL))
  // gameType=[R,F,D,L,W] with brackets: a comma list falls back to the regular season.
  const hydrate = `stats(group=[hitting],type=[gameLog],season=${season},gameType=[R,F,D,L,W])`
  const people = await mapConcurrent(batches, concurrency, async (batch) => {
    const data = await get(`/api/v1/people?personIds=${batch.join(',')}&hydrate=${hydrate}&fields=${PEOPLE_LOG_FIELDS}`)
    return data?.people ?? []
  }, { strict: true })
  return people.flat()
}
