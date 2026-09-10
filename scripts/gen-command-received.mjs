// Regenerates public/data/command-received.json — COMMAND RECEIVED: for each
// catcher, the pitchers who threw to him this season, ranked by how close they
// finished to his target while he was behind the plate.
//
// THE JOIN IS ENTIRELY BBSBH'S, and that is the whole shape of this file.
// OpenCommand carries NO catcher identity anywhere — its method detects an
// anonymous glove per pitcher per game and was never told, and never infers,
// whose glove it was. So "by catcher" cannot be read out of that dataset at any
// price; it has to be reconstructed from each game's own feed, by replaying the
// defensive substitutions to find who was crouching for each half-inning
// (src/api/catcherOfRecord.js) and matching that against the per-pitch rows.
//
// THE JOIN KEY WAS VERIFIED, NOT ASSUMED. OpenCommand's `play_id` is the same
// UUID as this app's feed `playEvents[].playId` — checked against real game
// 822696, where two sampled target rows resolved to the right inning, half and
// pitcher id. That is what makes this a lookup rather than a timestamp
// heuristic.
//
// THIS IS A REAL BATCH JOB. It fetches one feed per game in the season's
// OpenCommand coverage (1,865 games for 2026), which is why it runs as its own
// nightly step and never at request time. The feeds are FIELD-PRUNED to the
// dozen paths defenseEntering actually reads — 46 KB against 697 KB for a full
// feed, verified to produce a byte-identical catcher chart — so the sweep moves
// tens of megabytes rather than gigabytes.
//
// Current season only, deliberately: prove the pipeline on one before spending
// three times the fetching on history. `--season=` overrides.
//
// Run by hand: node scripts/gen-command-received.mjs [--season=2026] [--limit=50]
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'
import { mapConcurrent } from './lib/concurrency.mjs'
import { STATSAPI_BASE } from './lib/statsapi.mjs'
import { catcherChart } from '../src/api/catcherOfRecord.js'
import {
  MIN_COMMAND_PITCHES,
  OPENCOMMAND_URL,
  latestSeason,
  median,
  playIndex,
  streamPitches,
} from './lib/opencommand.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'command-received.json')

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? Number(hit.slice(name.length + 3)) : null
}
const preferred = arg('season') ?? new Date().getFullYear()
// A dev escape hatch for a quick end-to-end run against a handful of games.
const limit = arg('limit')

// Exactly the paths defenseEntering + halvesPlayed read, and nothing else. A
// full feed is 697 KB; this is 46 KB, and both produce the same catcher chart.
const FEED_FIELDS = [
  'gameData', 'players', 'fullName', 'lastName', 'firstName', 'useName', 'useLastName', 'boxscoreName',
  'liveData', 'boxscore', 'teams', 'away', 'home', 'person', 'id', 'battingOrder',
  'allPositions', 'abbreviation', 'position',
  'plays', 'allPlays', 'about', 'inning', 'halfInning', 'playEvents', 'isPitch', 'details',
  'eventType', 'player', 'playId',
].join(',')

// Eight at a time. The same shape every other feed sweep here takes: enough to
// keep the pipe busy, well short of leaning on a public API that this app is a
// guest on.
const FETCH_CONCURRENCY = 8

const season = await latestSeason(preferred)
if (!season) {
  await writeJsonAtomic(out, {
    season: null,
    generatedAt: new Date().toISOString(),
    source: 'OpenCommand',
    sourceUrl: OPENCOMMAND_URL,
    license: 'CC BY-NC-SA 4.0',
    minPitches: MIN_COMMAND_PITCHES,
    catchers: {},
    names: {},
  })
  console.log(`wrote ${out} (no OpenCommand season at or below ${preferred} — empty file)`)
  process.exit(0)
}

// --- 1: every usable pitch, grouped by the game it was thrown in ------------
//
// Grouped first because the catcher lookup is per GAME: one feed fetch answers
// every pitch in it, and going pitch by pitch would fetch the same feed
// hundreds of times.
const index = await playIndex(season)
const byGame = new Map() // gamePk -> [[playId, pitcherId, miss], ...]
let pitches = 0
for await (const p of streamPitches(season, index)) {
  let rows = byGame.get(p.gamePk)
  if (!rows) byGame.set(p.gamePk, (rows = []))
  rows.push([p.playId, p.pitcherId, p.miss])
  pitches++
}
index.clear()

let games = [...byGame.keys()]
if (limit) games = games.slice(0, limit)
console.log(`${season}: ${pitches.toLocaleString()} pitches over ${games.length} game(s) — fetching feeds`)

// --- 2: one feed per game, replayed into a catcher chart --------------------

