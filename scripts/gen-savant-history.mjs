// Regenerates public/data/savant-history/{NN}.json — Statcast percentile ranks per
// player for the last three COMPLETED seasons, the prior-season input of the OVR
// career blend (docs/ovr-rating.md, "Prior seasons"; #1717).
//
// HAND-RUN, NOT a cron, like gen-war-history.mjs: a finished season is not
// expected to change, so run it once a year after the season ends and move
// FIRST_SEASON up with it. The season in play comes from the nightly
// savant-percentiles.json, not from here.
//
// Same board and same METRICS map as gen-savant-percentiles.mjs (scripts/lib/savant.mjs);
// Savant did the percentile maths, so a blank cell (unqualified, or no bat
// tracking before 2023) is simply left out of the shard. Sharded on
// `personId % 100`, all three seasons and both player types in one shard, so a player
// page opens ONE ~2.5 KB file (src/api/ovr/savantHistory.js).
// Run by hand: node scripts/gen-savant-history.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeShards } from './lib/io.js'
import { fetchPercentiles } from './lib/savant.mjs'
import { shardKey100 } from '../src/lib/shardKey.js'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'savant-history')

const FIRST_SEASON = 2023
const LAST_SEASON = 2025
const MAX_SHARD_BYTES = 6 * 1024
// A real board holds 600+ players. A 200 with a handful of rows must not wipe the shards.
const MIN_PLAYERS = 300

const buckets = new Map() // shard key -> { bat: { id: { season: {metric: pct} } }, pit }
for (let season = FIRST_SEASON; season <= LAST_SEASON; season++) {
  for (const [group, type] of [['bat', 'batter'], ['pit', 'pitcher']]) {
    const rows = await fetchPercentiles(type, season)
    if (Object.keys(rows).length < MIN_PLAYERS) throw new Error(`${season} ${type}: only ${Object.keys(rows).length} players`)
    for (const [id, entry] of Object.entries(rows)) {
      const key = shardKey100(id)
      if (!buckets.has(key)) buckets.set(key, { bat: {}, pit: {} })
      const cells = Object.fromEntries(Object.entries(entry).filter(([, v]) => v != null))
      ;((buckets.get(key)[group][id] ??= {})[season] = cells)
    }
    console.log(`${season} ${type}: ${Object.keys(rows).length} players`)
  }
}

const entries = [...buckets]
const biggest = Math.max(...entries.map(([, b]) => JSON.stringify(b).length))
if (biggest > MAX_SHARD_BYTES) throw new Error(`a shard is ${biggest} bytes, over ${MAX_SHARD_BYTES}: stop and ask`)
const { written } = await writeShards(outDir, entries)
console.log(`wrote ${written} shards to ${outDir} (${FIRST_SEASON}-${LAST_SEASON}, largest ${biggest} bytes)`)
