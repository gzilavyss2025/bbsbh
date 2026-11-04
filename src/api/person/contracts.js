import { shardKey100 } from '../../lib/shardKey.js'
import { staticJson, staticJsonBy } from '../staticJson.js'

// Fever Baseball's Cot's-to-MLBAM join, fetched at build time by
// scripts/fever/gen-player-contracts.mjs. One player page reads one ~10 KB
// shard; a missing
// nightly file or unmatched player is a missing card, never a page failure.
const fetchShard = staticJsonBy(
  (key) => `/data/player-contracts/${key}.json`,
  { fallback: null },
)

// Pay ranks for the whole league, in one file (gen-player-contracts.mjs). One
// signing re-ranks a pool, so a rank kept inside each shard rewrote all 100.
const fetchPayRanks = staticJson('/data/pay-ranks.json', { fallback: null })

// `payRank: true` joins the pay rank (the Contract card is its only reader), so
// the free-agents list, wire notes and the overview never download the ranks file.
export async function fetchPlayerContract(personId, { payRank = false } = {}) {
  if (personId == null) return null
  const [shard, payRanks] = await Promise.all([fetchShard(shardKey100(personId)), payRank ? fetchPayRanks() : null])
  const contract = shard?.players?.[personId]
  if (!contract) return null
  const record = { ...contract, source: shard.meta }
  if (payRank) record.payRank = payRanks?.ranks?.[personId] ?? null
  return record
}

// The one season the contract files cover (every shard's meta carries it).
// Null when the file is missing.
export async function fetchContractsSeason() {
  const shard = await fetchShard('00')
  return shard?.meta?.season ?? null
}