// catcherId -> pitcherId -> [miss, ...]
const received = new Map()
// catcherId/pitcherId -> last name, for the card's rows. Taken from the feed
// rather than a second roster fetch: the chart already carries it.
const names = new Map()
let matched = 0
let unmatchedHalf = 0
let noChart = 0
let feedFails = 0

const bucketFor = (map, id) => {
  let inner = map.get(id)
  if (!inner) map.set(id, (inner = new Map()))
  return inner
}

await mapConcurrent(games, FETCH_CONCURRENCY, async (gamePk) => {
  let feed
  try {
    const res = await fetch(`${STATSAPI_BASE}/api/v1.1/game/${gamePk}/feed/live?fields=${FEED_FIELDS}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    feed = await res.json()
  } catch {
    // One unreachable feed is a handful of pitches lost, not a reason to lose
    // the night — the same best-effort footing mapConcurrent itself takes.
    feedFails++
    return null
  }

  const chart = catcherChart(feed)
  if (!chart.size) {
    // A feed with no posted lineup (or no plays at all) has no catcher to name.
    noChart++
    return null
  }

  // playId -> `${inning}:${half}`, so a pitch can find its own half.
  const halfOf = new Map()
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const key = `${play?.about?.inning}:${play?.about?.halfInning}`
    for (const ev of play.playEvents ?? []) {
      if (ev?.playId) halfOf.set(ev.playId, key)
    }
  }

  for (const [playId, pitcherId, miss] of byGame.get(gamePk)) {
    const half = halfOf.get(playId)
    const catcher = half ? chart.get(half) : null
    if (!catcher) {
      // A pitch whose play the pruned feed does not carry, or a half with no
      // catcher of record. Dropped silently — the graceful-degradation
      // convention, not an error state.
      unmatchedHalf++
      continue
    }
    names.set(catcher.id, catcher.last)
    const byPitcher = bucketFor(received, catcher.id)
    let misses = byPitcher.get(pitcherId)
    if (!misses) byPitcher.set(pitcherId, (misses = []))
    misses.push(miss)
    matched++
  }
  return null
})

// --- 3: the rankings --------------------------------------------------------

// Pitcher last names, resolved in one bulk call rather than carried out of
// every feed: the chart names catchers because it already holds them, but a
// pitcher's name would mean holding a second map across 1,865 feeds.
const pitcherNames = new Map()
try {
  const res = await fetch(
    `${STATSAPI_BASE}/api/v1/sports/1/players?season=${season}&fields=people,id,lastName,useLastName,fullName`,
  )
  if (res.ok) {
    for (const p of (await res.json()).people ?? []) {
      pitcherNames.set(p.id, p.useLastName || p.lastName || p.fullName || '')
    }
  }
} catch {
  // Names are a nicety; the card can print an id-keyed row with the name it
  // has. Never fatal.
}

const catchers = {}
let rows = 0
for (const [catcherId, byPitcher] of received) {
  const list = []
  const all = []
  for (const [pitcherId, misses] of byPitcher) {
    all.push(...misses)
    if (misses.length < MIN_COMMAND_PITCHES) continue
    list.push([pitcherId, misses.length, Number(median(misses).toFixed(2))])
  }
  if (!list.length) continue
  // Sharpest first — the card is a ranked list and this is the rank.
  list.sort((a, b) => a[2] - b[2])
  catchers[catcherId] = {
    // His own season behind the plate: every pitch thrown to him, including the
    // arms too thin to earn a row. The card prints it as the line the rows are
    // read against, so it must count the same pitches the rows came from.
    n: all.length,
    miss: Number(median(all).toFixed(2)),
    // [pitcherId, pitches, median miss] — the same compact triple
    // target-command.json uses, and unpacked in exactly one place.
    pitchers: list,
  }
  rows += list.length
}

const nameMap = {}
for (const [id, last] of names) nameMap[id] = last
for (const entry of Object.values(catchers)) {
  for (const [pitcherId] of entry.pitchers) {
    if (!nameMap[pitcherId] && pitcherNames.has(pitcherId)) nameMap[pitcherId] = pitcherNames.get(pitcherId)
  }
}

await writeJsonAtomic(out, {
  season,
  generatedAt: new Date().toISOString(),
  source: 'OpenCommand',
  sourceUrl: OPENCOMMAND_URL,
  license: 'CC BY-NC-SA 4.0',
  minPitches: MIN_COMMAND_PITCHES,
  catchers,
  names: nameMap,
})

console.log(
  `wrote ${out} (${season}: ${Object.keys(catchers).length} catchers, ${rows} pitcher rows, ` +
    `${matched.toLocaleString()} of ${pitches.toLocaleString()} pitches attributed, ` +
    `${unmatchedHalf.toLocaleString()} unattributed, ${noChart} game(s) with no catcher chart, ` +
    `${feedFails} feed fetch failure(s))`,
)
