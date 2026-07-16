// Regenerates public/data/run-expectancy.json — a base(8)×outs(3)×count(12) =
// 288-state run-expectancy table (RE288), each state's value the mean runs
// scored from that exact pre-pitch state until its half-inning ends, averaged
// over real MLB regular-season play-by-play. Feeds scripts/gen-umpire-accuracy.mjs's
// per-missed-call "favor" figure (src/lib/runExpectancy.js's pitchFavor) and,
// live, the box score's reveal-only favor card — see
// .scratch/umpire-accuracy/consistency-favor-scope.md §2 for the full design
// and how this was verified against a real feed before being built.
//
// NOT ON THE NIGHTLY CRON. Run expectancy is a slow-moving league constant
// (real published tables refresh yearly at most), nothing like the nightly
// per-game accuracy sweep — this is a hand-run, one-time (or annual) backfill:
//   node scripts/gen-run-expectancy.mjs                    # last 2 complete seasons
//   node scripts/gen-run-expectancy.mjs --seasons=2024,2025
//
// METHODOLOGY. For every Final regular-season game, walk liveData.plays.allPlays
// in feed order (this already includes stolen-base/caught-stealing/pickoff/
// wild-pitch/passed-ball/balk as their own top-level plays, interleaved with
// real plate appearances — see playbyplay.js's NON_PA_EVENT_TYPES), applying
// each play's runners[].movement.{start,end,isOut} to a 3-slot base-occupancy
// array, reset at each new half-inning. VERIFIED against a real 5–14 game
// (gamePk 823358): runs-per-half computed this way matched
// liveData.linescore.innings[].{away,home}.runs on all 17 halves.
//
// Every pitch is tagged with its PRE-pitch state — (baseMask, outs, balls,
// strikes) as they stood the instant the pitch was thrown — and the label is
// the half-inning's remaining runs from that pitch's own play forward
// (inclusive of any runs that very plate appearance goes on to drive in).
// CAUGHT ON VERIFICATION: playEvents[].count.{balls,strikes} is the count
// AFTER that pitch resolves, not before (the game's first pitch, a ball,
// carries count.balls: 1) — the pre-pitch count is the PRECEDING pitch
// event's count within the same play (or 0-0 for a play's first pitch).
//
// KNOWN, ACCEPTED EDGE CASE: a plate appearance interrupted mid-count by a
// genuine top-level baserunning play (e.g. a pickoff attempt between
// pitches) may in principle span more than one `play` object. This script
// does not special-case that — count tracking resets per `play` object's own
// pitch sequence. Rare, and 288 buckets aggregate many seasons' worth of
// instances, so a handful of mistagged pitches is noise, not bias.
//
// Thin per-count buckets (bases loaded / 2 outs / 3-2, genuinely rare) fall
// back at READ time (src/lib/runExpectancy.js's lookupRE) to a base/out-only
// RE24 total — this script writes BOTH `states` (288) and `re24` (24) sums so
// that fallback never needs a second pass over history.
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stateKey, re24Key } from '../src/lib/runExpectancy.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'run-expectancy.json')
const BASE = 'https://statsapi.mlb.com'
const BASE_NUM = { '1B': 1, '2B': 2, '3B': 3 }

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a)
    if (m) args[m[1]] = m[2]
  }
  return args
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await fn(items[i])
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// Every Final regular-season gamePk for one season. Same postponed-replay
// dedup guard as gen-umpires.mjs / gen-umpire-accuracy.mjs: a replayed game
// can be listed under both its original date and its officialDate; keep only
// the listing whose bucket matches its own officialDate.
async function seasonGamePks(season) {
  const data = await getJson(`/api/v1/schedule?sportId=1&season=${season}&gameType=R&hydrate=team`)
  const pks = []
  for (const d of data.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.status?.abstractGameState !== 'Final') continue
      if (d.date !== g.officialDate) continue
      pks.push(g.gamePk)
    }
  }
  return pks
}

// Accumulate one game's plate appearances into the running state sums. Adds
// { sum, n } into both `states` (288-bucket) and `re24` (24-bucket) Maps.
function accumulateGame(feed, states, re24) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  if (!plays.length) return

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
}

// --- main ---------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2))
const currentYear = new Date().getUTCFullYear()
const seasons = args.seasons
  ? args.seasons.split(',').map((s) => s.trim())
  : [String(currentYear - 2), String(currentYear - 1)]

const states = new Map()
const re24 = new Map()
let gamesSwept = 0

for (const season of seasons) {
  const pks = await seasonGamePks(season)
  console.log(`${season}: ${pks.length} Final games`)
  // Accumulate each game's feed into states/re24 AS IT ARRIVES, inside the
  // worker itself, rather than collecting all of a season's feeds (each
  // several hundred KB to a few MB) in memory before processing any of
  // them — a full season is 2000+ games, so buffering them all first was a
  // real peak-memory problem. mapWithConcurrency's return value is unused
  // here; the accumulation IS the work.
  let done = 0
  await mapWithConcurrency(pks, 6, async (pk) => {
    const feed = await getJson(`/api/v1.1/game/${pk}/feed/live`)
    accumulateGame(feed, states, re24)
    gamesSwept++
    done++
    if (done % 250 === 0) console.log(`${season}: ${done}/${pks.length} games processed`)
  })
  console.log(`${season}: swept (${states.size} states populated so far)`)
}

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    seasons,
    gamesSwept,
    states: Object.fromEntries(states),
    re24: Object.fromEntries(re24),
  }),
)
console.log(
  `wrote ${out} — ${seasons.join(', ')}, ${gamesSwept} games, ${states.size}/288 states populated`,
)
