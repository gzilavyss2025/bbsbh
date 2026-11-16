// The pure half of scripts/gen-notable.mjs, part 8: four straight home runs by one club (#2968, slice 5).
//
// No game log holds the order of a club's home runs, so this reads the play-by-play, but only
// of a game where a club hit 4 or more (the team hitting game log, one call per club and game
// type, as the triple plays read the fielding log). The detector is the page's own
// (src/api/notable/rarityCount.js, one spelling). Its own file, public/data/notable/fourstraight.json:
// a row is the game's head plus `side` (the batting club), one per gamePk and side: two runs by one
// club in one game (never seen) would be one row. The merge replaces whole seasons, so the nightly
// run re-reads every candidate of the season in play (about 30 logs and 300 to 400 games late in a season).
//
// THE FLOOR. Old feeds hold no plays. A season is swept only from FOURSTRAIGHT_FLOOR on, the first
// season from which every candidate game has plays (measured 2026-11-16), so the first season of the
// unbroken swept run is the floor the page names ("the Nth since {floor}"). A candidate past the
// floor with no plays is logged by the generator, never counted.
import { fourStraightHomers } from '../../../src/api/notable/rarityCount.js'
import { mapConcurrent } from '../concurrency.mjs'
import { gameHead } from './games.mjs'
import { logsToFetch } from './sweep.mjs'

// Measured 2026-11-16 over 1901 to 2026: candidates with no plays in every season to 1957, then
// 2 in 1962 and 2 in 1966 (145717, 145927, 152390, 151905), none after. Three known runs (1961,
// 1963, 1964) sit before the floor and are not counted (Gary, 2026-11-16: never invent a count).
export const FOURSTRAIGHT_FLOOR = 1967

const LOG_FIELDS = 'stats,splits,stat,homeRuns,game,gamePk'
const PBP_FIELDS = 'allPlays,about,atBatIndex,halfInning,result,eventType'
export const fourStraightPbpUrl = (gamePk) => `/api/v1/game/${gamePk}/playByPlay?fields=${PBP_FIELDS}`

// The gamePks in `splits` (one club's hitting game log) where the club hit 4 or more home runs.
export const candidateGames = (splits, gameMap) =>
  (splits ?? []).filter((s) => (Number(s?.stat?.homeRuns) || 0) >= 4 && gameMap.has(s?.game?.gamePk)).map((s) => s.game.gamePk)

// The rows of one game's play-by-play, or null when it has no plays.
export function fourStraightRows(game, pbp) {
  const found = fourStraightHomers(pbp?.allPlays ?? [])
  return found && found.map((f) => ({ ...gameHead(game), side: f.side }))
}

// { rows, unknown: [gamePk] } for one season, at 4, strict like the sweep.
export async function fetchFourStraight(get, gameMap, season, concurrency = 4) {
  const logs = await mapConcurrent(logsToFetch(gameMap), concurrency, async ({ clubId, type }) => {
    const gameType = type === 'R' ? '' : `&gameType=${type}`
    const data = await get(`/api/v1/teams/${clubId}/stats?stats=gameLog&group=hitting&season=${season}${gameType}&fields=${LOG_FIELDS}`)
    return candidateGames(data?.stats?.[0]?.splits, gameMap)
  }, { strict: true })
  const games = [...new Set(logs.flat())].map((pk) => gameMap.get(pk))
  const per = await mapConcurrent(games, concurrency, async (g) => [g, fourStraightRows(g, await get(fourStraightPbpUrl(g.gamePk)))], { strict: true })
  return {
    rows: per.flatMap(([, rows]) => rows ?? []),
    unknown: per.filter(([, rows]) => rows === null).map(([g]) => g.gamePk),
  }
}
