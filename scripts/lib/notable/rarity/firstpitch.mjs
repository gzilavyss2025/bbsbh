// The pure half of scripts/gen-notable.mjs, part 9: a home run on a player's first MLB pitch
// (#2968, slice 7).
//
// A player's first MLB plate appearance is the first one in his hitting game logs. So, per season:
// every player's hitting game log (100 players a call, as the cycles read them), his first game of
// the season with a plate appearance, and only when that game holds a home run, the game's
// play-by-play: his first plate appearance must be one pitch and a home run (the page's detector,
// src/api/notable/rarityCount.js firstPitchHomer). A player who debuted in an earlier season (a
// pitcher who first bats years later) is checked last against his year-by-year hitting line: any
// plate appearance before this season and it was not his first. Its own file,
// public/data/notable/firstpitch.json: a row is the game's head plus `player` and `side`.
//
// THE FLOOR. A one-pitch plate appearance means something only in a feed of real pitch sequences:
// every game from 2001 on (IMMACULATE_FLOOR, measured 2026-11-16; Gary, 2026-11-17). Earlier
// seasons are never swept, so the page says "since 2001".
import { firstPitchHomer } from '../../../../src/api/notable/rarityCount.js'
import { mapConcurrent } from '../../concurrency.mjs'
import { gameHead, sideOfClub } from '../games.mjs'
import { IMMACULATE_FLOOR } from '../immaculate.mjs'
import { PLAYERS_PER_CALL } from '../sweep.mjs'

export const FIRSTPITCH_FLOOR = IMMACULATE_FLOOR

const PEOPLE_FIELDS = 'people,id,fullName,mlbDebutDate,stats,splits,stat,plateAppearances,homeRuns,team,id,isHome,game,gamePk'
const PBP_FIELDS = 'allPlays,about,atBatIndex,halfInning,result,eventType,matchup,batter,id,playEvents,isPitch'
const CAREER_FIELDS = 'stats,splits,season,stat,plateAppearances'

// The candidate of one person's season log: his first game with a plate appearance among the
// kept games, when it holds a home run. null otherwise. Doubleheaders order by gameNumber.
export function firstPaCandidate(person, gameMap) {
  const splits = (person?.stats ?? []).flatMap((s) => s?.splits ?? [])
  const played = splits
    .map((s) => ({ s, game: gameMap.get(s?.game?.gamePk) }))
    .filter(({ s, game }) => game && (Number(s.stat?.plateAppearances) || 0) > 0)
    .sort((a, b) => (a.game.officialDate < b.game.officialDate ? -1 : a.game.officialDate > b.game.officialDate ? 1 : a.game.gameNumber - b.game.gameNumber))
  const first = played[0]
  if (!first || !((Number(first.s.stat?.homeRuns) || 0) > 0)) return null
  const side = sideOfClub(first.game, first.s.team?.id) ?? (first.s.isHome === true ? 'home' : first.s.isHome === false ? 'away' : null)
  if (!side) return null
  return { game: first.game, side, player: { id: person.id, name: person.fullName ?? '' }, debut: person.mlbDebutDate ?? '' }
}

// Plate appearances before `season`, from the year-by-year hitting splits.
export const priorPlateAppearances = (career, season) =>
  (career?.stats?.[0]?.splits ?? []).filter((s) => Number(s.season) < season).reduce((n, s) => n + (Number(s.stat?.plateAppearances) || 0), 0)

// { rows, unknown: [gamePk] } for one season, strict at 4 like the sweep.
export async function fetchFirstPitch(get, gameMap, season, concurrency = 4) {
  const pool = await get(`/api/v1/sports/1/players?season=${season}&fields=people,id`)
  const ids = [...new Set((pool?.people ?? []).map((p) => p.id))].sort((a, b) => a - b)
  const batches = []
  for (let i = 0; i < ids.length; i += PLAYERS_PER_CALL) batches.push(ids.slice(i, i + PLAYERS_PER_CALL))
  const hydrate = `stats(group=[hitting],type=[gameLog],season=${season},gameType=[R,F,D,L,W])`
  const found = await mapConcurrent(batches, concurrency, async (batch) => {
    const data = await get(`/api/v1/people?personIds=${batch.join(',')}&hydrate=${hydrate}&fields=${PEOPLE_FIELDS}`)
    return (data?.people ?? []).map((p) => firstPaCandidate(p, gameMap)).filter(Boolean)
  }, { strict: true })
  const checked = await mapConcurrent(found.flat(), concurrency, async (c) => {
    const pbp = await get(`/api/v1/game/${c.game.gamePk}/playByPlay?fields=${PBP_FIELDS}`)
    const hit = firstPitchHomer(pbp?.allPlays ?? [], c.player.id)
    if (hit !== true) return { c, hit }
    if (Number(String(c.debut).slice(0, 4)) === season) return { c, hit }
    const career = await get(`/api/v1/people/${c.player.id}/stats?stats=yearByYear&group=hitting&fields=${CAREER_FIELDS}`)
    return { c, hit: priorPlateAppearances(career, season) === 0 }
  }, { strict: true })
  return {
    rows: checked.filter(({ hit }) => hit === true).map(({ c }) => ({ ...gameHead(c.game), player: c.player, side: c.side })),
    unknown: checked.filter(({ hit }) => hit === null).map(({ c }) => c.game.gamePk),
  }
}
