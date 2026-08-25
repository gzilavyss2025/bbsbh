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
// START_SEASON is the earliest year pulled, and it is the whole modern era:
// sabermetrics serves WAR back to 1901, with no gaps and no null rows. That the
// old years are CALIBRATED, not merely present, was checked by summing every
// player's WAR in a season and comparing it to the scale WAR is defined on
// (1000 WAR per 30-team, 162-game league): 1920 gave 506.7 against an expected
// 507 for 16 teams at 154 games, 1969 gave 800.8 against 800 for 24 teams, the
// 1994 strike gave 657.6 against 657 for 28 teams at 114 games, and 2020 gave
// 373.3 against 370 for 60 games. Replacement level tracks team count and
// schedule length in every era, so a 1923 WAR means what a 2023 WAR means.
// Individual values land too — Ruth's 1923 comes back 15.0, Bonds's 2001 12.5.
//
// The cost of the long window is one number: a player page fetches ONE shard,
// which grows from about 4 KB to about 18 KB (1.8 MB across all 100). The
// sharding is what makes the depth affordable — see src/api/war.js.
// Before this window went back, a pre-2010 row on a veteran's register showed a
// dash in the WAR column; now the register is filled for every MLB season a
// player ever had.
// Run by hand: node scripts/gen-war-history.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeShards } from './lib/io.js'
import { warShardKey } from '../src/api/war.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'war-history')

const START_SEASON = 1901
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
