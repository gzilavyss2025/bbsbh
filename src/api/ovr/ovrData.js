import { shardKey100 } from '../../lib/shardKey.js'
import { staticJsonBy } from '../staticJson.js'

// A player's OVR rating, one shard per `personId % 100`
// (public/data/ovr/NN.json, hand-run by scripts/gen-ovr.mjs; docs/ovr-rating.md).
// A shard holds both player types; a player page opens one. Degrades to null
// before the shard exists or on any failure: a player with no card, not a broken page.
const loadShard = staticJsonBy((key) => `/data/ovr/${key}.json`)

// -> { ovr, bars: { [bucket]: n }, seasons: [year, ...] } | null, for one player and
// group ('hitting' | 'pitching'). `ovr` and each bar are whole numbers 20-99;
// `seasons` is every season that fed the rating, newest first. null when the player
// failed the minimum-data rule (a hitter needs Contact and Power, a pitcher all three
// buckets), so a null is "no rating", never a low one.
export async function fetchOvr(personId, group) {
  const shard = await loadShard(shardKey100(personId))
  return shard?.[group === 'pitching' ? 'pit' : 'bat']?.[personId] ?? null
}
