// Pure parts of scripts/gen-run-expectancy.mjs, so tests can import them (a
// generator is a top-level script: importing it RUNS it). `accumulateGame` is the
// per-game walk, moved here unchanged; the rest build and merge the per-season
// checkpoints behind `--era-sweep` / `--era-aggregate`.
import { mapConcurrent } from '../concurrency.mjs'
import { stateKey, re24Key, ERA_FIRST, ERA_LAST } from '../../../src/lib/runExpectancy.js'

const BASE_NUM = { '1B': 1, '2B': 2, '3B': 3 }

// Accumulate one game's plate appearances into the running state sums. Adds
// { sum, n } into both `states` (288-bucket) and `re24` (24-bucket) Maps.
export function accumulateGame(feed, states, re24) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  if (!plays.length) return false

  // Group play indices by half-inning, in feed order (already chronological).
  const halves = new Map() // "inning-half" -> array of play indices
  for (let i = 0; i < plays.length; i++) {
    const p = plays[i]
    const key = `${p.about?.inning}-${p.about?.halfInning}`
    if (!halves.has(key)) halves.set(key, [])
    halves.get(key).push(i)
  }

  // Runs scored ON each play (delta of the feed's running cumulative total),
  // then a per-half suffix sum so "remaining runs from play i forward" is O(1).
  let prevTotal = 0
  const runsOnPlay = new Array(plays.length)
  for (let i = 0; i < plays.length; i++) {
    const r = plays[i].result ?? {}
    const total = (r.awayScore ?? 0) + (r.homeScore ?? 0)
    runsOnPlay[i] = Math.max(0, total - prevTotal)
    prevTotal = total
  }
  const suffixByIndex = new Array(plays.length)
  for (const indices of halves.values()) {
    let running = 0
    for (let k = indices.length - 1; k >= 0; k--) {
      running += runsOnPlay[indices[k]]
      suffixByIndex[indices[k]] = running
    }
  }

  // Walk the whole game in feed order, tracking base occupancy + outs, reset
  // at each new half-inning.
  let bases = [null, null, null] // runner id per base, 1B/2B/3B
  let outs = 0
  let curHalfKey = null

  for (let i = 0; i < plays.length; i++) {
    const p = plays[i]
    const halfKey = `${p.about?.inning}-${p.about?.halfInning}`
    if (halfKey !== curHalfKey) {
      bases = [null, null, null]
      outs = 0
      curHalfKey = halfKey
    }
    if (outs >= 3) continue // shouldn't happen mid-half, but never tag a dead state

    const preBaseMask = (bases[0] ? 1 : 0) | (bases[1] ? 2 : 0) | (bases[2] ? 4 : 0)
    const preOuts = outs
    const remainingRuns = suffixByIndex[i] ?? 0

    let prevCount = { balls: 0, strikes: 0 } // resets per play, per the documented edge case above
    for (const e of p.playEvents ?? []) {
      if (!e.isPitch) continue
      const balls = prevCount.balls
      const strikes = prevCount.strikes
      prevCount = { balls: e.count?.balls ?? balls, strikes: e.count?.strikes ?? strikes }
      // A pre-pitch count outside 0–3 balls / 0–2 strikes is corrupted feed
      // data (a 4th ball ends the plate appearance, so it can never be a
      // PRE-pitch state) — rare (2 instances in a 4,860-game backfill, see
      // consistency-favor-scope.md), but skip it entirely rather than tag a
      // state that shouldn't exist.
      if (balls > 3 || strikes > 2) continue
      const k288 = stateKey(preBaseMask, preOuts, balls, strikes)
      const cell = states.get(k288) ?? { sum: 0, n: 0 }
      cell.sum += remainingRuns
      cell.n += 1
      states.set(k288, cell)

      const k24 = re24Key(preBaseMask, preOuts)
      const cell24 = re24.get(k24) ?? { sum: 0, n: 0 }
      cell24.sum += remainingRuns
      cell24.n += 1
      re24.set(k24, cell24)
    }

    // Apply this play's runner movements for the NEXT play's base/out state.
    for (const r of p.runners ?? []) {
      const rid = r.details?.runner?.id
      const startBase = BASE_NUM[r.movement?.start]
      const endBase = BASE_NUM[r.movement?.end]
      const isOut = r.movement?.isOut
      if (startBase) bases[startBase - 1] = null
      if (isOut) outs = Math.min(outs + 1, 3)
      else if (endBase) bases[endBase - 1] = rid
    }
  }
  return true
}

