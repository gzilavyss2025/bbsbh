// The pure half of scripts/gen-notable.mjs, part 3: the three kinds of feat.
//
// A row is the game's head (games.mjs gameHead) plus the kind's own fields. Nothing
// else about the game goes in: no inning line, no hit totals, no other players (D5).
import { gameHead, otherSide, sideOfClub } from './games.mjs'

const count = (v) => (typeof v === 'number' ? v : Number(v) || 0)

// ---- no-hitters (D8) ----

// A side with 0 hits in a played game with innings. A missing hit total is not a zero
// (the old linescores that lack it must not read as no-hitters), and a game with no
// innings was not played, whatever its state says.
export function noHitSides(game) {
  if (game.innings.length === 0) return []
  return ['away', 'home'].filter((side) => game[side].hits === 0)
}

// How many innings the no-hit club batted. The away club bats in every inning listed.
// The home club skips the bottom of the last inning when it is already ahead, and the
// feed leaves `runs` off that half (Larsen, gamePk 67524: the home 9th has `hits: 0`
// and no `runs`). A club that batted fewer than 9 innings was thrown against for fewer
// than 9: the game is "shortened", whatever the reason (a 7-inning doubleheader game, rain,
// or a home club that never needed its last turn).
export function battedInnings(game, side) {
  if (side === 'away') return game.innings.length
  return game.innings.filter((i) => typeof i?.home?.runs === 'number').length
}

// Pitchers of one side, in the order the box score lists them. Name is '' when the
// box score has the id and not the person.
export function pitchersFromBox(box, side) {
  const team = box?.teams?.[side]
  const ids = Array.isArray(team?.pitchers) ? team.pitchers : []
  return ids.map((id) => ({ id, name: team?.players?.[`ID${id}`]?.person?.fullName ?? '' }))
}

// `noHitSide` is the club that had 0 hits. The row's `side` is the club that threw it.
// `shortened` and `lost` are written only when true.
export function noHitterRow(game, noHitSide, pitchers) {
  const thrower = otherSide(noHitSide)
  const lost = (game[thrower].runs ?? 0) < (game[noHitSide].runs ?? 0)
  return {
    ...gameHead(game),
    side: thrower,
    pitchers,
    ...(battedInnings(game, noHitSide) < 9 ? { shortened: true } : {}),
    ...(lost ? { lost: true } : {}),
  }
}

// ---- cycles ----

// 4 or more hits, with at least one single, one double, one triple and one home run.
// Singles are hits minus the extra-base hits. Five hits with a cycle in them is a cycle.
export function isCycle(stat) {
  const hits = count(stat?.hits)
  const doubles = count(stat?.doubles)
  const triples = count(stat?.triples)
  const homers = count(stat?.homeRuns)
  const singles = hits - doubles - triples - homers
  return hits >= 4 && singles >= 1 && doubles >= 1 && triples >= 1 && homers >= 1
}

// A four-homer game (#2968, the rarity count): 4 or more home runs in one game.
export const isFourHomer = (stat) => count(stat?.homeRuns) >= 4

// The rows of a batch of `people` (the hydrate=stats gameLog response) whose game line
// passes `test`. A feat counts once for each player and gamePk. A split for a game the map
// does not hold (not played, not AL or NL, or not a game type we keep) is dropped.
function gameLogRows(people, gameMap, test) {
  const rows = new Map()
  for (const person of people ?? []) {
    for (const stats of person?.stats ?? []) {
      for (const split of stats?.splits ?? []) {
        const game = gameMap.get(split?.game?.gamePk)
        if (!game || !test(split.stat)) continue
        const side =
          sideOfClub(game, split.team?.id) ?? (split.isHome === true ? 'home' : split.isHome === false ? 'away' : null)
        if (!side) continue
        const key = `${game.gamePk}:${person.id}`
        if (rows.has(key)) continue
        rows.set(key, { ...gameHead(game), player: { id: person.id, name: person.fullName ?? '' }, side })
      }
    }
  }
  return [...rows.values()]
}

export const cycleRows = (people, gameMap) => gameLogRows(people, gameMap, isCycle)
export const fourHomerRows = (people, gameMap) => gameLogRows(people, gameMap, isFourHomer)

// ---- triple plays and six-plus double plays ----

// The club in a team fielding game log is the fielding side, so its id says which side
// turned the play. `triplePlays` greater than 0 for a gamePk is a triple play; `doublePlays`
// of 6 or more is a six-plus double play game (#2968, slice 6).
const fieldingRows = (test) => (splits, clubId, gameMap) => {
  const rows = new Map()
  for (const split of splits ?? []) {
    if (!test(split?.stat)) continue
    const game = gameMap.get(split?.game?.gamePk)
    const side = game ? sideOfClub(game, clubId) : null
    if (!side) continue
    const key = `${game.gamePk}:${side}`
    if (!rows.has(key)) rows.set(key, { ...gameHead(game), side })
  }
  return [...rows.values()]
}

export const triplePlayRows = fieldingRows((stat) => count(stat?.triplePlays) > 0)
export const sixDoublePlayRows = fieldingRows((stat) => count(stat?.doublePlays) >= 6)
