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
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeShards } from './lib/io.js'
import { FLD_MIN_PA, buildRatings, loadInputs } from './lib/ovr/build.mjs'
import { CONSTANTS } from '../src/api/ovr/rating.js'
import { shardKey100 } from '../src/lib/shardKey.js'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const MAX_SHARD_BYTES = 8 * 1024 // the sizing rule's stop-and-ask line (src/api/CLAUDE.md)

const inputs = loadInputs(dataDir)
const out = buildRatings(inputs)
const mlbOnly = buildRatings({ ...inputs, minors: {}, top: {} }) // for the report: who the minor-league seasons move

const shards = new Map() // shard key -> { bat: { id: { ovr, bars?, seasons, level?, pot? } }, pit }
for (const group of ['bat', 'pit']) {
  for (const [id, e] of Object.entries(out[group])) {
    const key = shardKey100(id)
    if (!shards.has(key)) shards.set(key, { bat: {}, pit: {} })
    shards.get(key)[group][id] = {
      ovr: Math.round(e.ovr),
      ...(e.bars && { bars: Object.fromEntries(Object.entries(e.bars).map(([b, v]) => [b, Math.round(v)])) }),
      seasons: e.seasons,
      ...(e.level && { level: e.level }),
      ...(e.pot != null && { pot: Math.round(e.pot) }),
    }
  }
}
const biggest = Math.max(...[...shards.values()].map((s) => JSON.stringify(s).length))
if (biggest > MAX_SHARD_BYTES) throw new Error(`a shard is ${biggest} bytes, over ${MAX_SHARD_BYTES}: stop and ask`)
const { written } = await writeShards(join(dataDir, 'ovr'), [...shards])

// The report: what the review notes on the rating module (issue #1720) asked this step to look at.
const stat = (xs) => {
  const m = xs.reduce((s, v) => s + v, 0) / xs.length
  return `n ${xs.length}, mean ${m.toFixed(1)}, SD ${Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length).toFixed(1)}, min ${Math.min(...xs).toFixed(1)}, max ${Math.max(...xs).toFixed(1)}`
}
for (const [label, all] of [['hitters', out.bat], ['pitchers', out.pit]]) {
  const group = Object.fromEntries(Object.entries(all).filter(([, e]) => e.bars)) // MLB entries
  const rows = Object.entries(group)
  const ovrs = rows.map(([, e]) => e.ovr)
  const at = (v) => rows.filter(([, e]) => e.ovr === v)
  console.log(`${label}: ${stat(ovrs)}; on the floor of ${CONSTANTS.FLOOR}: ${at(CONSTANTS.FLOOR).length}, on the cap of ${CONSTANTS.CAP}: ${at(CONSTANTS.CAP).length} (${((100 * (at(CONSTANTS.FLOOR).length + at(CONSTANTS.CAP).length)) / rows.length).toFixed(1)}% of ${rows.length})`)
  const best = rows.reduce((a, b) => (b[1].ovr > a[1].ovr ? b : a))
  const worst = rows.reduce((a, b) => (b[1].ovr < a[1].ovr ? b : a))
  console.log(`  highest ${best[0]} ${best[1].ovr.toFixed(1)}, lowest ${worst[0]} ${worst[1].ovr.toFixed(1)}`)
}
// Minor leaguers, POT, and how far the minor-league seasons moved the MLB ratings.
for (const [label, all, base] of [['hitters', out.bat, mlbOnly.bat], ['pitchers', out.pit, mlbOnly.pit]]) {
  const minor = Object.values(all).filter((e) => e.level)
  const pots = Object.values(all).filter((e) => e.pot != null)
  const moves = Object.entries(base).map(([id, b]) => Math.abs(all[id].ovr - b.ovr))
  const over = (d) => moves.filter((m) => m > d).length
  console.log(`${label}: ${minor.length} minor leaguers (${stat(minor.map((e) => e.ovr))}); ${pots.length} with POT (${minor.filter((e) => e.pot != null).length} minor, ${pots.length - minor.filter((e) => e.pot != null).length} MLB); of ${moves.length} MLB ratings, ${over(0.5)} moved over 0.5, ${over(1)} over 1, ${over(2)} over 2 (${((100 * over(2)) / moves.length).toFixed(1)}%), largest ${Math.max(...moves).toFixed(1)}`)
}
const unrated = Object.keys(inputs.top).filter((id) => !out.bat[id]?.pot && !out.pit[id]?.pot)
console.log(`Top 100 players with no rating (so no POT): ${unrated.length} of ${Object.keys(inputs.top).length}`)
// Spread by which bars a hitter has: a sparse hitter (Contact and Power only) gets the full stretch.
const bySignature = {}
for (const e of Object.values(out.bat).filter((e) => e.bars)) (bySignature[Object.keys(e.bars).sort().join('+')] ??= []).push(e.ovr)
for (const [sig, xs] of Object.entries(bySignature)) console.log(`  hitters with ${sig}: ${stat(xs)}`)
console.log(`strings converted to numbers: ${out.strings}; blended percentiles at 0 or 100 or past them (clamped before inverseNormalCdf): ${out.clamped}`)
console.log(`wrote ${written} shards to ${join(dataDir, 'ovr')} (floor ${FLD_MIN_PA} PA, largest ${biggest} bytes)`)