// Key order follows feed arrival, so sort it: a re-run then gives the same bytes.
const sorted = (m) => Object.fromEntries([...m].sort(([a], [b]) => (a < b ? -1 : 1)))

// Every Final, played regular-season gamePk of a schedule response. Same
// postponed-replay dedup guard as gen-umpires.mjs / gen-umpire-accuracy.mjs: a
// replayed game can be listed under both its original date and its officialDate;
// keep only the listing whose bucket matches its own officialDate. A cancelled
// game (the 120 of 2001) has abstractGameState Final but no play-by-play ever.
export function schedulePks(schedule) {
  const pks = []
  for (const d of schedule?.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.status?.abstractGameState !== 'Final') continue
      if (g.status?.detailedState === 'Cancelled') continue
      if (d.date !== g.officialDate) continue
      pks.push(g.gamePk)
    }
  }
  return pks
}

// Walk each game's feed into `states`/`re24` AS IT ARRIVES, so a season's feeds
// (several hundred KB to a few MB each) are never all in memory at once. Tells
// three outcomes apart: `games` (a feed with plays), `noPlays` (a feed that
// loaded with no plays, normal before 1990), and `failed` (the gamePks whose
// fetch threw after every retry). Best-effort: a failed fetch is listed, never
// thrown, so the nightly-style default mode stays alive; era mode refuses to
// write a checkpoint when `failed` is not empty.
export async function sweepGames(pks, limit, fetchFeed, states, re24, onProgress) {
  const failed = []
  let games = 0
  let noPlays = 0
  let done = 0
  await mapConcurrent(pks, limit, async (pk) => {
    try {
      const feed = await fetchFeed(pk)
      if (accumulateGame(feed, states, re24)) games++
      else noPlays++
    } catch {
      failed.push(pk)
    }
    done++
    onProgress?.(done)
  })
  return { games, noPlays, failed: failed.sort((a, b) => a - b) }
}

// One season's sums as plain JSON (the committed checkpoint file).
// `scheduled` vs `gamesSwept` shows a season with missing games; `noPlays` says
// how many of those loaded with no plays (older checkpoints do not carry it).
export function checkpointOf(season, scheduled, gamesSwept, states, re24, noPlays) {
  const counts = noPlays == null ? {} : { noPlays }
  return { season, scheduled, gamesSwept, ...counts, states: sorted(states), re24: sorted(re24) }
}

// The season strings of one decade ('1980' or '1980s'). The 2020s stop at ERA_LAST;
// anything that is not a decade start inside the era gives [].
export function decadeSeasons(decade) {
  if (!/^\d{3}0s?$/.test(String(decade))) return []
  const start = parseInt(decade, 10)
  if (start < ERA_FIRST || start > ERA_LAST) return []
  const out = []
  for (let y = start; y < start + 10 && y <= ERA_LAST; y++) out.push(String(y))
  return out
}

// Add season checkpoints into one decade table, in the shape of run-expectancy.json.
export function mergeCheckpoints(checkpoints) {
  const states = {}
  const re24 = {}
  const add = (into, from) => {
    for (const [k, c] of Object.entries(from)) {
      const t = (into[k] ??= { sum: 0, n: 0 })
      t.sum += c.sum
      t.n += c.n
    }
  }
  let gamesSwept = 0
  for (const c of checkpoints) {
    gamesSwept += c.gamesSwept
    add(states, c.states)
    add(re24, c.re24)
  }
  return { seasons: checkpoints.map((c) => c.season), gamesSwept, states, re24 }
}
