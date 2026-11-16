// The pure half of scripts/gen-notable.mjs, part 7: immaculate innings (#2968, slice 3).
//
// An immaculate inning is three strikeouts on nine pitches. No game log or box score holds it,
// so this reads every game's play-by-play (about 16 KB each) with the detector the page uses
// (src/api/notable/rarityCount.js, one spelling). Its own file, public/data/notable/immaculate.json:
// a row is the game's head plus `side` (the pitching club) and `player` (the pitcher).
//
// THE FLOOR. Feeds before 1988 hold made-up minimal counts, not pitches (rarityCount.js says how
// to tell), and some 1988-1990 games still do. IMMACULATE_FLOOR is the first season with real
// sequences in every game; earlier seasons are never swept, so `coverage.seasons[0]` is the
// floor the page names ("the Nth since {floor}"). A game past the floor with no sequences is
// logged by the generator, never counted.
//
// THE COST, AND WHY THE NIGHTLY RUN IS INCREMENTAL. A season is about 2,400 calls, so the nightly
// run reads only games after the file's `through` date (Gary, 2026-11-16), and keeps the rows it
// has. A hand run with --season or --from reads every game of those seasons and replaces their rows.
import { immaculateInnings } from '../../../src/api/notable/rarityCount.js'
import { mapConcurrent } from '../concurrency.mjs'
import { gameHead } from './games.mjs'

export const IMMACULATE_FLOOR = 2000

const FIELDS = 'allPlays,about,atBatIndex,inning,halfInning,result,eventType,matchup,pitcher,id,fullName,'
  + 'playEvents,isPitch,count,balls,strikes,details,code,pitchData,startSpeed,runners,movement,end'
export const immaculateUrl = (gamePk) => `/api/v1/game/${gamePk}/playByPlay?fields=${FIELDS}`

// The rows of one game's play-by-play, or null when it has no real pitch sequences.
export function immaculateRows(game, pbp) {
  const found = immaculateInnings(pbp?.allPlays ?? [])
  return found && found.map((f) => ({ ...gameHead(game), player: f.player, side: f.side }))
}

// The games of a season this run reads: every one, or (incremental) only those after `since`.
export const gamesToRead = (gameMap, since = '') => [...gameMap.values()].filter((g) => g.officialDate > since)

// { rows, unknown: [gamePk] } for the given games, at 4, strict like the sweep.
export async function fetchImmaculate(get, games, concurrency = 4) {
  const per = await mapConcurrent(games, concurrency, async (g) => [g, immaculateRows(g, await get(immaculateUrl(g.gamePk)))], { strict: true })
  return {
    rows: per.flatMap(([, rows]) => rows ?? []),
    unknown: per.filter(([, rows]) => rows === null).map(([g]) => g.gamePk),
  }
}
