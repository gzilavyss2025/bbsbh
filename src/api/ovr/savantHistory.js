import { shardKey100 } from '../../lib/shardKey.js'
import { staticJsonBy } from '../staticJson.js'

// Prior-season Statcast percentiles (2023-2025), one shard per `personId % 100`
// (public/data/savant-history/NN.json, hand-run by scripts/gen-savant-history.mjs).
// The prior-season input of the OVR career blend (docs/ovr-rating.md, "Prior
// seasons"). A shard holds all three seasons for both player types; a player
// page opens one. Degrades to empty before the shard exists or on any failure,
// so a player simply has no prior seasons.
const loadShard = staticJsonBy((key) => `/data/savant-history/${key}.json`)

// -> { [season]: { [metric]: percentile } } for one player and group
// ('hitting' | 'pitching'), the shape career.js's blendCareer takes. {} when the
// player has no row. A metric Savant left blank is absent, not null.
export async function fetchSavantHistory(personId, group) {
  const shard = await loadShard(shardKey100(personId))
  return shard?.[group === 'pitching' ? 'pit' : 'bat']?.[personId] ?? {}
}
