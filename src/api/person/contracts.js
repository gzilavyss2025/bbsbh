import { shardKey100 } from '../../lib/shardKey.js'
import { staticJsonBy } from '../staticJson.js'

// Fever Baseball's Cot's-to-MLBAM join, fetched at build time by
// scripts/fever/gen-player-contracts.mjs. One player page reads one ~10 KB
// shard; a missing
// nightly file or unmatched player is a missing card, never a page failure.
const fetchShard = staticJsonBy(
  (key) => `/data/player-contracts/${key}.json`,
  { fallback: null },
)

export async function fetchPlayerContract(personId) {
  if (personId == null) return null
  const shard = await fetchShard(shardKey100(personId))
  const contract = shard?.players?.[personId]
  return contract ? { ...contract, source: shard.meta } : null
}
