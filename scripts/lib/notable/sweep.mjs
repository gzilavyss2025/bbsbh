// The pure half of scripts/gen-notable.mjs, part 5: the API calls of one season.
//
// Every call goes through the `get` function it is given (the generator passes
// lib/statsapi.mjs's getJson, wrapped in a counter, and the test passes a fake), with
// fields= on every call. Every pool runs at 4 and is strict: one failed call fails the
// run, so a hole never ships as if it were a clean season. A nightly run reports the
// failure, and the file keeps its last good rows.
import { mapConcurrent } from '../concurrency.mjs'
import { buildGameMap, lastPlayedDate, otherSide, scheduleUrl } from './games.mjs'
import { cycleRows, noHitSides, noHitterRow, pitchersFromBox, triplePlayRows } from './kinds.mjs'
import { POSTSEASON_TYPES } from './rules.mjs'

export const CONCURRENCY = 4
export const PLAYERS_PER_CALL = 100
const strict = { strict: true }

const BOX_FIELDS = 'teams,away,home,pitchers,players,person,fullName'
const FIELDING_FIELDS = 'stats,splits,stat,triplePlays,game,gamePk'
const PEOPLE_FIELDS =
  'people,id,fullName,stats,splits,stat,hits,doubles,triples,homeRuns,team,isHome,game,gamePk'

// The season's game map, or null when the season has no kept game (write nothing).
export async function fetchGameMap(get, season) {
  const data = await get(scheduleUrl(season))
  const map = buildGameMap(data?.dates)
  return map.size ? map : null
}

// One fielded box score for each side that had 0 hits, for the pitchers of the side that
// threw it.
export async function fetchNoHitters(get, gameMap) {
  const todo = []
  for (const game of gameMap.values()) {
    for (const noHitSide of noHitSides(game)) todo.push({ game, noHitSide })
  }
  const rows = await mapConcurrent(
    todo,
    CONCURRENCY,
    async ({ game, noHitSide }) => {
      const box = await get(`/api/v1/game/${game.gamePk}/boxscore?fields=${BOX_FIELDS}`)
      return noHitterRow(game, noHitSide, pitchersFromBox(box, otherSide(noHitSide)))
    },
    strict,
  )
  return rows
}

// The game types a club played in a season, read off the map. The regular season is
// always asked for. The team fielding log takes ONE game type at a time (a list falls
// back to the regular season without a word), so each postseason type is its own call.
function logsToFetch(gameMap) {
  const wanted = new Map() // clubId -> Set of gameTypes
  for (const game of gameMap.values()) {
    for (const club of [game.away, game.home]) {
      if (!wanted.has(club.id)) wanted.set(club.id, new Set(['R']))
      if (POSTSEASON_TYPES.includes(game.gameType)) wanted.get(club.id).add(game.gameType)
    }
  }
  return [...wanted].flatMap(([clubId, types]) => [...types].map((type) => ({ clubId, type })))
}

export async function fetchTriplePlays(get, gameMap, season) {
  const logs = await mapConcurrent(
    logsToFetch(gameMap),
    CONCURRENCY,
    async ({ clubId, type }) => {
      const gameType = type === 'R' ? '' : `&gameType=${type}`
      const data = await get(
        `/api/v1/teams/${clubId}/stats?stats=gameLog&group=fielding&season=${season}${gameType}&fields=${FIELDING_FIELDS}`,
      )
      return triplePlayRows(data?.stats?.[0]?.splits, clubId, gameMap)
    },
    strict,
  )
  return logs.flat()
}

export async function fetchCycles(get, gameMap, season) {
  const pool = await get(`/api/v1/sports/1/players?season=${season}&fields=people,id`)
  const ids = [...new Set((pool?.people ?? []).map((p) => p.id))].sort((a, b) => a - b)
  const batches = []
  for (let i = 0; i < ids.length; i += PLAYERS_PER_CALL) batches.push(ids.slice(i, i + PLAYERS_PER_CALL))
  // gameType=[R,F,D,L,W] with brackets: a comma list falls back to the regular season.
  const hydrate = `stats(group=[hitting],type=[gameLog],season=${season},gameType=[R,F,D,L,W])`
  const found = await mapConcurrent(
    batches,
    CONCURRENCY,
    async (batch) => {
      const data = await get(`/api/v1/people?personIds=${batch.join(',')}&hydrate=${hydrate}&fields=${PEOPLE_FIELDS}`)
      return cycleRows(data?.people, gameMap)
    },
    strict,
  )
  return found.flat()
}

// One season, all three kinds. null when the season has no game to keep.
export async function sweepSeason(get, season) {
  const gameMap = await fetchGameMap(get, season)
  if (!gameMap) return null
  const [nohitters, cycles, tripleplays] = [
    await fetchNoHitters(get, gameMap),
    await fetchCycles(get, gameMap, season),
    await fetchTriplePlays(get, gameMap, season),
  ]
  return { gameMap, through: lastPlayedDate(gameMap), rows: { nohitters, cycles, tripleplays } }
}
