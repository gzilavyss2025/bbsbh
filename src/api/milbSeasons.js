import { shardKey100 } from '../lib/shardKey.js'
import { staticJsonBy } from './staticJson.js'

// A player's minor-league season lines, 2021-2025, levels AAA to A (sportId 11-14).
// Read from public/data/milb-seasons/{NN}.json, hand-run by scripts/gen-milb-seasons.mjs
// (a finished minor-league season never changes). The current season is NOT here:
// read it from prospect-trend.json. Rk (16) is not built yet.
//
// A row is the season TOTAL at one level: { season, sport, group, n, v, pct }.
// `n` is plate appearances (hitting) or outs (pitching). `v` is OPS or ERA, null when
// the feed printed a dash. `pct` is the percentile of `v` in that level-season, null
// under the playing-time floor (40 PA, 30 outs). Spoiler-free: season totals only.
// Degrades to [] when the shard or the player is missing.

// The career blend's weight for one minor-league row (docs/ovr-rating.md, "Career
// rating"): LEVEL_WEIGHT[sport] * min(1, n / FULL_WEIGHT). START VALUES, guesses to tune.
// Step 5 (gen-ovr.mjs) reads them. Rk (16) is listed for when its fetch lands.
export const LEVEL_WEIGHT = { 11: 0.6, 12: 0.5, 13: 0.35, 14: 0.25, 16: 0.1 }
export const FULL_WEIGHT_PA = 400
export const FULL_WEIGHT_OUTS = 450 // 150 IP

export const milbShardKey = shardKey100

// Rows are stored as arrays to keep a shard small. The generator packs with these.
export const packRow = (r) => [r.season, r.sport, r.group[0], r.n, r.v, r.pct]
export const unpackRow = ([season, sport, g, n, v, pct]) => ({ season, sport, group: g === 'h' ? 'hitting' : 'pitching', n, v, pct })

const shard = staticJsonBy((key) => `/data/milb-seasons/${key}.json`, {
  shape: (d) => d?.players ?? {},
  fallback: {},
})

export async function fetchMilbSeasons(personId) {
  return ((await shard(milbShardKey(personId)))[personId] ?? []).map(unpackRow)
}
