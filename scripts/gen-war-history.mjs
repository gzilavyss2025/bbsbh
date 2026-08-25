// Regenerates public/data/war-history.json — season WAR per player for PAST
// (completed) seasons, keyed by MLB Stats API personId, exactly like the nightly
// public/data/war.json but spanning many years instead of just the live one.
//
// Split from gen-war.mjs on purpose: a completed season's WAR is IMMUTABLE, so
// this is a HAND-RUN regenerate (like gen-milb-history.mjs), NOT a cron —
// re-run it once a year to fold in the season that just ended. The live app
// reads BOTH files (src/api/war.js): the current, still-moving season from
// war.json (nightly cron), every completed season from this file. The player
// page's career-register WAR column and the season tile's WAR draw from the
// union.
//
// Same source as gen-war.mjs: statsapi.mlb.com's `stats=sabermetrics` type —
// MLB's own calculation, not FanGraphs' fWAR or Baseball-Reference's bWAR (see
// that file's header). Rows carry `player.id`, the same id as statsapi
// personId, so no name-matching. WAR is MLB-only here — sportId 1 only, no
// minor-league sabermetrics exist — so MiLB rows/tiles fall back to a dash,
// consistent with the rest of the app.
//
// START_SEASON is the earliest year pulled. Bumping it further back is just a
// bigger file (each season is ~2,200 players across bat+pit); 2010 covers the
// bulk of any current player's MLB career, and pre-START seasons on a veteran's
// register simply show a dash in the WAR column (graceful, same as MiLB).
// Run by hand: node scripts/gen-war-history.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeShards } from './lib/io.js'
import { warShardKey } from '../src/api/war.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'war-history')

const START_SEASON = 2010
// Only COMPLETED seasons belong here; the live season is war.json's job. Before
// a season ends its WAR is still moving, so stop at the year before the current.
const LAST_SEASON = new Date().getFullYear() - 1

async function fetchLeaderboard(group, season) {
  const url =
    `https://statsapi.mlb.com/api/v1/stats?stats=sabermetrics&group=${group}` +
    `&season=${season}&sportId=1&limit=3000&playerPool=ALL`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`statsapi sabermetrics ${group} ${season} leaderboard: HTTP ${res.status}`)
  const json = await res.json()
  const map = {}
  for (const split of json.stats?.[0]?.splits ?? []) {
    const id = split.player?.id
    const war = Number(split.stat?.war)
    if (id && Number.isFinite(war)) map[id] = Math.round(war * 10) / 10
  }
  return map
}

const bat = {}
const pit = {}
const seasons = []
for (let season = START_SEASON; season <= LAST_SEASON; season++) {
  const [b, p] = await Promise.all([
    fetchLeaderboard('hitting', season),
    fetchLeaderboard('pitching', season),
  ])
  bat[season] = b
  pit[season] = p
  seasons.push(season)
  console.log(`${season}: ${Object.keys(b).length} batters, ${Object.keys(p).length} pitchers`)
}

// Pivot from season-keyed to PLAYER-keyed, then bucket on `personId % 100` —
// the reader wants one career, not one season of the league. warShardKey is
// imported from the reader (src/api/war.js), never re-implemented, so the two
// cannot disagree about which bucket a player is in.
const buckets = new Map() // shard key -> { bat, pit }
for (const [group, bySeason] of [
  ['bat', bat],
  ['pit', pit],
]) {
  for (const [season, byId] of Object.entries(bySeason)) {
    for (const [id, war] of Object.entries(byId)) {
      const key = warShardKey(id)
      if (!buckets.has(key)) buckets.set(key, { bat: {}, pit: {} })
      const player = buckets.get(key)[group]
      ;(player[id] ??= {})[season] = war
    }
  }
}

const generatedAt = new Date().toISOString()
const { written } = await writeShards(
  outDir,
  [...buckets].map(([key, groups]) => [key, { generatedAt, seasons, ...groups }]),
)
console.log(
  `wrote ${written} shards to ${outDir} (${seasons.length} seasons ${START_SEASON}–${LAST_SEASON})`,
)
