// The pure half of scripts/gen-notable.mjs, part 10: inside-the-park grand slams (#2968, slice 8).
//
// No game log marks one. A grand slam drives in four on one swing, so a player's game line with a
// home run and 4 or more RBI is the candidate (every player's hitting log, firstpitch.mjs's read),
// and only those games' play-by-play is read, with the page's detector (src/api/notable/rarityCount.js
// insideParkSlams: a home run with 4 RBI whose play text says inside-the-park). About 300 games a
// season against 2,400 for every game. Its own file, public/data/notable/itpslam.json: a row is the
// game's head plus `player` (the batter) and `side` (his club).
//
// THE FLOOR. 2001, as the immaculate innings (Gary, 2026-11-17): the play text of the older feeds
// was never measured, so the page says "since 2001" and never invents an older count.
import { insideParkSlams } from '../../../../src/api/notable/rarityCount.js'
import { mapConcurrent } from '../../concurrency.mjs'
import { gameHead } from '../games.mjs'
import { IMMACULATE_FLOOR } from '../immaculate.mjs'
import { fetchSeasonHittingLogs } from './logs.mjs'

export const ITPSLAM_FLOOR = IMMACULATE_FLOOR

const PBP_FIELDS = 'allPlays,about,atBatIndex,halfInning,result,eventType,rbi,description,matchup,batter,id,fullName'

// The kept gamePks where one of `people` homered and drove in 4 or more.
export function slamCandidates(people, gameMap) {
  const pks = new Set()
  for (const person of people ?? []) {
    for (const s of (person?.stats ?? []).flatMap((x) => x?.splits ?? [])) {
      if ((Number(s?.stat?.homeRuns) || 0) >= 1 && (Number(s?.stat?.rbi) || 0) >= 4 && gameMap.has(s?.game?.gamePk)) pks.add(s.game.gamePk)
    }
  }
  return [...pks]
}

// { rows, unknown: [gamePk] } for one season, strict at 4 like the sweep.
// `people` is the season's hitting logs (sweep.mjs's one read); fetched here only when not given.
export async function fetchItpSlams(get, gameMap, season, people = null, concurrency = 4) {
  people ??= await fetchSeasonHittingLogs(get, season, undefined, concurrency)
  const games = slamCandidates(people, gameMap).map((pk) => gameMap.get(pk))
  const per = await mapConcurrent(games, concurrency, async (g) => {
    const found = insideParkSlams((await get(`/api/v1/game/${g.gamePk}/playByPlay?fields=${PBP_FIELDS}`))?.allPlays ?? [])
    return [g, found && found.map((f) => ({ ...gameHead(g), player: f.player, side: f.side }))]
  }, { strict: true })
  return {
    rows: per.flatMap(([, rows]) => rows ?? []),
    unknown: per.filter(([, rows]) => rows === null).map(([g]) => g.gamePk),
  }
}
