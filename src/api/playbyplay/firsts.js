// "First X in the game" finders that scan the raw feed directly (not the
// per-half `entries` output) — the game's first run, each batter's first
// plate appearance, and each batter's first plate appearance with a runner
// in scoring position — feeding the call-outs in api/callout-notes.js. See
// ../playbyplay.js's header for the module's overall spoiler footing. Split
// (ADR-0038, check-file-size.mjs) out of src/api/playbyplay.js.

import { BASE_NUM } from './shared.js'
import { NON_PA_EVENT_TYPES, GAME_ADVISORY_EVENT_TYPE } from './eventTypes.js'

// All three finders are cached per feed OBJECT (WeakMap, `has` so a null
// result caches too), the same pattern as select.js's entryIndexById: a
// Refresh mints a new feed and rebuilds, a bare re-render reuses. They are
// pure whole-game walks keyed on nothing but the feed, and PlayByPlay calls
// every one at render top-level of the most re-rendered component in the app
// — each "Next at-bat" tap re-walked the entire game several times over for
// answers that cannot change without a refetch. Reveal-only footing is
// untouched: caching a result changes WHO may call nothing (ADR-0007's
// feed-keyed-cache rule, applied module-side). Callers must not mutate the
// returned Maps — they are shared across renders now.
function feedCached(cache, feed, build) {
  if (!feed || typeof feed !== 'object') return build(feed)
  if (cache.has(feed)) return cache.get(feed)
  const result = build(feed)
  cache.set(feed, result)
  return result
}

// The play that scored the GAME's first run, for the "scoring first" call-out —
// the earliest play (by feed order) whose cumulative score first goes above 0.
// `result.awayScore`/`homeScore` are the running totals AFTER the play (verified
// against a live game). Returns { atBatIndex, side } where side ('away' | 'home')
// is the team that scored (the batting side of that half), or null before any
// run. Reveal-only, like the rest of this module — reads scoring state.
const firstRunCache = new WeakMap()
export function firstRunPlay(feed) {
  return feedCached(firstRunCache, feed, buildFirstRunPlay)
}

function buildFirstRunPlay(feed) {
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const r = p.result ?? {}
    if ((r.awayScore ?? 0) + (r.homeScore ?? 0) > 0) {
      return {
        atBatIndex: p.about?.atBatIndex ?? null,
        side: p.about?.halfInning === 'bottom' ? 'home' : 'away',
      }
    }
  }
  return null
}

// atBatIndex of each batter's FIRST plate appearance in the whole game, so a
// "coming into today" note (a streak) can render once — on his first card —
// rather than every inning he bats. Reveal-only, like the rest of this module.
const firstPACache = new WeakMap()
export function firstPAIndexByBatter(feed) {
  return feedCached(firstPACache, feed, buildFirstPAIndexByBatter)
}

function buildFirstPAIndexByBatter(feed) {
  const first = new Map()
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const bid = p.matchup?.batter?.id
    if (
      bid == null ||
      NON_PA_EVENT_TYPES.has(p.result?.eventType) ||
      p.result?.eventType === GAME_ADVISORY_EVENT_TYPE
    )
      continue
    if (!first.has(bid)) first.set(bid, p.about?.atBatIndex ?? null)
  }
  return first
}

// atBatIndex of each batter's FIRST plate appearance with a runner actually
// on 2nd or 3rd as he stepped in — the RISP call-out (api/callout-notes.js)
// describes a season rate, but firing it on a batter's literal first PA
// regardless of who's on base (as firstPAIndexByBatter does for the streak/
// platoon/birthday notes) reads as a non sequitur when he leads off an inning
// with the bases empty. A plain re-walk of `runners[]` per play, base
// occupancy reset at each half-inning boundary — same idiom as
// umpireFavor.js's `bases`/`BASE_NUM` walk, just at play (not pitch)
// granularity. Reveal-only, like the rest of this module.
const firstRispPACache = new WeakMap()
export function firstRispPAIndexByBatter(feed) {
  return feedCached(firstRispPACache, feed, buildFirstRispPAIndexByBatter)
}

function buildFirstRispPAIndexByBatter(feed) {
  const first = new Map()
  const bases = [null, null, null]
  let curHalfKey = null
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const inning = p.about?.inning
    const half = p.about?.halfInning
    if (inning == null || half == null) continue
    const halfKey = `${inning}-${half}`
    if (halfKey !== curHalfKey) {
      bases[0] = bases[1] = bases[2] = null
      curHalfKey = halfKey
    }

    const bid = p.matchup?.batter?.id
    const isRealPA =
      bid != null &&
      !NON_PA_EVENT_TYPES.has(p.result?.eventType) &&
      p.result?.eventType !== GAME_ADVISORY_EVENT_TYPE
    if (isRealPA && (bases[1] || bases[2]) && !first.has(bid)) {
      first.set(bid, p.about?.atBatIndex ?? null)
    }

    for (const r of p.runners ?? []) {
      const startBase = BASE_NUM[r.movement?.start]
      const endBase = BASE_NUM[r.movement?.end]
      if (startBase && startBase <= 3) bases[startBase - 1] = null
      if (!r.movement?.isOut && endBase && endBase <= 3) bases[endBase - 1] = r.details?.runner?.id ?? null
    }
  }
  return first
}

// (Times-through-the-order counting used to live here as a per-PA map; the
// per-play note it fed was replaced by the pre-half strip's single persistent
// card, which does its own prior-halves walk — see buildThirdTimeThroughNote
// in api/callout-notes.js.)
