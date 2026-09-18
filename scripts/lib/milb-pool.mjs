// The pure half of scripts/gen-milb-pool.mjs — which season a level's pool is
// drawn from, which of its games are offered, and what the card is allowed to
// say about one. Split out because all three are decisions rather than plumbing
// and each of them can be wrong in a way a run's console output would not show
// (test/milbPool.test.js).
import { MILB_LEVELS } from '../../src/lib/teams.js'

// Low to high, ROK through AAA — the app's own order, so "up" means the same
// thing here as it does on the page that reads the board (api/minorsLeaders.js).
const RANK = new Map(MILB_LEVELS.map((level, i) => [level.sportId, i]))

// WHICH SEASON THE POOL IS DRAWN FROM: the most recent one that is OVER.
//
// `phase` is levelOffseasonPhase's reading of today against the level's own
// leagues, and it already names the season that ended — `seasonEnded` is the
// year for a winter that opened in September, and last year for one a January
// date is still inside. Only a date INSIDE a season has no phase at all, and
// then the finished season is the year before.
//
// Never "the current year": a pool built for the season being played would be
// half a season on the day the page first needs it, and would empty itself
// completely on January 1.
export function poolSeasonFor(phase, year) {
  return phase?.seasonEnded ?? year - 1
}

// A fixed shuffle, so a rebuild deals the same pool. mulberry32 — the same
// generator probe 1b used to make its sample reproducible.
function mulberry32(a) {
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// WHICH GAMES GET OFFERED. Uniformly at random, with a per-club ceiling.
//
// Uniformly, because the alternative is a pool secretly ranked by drama — and a
// card that quietly deals close games, comebacks or extra innings has read the
// results the page refuses to show, and would be telling a reader something
// about the game before they have scored a pitch of it (research.md §5.6). The
// card's reason line earns its "why this game" out of CAREERS instead.
//
// The ceiling is the one exception, and it is not about results either: a draw
// this small can seat one club a dozen times over, and a reader pressing
// "another game" should be seeing the level rather than one of its teams.
export function selectPool(games, { sportId, season, cap, max }) {
  const rnd = mulberry32(sportId * 10000 + season)
  const order = games.slice()
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  const held = new Map()
  const out = []
  for (const game of order) {
    if (out.length >= max) break
    const away = game?.teams?.away?.team?.id
    const home = game?.teams?.home?.team?.id
    if (!away || !home || !game?.officialDate) continue
    if ((held.get(away) ?? 0) >= cap || (held.get(home) ?? 0) >= cap) continue
    held.set(away, (held.get(away) ?? 0) + 1)
    held.set(home, (held.get(home) ?? 0) + 1)
    out.push(game)
  }
  return out
}

// Everyone on the season's leader boards whose season ENDED above where it
// began — the same one question api/minorsLeaders.js asks, asked here across
// every level at once because a game's roster does not care which board a
// player is on. An entry missing either end is left out rather than guessed at.
export function movedUpIds(leaders) {
  const ids = new Set()
  for (const rows of Object.values(leaders ?? {})) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      const from = RANK.get(row?.fromLevel)
      const to = RANK.get(row?.toLevel)
      if (from == null || to == null || to <= from) continue
      ids.add(Number(row.id))
    }
  }
  return ids
}

// WHAT THE CARD MAY SAY ABOUT A GAME — four counts, and every one of them is a
// fact about the people in it rather than about what happened.
//
// This is the whole reason the card can carry a "why this game" line at all. A
// score, a margin, a comeback and a walk-off are the things a scorer is here to
// discover, and none of them may be hinted at. A prospect ranking, a career
// that reached the majors and a promotion are already true before the first
// pitch and stay true whoever won — the same footing the promotions list
// beneath the card stands on.
//
// `top` names one player because a name is worth more than a number: "the No. 1
// prospect in baseball played in this game" is a reason, where "13 ranked
// prospects" is a statistic. Both are kept, and the sentence picked from them
// lives on the page side (src/api/milbPool.js) so the wording can change
// without a regeneration.
export function reasonFacts(ids, { prospects, movers, alumni, staleMovers }) {
  const played = new Set(ids)
  const ranked = new Set()
  let top = null

  for (const row of prospects?.players ?? []) {
    if (!played.has(row.playerId)) continue
    ranked.add(row.playerId)
    if (!top || row.rank < top.rank) top = { id: row.playerId, name: row.name ?? '', rank: row.rank }
  }
  for (const row of prospects?.orgProspects ?? []) {
    if (played.has(row.playerId)) ranked.add(row.playerId)
  }

  let reached = 0
  for (const id of played) if (alumni.has(id)) reached++

  // The promotions board covers ONE season. Counting its movers into a game
  // from a different season would be reading last winter's news onto an older
  // game, so that count is simply absent rather than wrong.
  let up = 0
  if (!staleMovers) for (const id of played) if (movers.has(id)) up++

  return {
    ...(top ? { top } : {}),
    ranked: ranked.size,
    reached,
    up,
  }
}
