// Regenerates public/data/ovr/{NN}.json — an OVR rating (0-100) per MLB hitter and
// pitcher who passes the minimum-data rule (docs/ovr-rating.md, "OVR for an MLB
// player"; #1720). Inputs are files already in the repo, so there is NO network call:
// savant-percentiles.json and war.json (the current season, nightly), savant-history/
// and war-history/ (2023-2025), hitter-grid/ (the current season's plate appearances),
// on-this-day/ (birth years for the age shift). The math is in lib/ovr/build.mjs.
//
// HAND-RUN, NOT a cron: rerun by hand after the nightly files move on, and when the
// prior-season stores are rebuilt each autumn. Sharded on `personId % 100`, both
// player types in one shard, so a player page opens ONE file (src/api/ovr/ovrData.js).
// Run by hand: node scripts/gen-ovr.mjs
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeShards } from './lib/io.js'
import { FLD_MIN_PA, buildRatings, loadInputs } from './lib/ovr/build.mjs'
import { mergeHistory, seedRows } from './lib/ovr/history.mjs'
import { unpackProspectTrend } from '../src/api/prospectTrend.js'
import { CONSTANTS } from '../src/api/ovr/rating.js'
import { shardKey100 } from '../src/lib/shardKey.js'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const MAX_SHARD_BYTES = 8 * 1024 // the sizing rule's stop-and-ask line (src/api/CLAUDE.md)
// The history store is the one exception, by Gary's call: 11 rated players a shard at 60 daily rows
// with bars come to about 106 KB at the most, so the line is 128 KB. A page opens one shard.
const MAX_HISTORY_SHARD_BYTES = 128 * 1024

const out = buildRatings(loadInputs(dataDir))

const shards = new Map() // shard key -> { bat: { id: { ovr, bars, seasons } }, pit }
for (const group of ['bat', 'pit']) {
  for (const [id, e] of Object.entries(out[group])) {
    const key = shardKey100(id)
    if (!shards.has(key)) shards.set(key, { bat: {}, pit: {} })
    shards.get(key)[group][id] = {
      ovr: Math.round(e.ovr),
      bars: Object.fromEntries(Object.entries(e.bars).map(([b, v]) => [b, Math.round(v)])),
      seasons: e.seasons,
    }
  }
}
const biggest = Math.max(...[...shards.values()].map((s) => JSON.stringify(s).length))
if (biggest > MAX_SHARD_BYTES) throw new Error(`a shard is ${biggest} bytes, over ${MAX_SHARD_BYTES}: stop and ask`)
const { written } = await writeShards(join(dataDir, 'ovr'), [...shards])

// The history file (#1722): public/data/ovr-history/{NN}.json, same shard key and the same
// bat / pit split. A row per player per date, kept by mergeHistory. The date is the day the
// nightly inputs were made, so a rerun on the same files writes the same bytes. Prospects get
// weekly rows seeded from prospect-trend.json (flagged, they are percentiles, not ratings).
const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null)
const today = readJson(join(dataDir, 'savant-percentiles.json')).generatedAt.slice(0, 10)
const seeds = { bat: {}, pit: {} }
for (const p of unpackProspectTrend(readJson(join(dataDir, 'prospect-trend.json')) ?? { players: [] }).players) {
  seeds[p.group === 'pitching' ? 'pit' : 'bat'][p.playerId] = seedRows(p.history)
}
const history = new Map() // shard key -> { bat: { id: rows }, pit }
const histShard = (key) => history.get(key) ?? history.set(key, { bat: {}, pit: {} }).get(key)
for (let n = 0; n < 100; n++) {
  const key = String(n).padStart(2, '0')
  const old = readJson(join(dataDir, 'ovr-history', `${key}.json`)) ?? { bat: {}, pit: {} }
  for (const group of ['bat', 'pit']) {
    const ids = new Set([...Object.keys(old[group]), ...Object.keys(shards.get(key)?.[group] ?? {})])
    for (const id of Object.keys(seeds[group])) if (shardKey100(id) === key) ids.add(id)
    for (const id of ids) {
      const now = shards.get(key)?.[group][id]
      const rows = mergeHistory({ prior: old[group][id], seed: seeds[group][id], real: now && [now.ovr, now.bars], today })
      if (rows.length) histShard(key)[group][id] = rows
    }
  }
}
const histBiggest = Math.max(...[...history.values()].map((s) => JSON.stringify(s).length))
if (histBiggest > MAX_HISTORY_SHARD_BYTES) throw new Error(`a history shard is ${histBiggest} bytes, over ${MAX_HISTORY_SHARD_BYTES}: stop and ask`)
const { written: histWritten } = await writeShards(join(dataDir, 'ovr-history'), [...history])

// The report: what the review notes on the rating module (issue #1720) asked this step to look at.
const stat = (xs) => {
  const m = xs.reduce((s, v) => s + v, 0) / xs.length
  return `n ${xs.length}, mean ${m.toFixed(1)}, SD ${Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length).toFixed(1)}, min ${Math.min(...xs).toFixed(1)}, max ${Math.max(...xs).toFixed(1)}`
}
for (const [label, group] of [['hitters', out.bat], ['pitchers', out.pit]]) {
  const rows = Object.entries(group)
  const ovrs = rows.map(([, e]) => e.ovr)
  const at = (v) => rows.filter(([, e]) => e.ovr === v)
  console.log(`${label}: ${stat(ovrs)}; on the floor of ${CONSTANTS.FLOOR}: ${at(CONSTANTS.FLOOR).length}, on the cap of ${CONSTANTS.CAP}: ${at(CONSTANTS.CAP).length} (${((100 * (at(CONSTANTS.FLOOR).length + at(CONSTANTS.CAP).length)) / rows.length).toFixed(1)}% of ${rows.length})`)
  const best = rows.reduce((a, b) => (b[1].ovr > a[1].ovr ? b : a))
  const worst = rows.reduce((a, b) => (b[1].ovr < a[1].ovr ? b : a))
  console.log(`  highest ${best[0]} ${best[1].ovr.toFixed(1)}, lowest ${worst[0]} ${worst[1].ovr.toFixed(1)}`)
}
// Spread by which bars a hitter has: a sparse hitter (Contact and Power only) gets the full stretch.
const bySignature = {}
for (const e of Object.values(out.bat)) (bySignature[Object.keys(e.bars).sort().join('+')] ??= []).push(e.ovr)
for (const [sig, xs] of Object.entries(bySignature)) console.log(`  hitters with ${sig}: ${stat(xs)}`)
console.log(`strings converted to numbers: ${out.strings}; blended percentiles at 0 or 100 or past them (clamped before inverseNormalCdf): ${out.clamped}`)
console.log(`history ${today}: ${histWritten} shards to ${join(dataDir, 'ovr-history')}, largest ${histBiggest} bytes`)
console.log(`wrote ${written} shards to ${join(dataDir, 'ovr')} (floor ${FLD_MIN_PA} PA, largest ${biggest} bytes)`)
