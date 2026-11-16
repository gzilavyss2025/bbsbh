// The pure half of scripts/gen-notable.mjs, part 7: immaculate innings (#2968, slice 3).
//
// An immaculate inning is three strikeouts on nine pitches. No game log or box score holds it,
// so this reads every game's play-by-play (about 16 KB each) with the detector the page uses
// (src/api/notable/rarityCount.js, one spelling). Its own file, public/data/notable/immaculate.json:
// a row is the game's head plus `side` (the pitching club) and `player` (the pitcher).
//
// THE FLOOR. Feeds before 1988 hold made-up minimal counts, not pitches (rarityCount.js says how
// to tell), and every season from 1988 to 2000 still has such games (30 to 228 a season, measured
// 2026-11-16); the 1990s also fill missing innings with made-up swinging strikes. 2001 is the
// first season with real sequences in every game, through 2026. Earlier seasons are never swept,
// so the first season of the unbroken swept run is the floor the page names ("the Nth since
// {floor}"). A game past the floor with no sequences is logged by the generator, never counted.
//
// THE COST, AND WHY THE NIGHTLY RUN IS INCREMENTAL. A season is about 2,400 calls, so the nightly
// run reads only the games of the last REREAD_DAYS before the file's `through` and after it (Gary,
// 2026-11-16): a game still going when `through` was set is read again on the next nights. Rows in
// that window are replaced, so a corrected pitcher credit leaves no ghost row (scripts/CLAUDE.md,
// the reassignable-merge rule); a row older than the window keeps its key until a hand run of its
// season, because the feed's pitch record of a game days old does not change in practice. A hand
// run (--season, --from or --to) reads every game of those seasons and replaces their rows. A
// suspended game resumed weeks later under its first date waits for that hand run.
import { immaculateInnings } from '../../../src/api/notable/rarityCount.js'
import { mapConcurrent } from '../concurrency.mjs'
import { gameHead } from './games.mjs'
import { sortRows } from './merge.mjs'

export const IMMACULATE_FLOOR = 2001

const FIELDS = 'allPlays,about,atBatIndex,inning,halfInning,result,eventType,matchup,pitcher,id,fullName,'
  + 'playEvents,isPitch,count,balls,strikes,details,code,pitchData,startSpeed,runners,movement,start,end'
export const immaculateUrl = (gamePk) => `/api/v1/game/${gamePk}/playByPlay?fields=${FIELDS}`

// The rows of one game's play-by-play, or null when it has no real pitch sequences.
export function immaculateRows(game, pbp) {
  const found = immaculateInnings(pbp?.allPlays ?? [])
  return found && found.map((f) => ({ ...gameHead(game), player: f.player, side: f.side }))
}

export const REREAD_DAYS = 3

// The first date this run reads in `season`: '' (every game) for a hand run or a season the file
// has not swept, else REREAD_DAYS before the file's `through`. `parsed` is the generator's flags.
export function readFrom(parsed, coverage, season) {
  const hand = parsed.season !== undefined || parsed.from !== undefined || parsed.to !== undefined
  if (hand || !coverage?.seasons?.includes(season) || !coverage.through) return ''
  const d = new Date(`${coverage.through}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - REREAD_DAYS)
  return d.toISOString().slice(0, 10)
}

// The games of a season this run reads: those on or after `from` ('' is every one).
export const gamesToRead = (gameMap, from = '') => [...gameMap.values()].filter((g) => g.officialDate >= from)

// The file's rows with the read window replaced: every row on or after `from` gives way to `fresh`.
// A full read of a season passes the season's rows through the season merge instead (gen-notable).
export const mergeWindow = (prev, from, fresh) =>
  sortRows('immaculate', [...(from ? prev.filter((r) => r.officialDate < from) : []), ...fresh])

// { rows, unknown: [gamePk] } for the given games, at 4, strict like the sweep.
export async function fetchImmaculate(get, games, concurrency = 4) {
  const per = await mapConcurrent(games, concurrency, async (g) => [g, immaculateRows(g, await get(immaculateUrl(g.gamePk)))], { strict: true })
  return {
    rows: per.flatMap(([, rows]) => rows ?? []),
    unknown: per.filter(([, rows]) => rows === null).map(([g]) => g.gamePk),
  }
}
