// The checked pool of minor-league games the offseason page deals its
// picked-game card from (issue #1077), read from a static same-origin file —
// public/data/milb-pool/{sportId}.json, one per level.
//
// SPOILER-FREE, AND THE FILE IS WHY. The card's whole job is to offer a game
// from a season that is over, which is the one place a static file could hand a
// page a result without anyone noticing. So the generator stores no score, no
// run total, no winner and no inning count (scripts/gen-milb-pool.mjs says what
// it reads and drops), and this module has no derivation that could reconstruct
// one: an entry is two clubs, a date, a park and a count of the careers in it.
// The game it links to opens sealed like any other, through the same route the
// slate's cards use and under the same `revealedThrough` mark.
//
// WHY ANY OF IT IS STORED AT ALL. "Here is a game, score it" is a promise, and a
// minor-league schedule row cannot keep it: at High-A every row of a 1,980-game
// season says "Final", postponements included. Whether a game was played, and
// whether its feed can carry the scoring flow, is a question per game — 120 of
// them, at 17 KB a call, which is a build-time job and never a page load.
import { staticJsonBy } from './staticJson.js'
import { gamePath } from '../lib/route.js'

export const fetchMilbPool = staticJsonBy((sportId) => `/data/milb-pool/${sportId}.json`, {
  shape: (d) => ({
    // Carried so the page can check the pool is about the season it is naming.
    // A level's winter opens before the night's generator run, so for a few
    // hours the file on disk is last year's — and a card offering a game from a
    // season the page is not about is worse than no card.
    season: Number(d?.season) || null,
    games: Array.isArray(d?.games) ? d.games : [],
  }),
  fallback: { season: null, games: [] },
})

// A fixed shuffle, so one day deals one game. Same mulberry32 the generator
// uses to pick the pool in the first place.
function mulberry32(a) {
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A small stable number out of a string — the seed a caller builds from the day
// and the level, so the same visit on the same day is offered the same game.
export function seedFrom(text) {
  let h = 2166136261
  for (let i = 0; i < String(text).length; i++) {
    h ^= String(text).charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// WHICH GAME IS OFFERED, and it is not Math.random().
//
// A random pick per render deals a different game every time React re-runs the
// component — in StrictMode, twice before the reader has seen either. So the
// order is a fixed shuffle of a seed the caller owns (the day and the level),
// and "another game" walks it. One day offers one game; pressing the control
// moves through the same deck in the same order, and coming back tomorrow deals
// a new one.
//
// IT SKIPS GAMES THE READER HAS ALREADY OPENED. The offer is a fresh sealed
// game, and a game with a reveal mark on it is not one — its innings are
// already unsealed and the invitation would be a lie the moment it was taken up
// (research.md §5.5). `isStarted` is the caller's read of local state, because
// this module does not touch storage. If EVERY game in the pool has been
// started — a reader who has scored 120 games in one winter — the deck is dealt
// anyway and `started` says so, rather than the card disappearing on the
// heaviest user it has.
export function pickGame(games, { seed = 0, step = 0, isStarted = null } = {}) {
  const pool = (Array.isArray(games) ? games : []).filter(
    (g) => g?.pk && g?.date && g?.away?.abbr && g?.home?.abbr,
  )
  if (pool.length === 0) return null

  const rnd = mulberry32(seed)
  const order = pool.slice()
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  const unstarted = isStarted ? order.filter((g) => !isStarted(g.pk)) : order
  const deck = unstarted.length > 0 ? unstarted : order
  const at = ((step % deck.length) + deck.length) % deck.length
  return { game: deck[at], started: unstarted.length === 0, total: deck.length }
}

// WHY THIS GAME — one sentence, and every version of it is a fact about the
// people in the game rather than about what happened in it.
//
// This is the line that makes the card an invitation instead of a lottery. It
// is also the line the spoiler rule has to be able to read and approve: a
// prospect ranking, a career that reached the majors and a promotion are all
// true before the first pitch and stay true whoever won. The card would be
// easier to write and impossible to ship if it could say "a one-run game" or
// "eleven innings", and it says neither.
//
// The strongest fact wins, and a NAME outranks a count: "Jesús Made played in
// this game" is a reason to open it, where "six ranked prospects" is a
// statistic about it. Below the name the order is how much a reader can do with
// the fact — a career that reached the top, then the board, then the climb.
//
// Null when the pool's fuel has nothing to say about a game, which is a real
// state and not an error: an older season's pool watches its prospects graduate
// off the board (measured on Triple-A 2025 — 50 of 120 games have no fact left
// at all), and the card then shows the game with no reason line rather than
// inventing one.
export function reasonLine(why) {
  if (!why) return null
  if (why.top?.name && why.top?.rank) {
    return `${why.top.name} played in this game, No. ${why.top.rank} on the national prospect board.`
  }
  if (why.reached >= 2) return `${why.reached} players in this game reached the majors.`
  if (why.ranked >= 2) return `${why.ranked} ranked prospects played in this game.`
  if (why.up >= 2) return `${why.up} players in this game finished the season at a higher level.`
  if (why.reached === 1) return 'One player in this game reached the majors.'
  if (why.ranked === 1) return 'One ranked prospect played in this game.'
  if (why.up === 1) return 'One player in this game finished the season at a higher level.'
  return null
}

// The game's own first lineup page — the same address the slate's cards build,
// so the card is a shortcut to an ordinary game and not a second way in. `g` is
// the doubleheader's game number, absent on the ordinary game that is game 1
// (matchupSlug's own convention).
export function poolGamePath(game, section = 'lineup1') {
  if (!game) return '/'
  return gamePath(game.date, game.away.abbr, game.home.abbr, section, game.g ?? 1)
}
