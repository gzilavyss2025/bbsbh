import { shardKey100 } from '../../../lib/shardKey.js'
import { staticJsonBy } from '../../staticJson.js'

// A player's FAMILY LINKS, from Retrosheet's biographical files (ADR-0100).
// Reads public/data/family-ties/{NN}.json, which scripts/gen-family-ties.mjs
// builds BY HAND, sharded on `shardKey100(mlbamId)`. The app never fetches
// Retrosheet or the Chadwick register.
//
// SPOILER FOOTING: spoiler-FREE. Who a man's father or brother is says nothing
// about a game, so an open surface may show it with no SealBox (ADR-0034).
//
// THE SHARD: { credit: [line, ...], players: { [mlbamId]: [{ relation, personId, name }] } }.
// `relation` says what the OTHER man is to this player (his Father, his Son).
// `personId` is null when the relative has no MLBAM id: show his name, link nothing.
// The shard's `credit` lines must print beside the data, so a surface reads
// `fetchFamilyShard` when it draws them. `familyOf` is for the entries alone.
export const fetchFamilyShard = staticJsonBy((key) => `/data/family-ties/${key}.json`, { fallback: null })

export async function familyOf(personId) {
  if (personId == null) return []
  const shard = await fetchFamilyShard(shardKey100(personId))
  return shard?.players?.[String(personId)] ?? []
}
