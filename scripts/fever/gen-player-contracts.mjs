// Regenerates public/data/player-contracts/{00..99}.json from Fever Baseball's
// player-contract feed. Fever has already reconciled Cot's contract records to
// MLBAM player IDs; Tally keeps that join and publishes one small ID-keyed shard
// per player-page request rather than shipping the league-wide source payload.
//
// Reuse permission was confirmed directly with Fever Baseball on 2026-08-18.
// The rendered card still attributes both Fever and the underlying Cot's data.
// This runs nightly, never at request time. Run by hand:
//   node scripts/fever/gen-player-contracts.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shardKey100 } from '../../src/lib/shardKey.js'
import { writeShards } from '../lib/io.js'
import { normalizeContractsPayload } from './normalize-contracts.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', '..', 'public', 'data', 'player-contracts')
const FEED_URL = 'https://www.feverbaseball.com/api/data/contracts'

async function fetchContracts() {
  const response = await fetch(FEED_URL)
  if (!response.ok) throw new Error(`feverbaseball contracts: HTTP ${response.status}`)
  return response.json()
}

async function main() {
  const { meta, players } = normalizeContractsPayload(await fetchContracts())
  const buckets = new Map(
    Array.from({ length: 100 }, (_, number) => [String(number).padStart(2, '0'), {}]),
  )
  for (const [playerId, record] of Object.entries(players)) {
    buckets.get(shardKey100(playerId))[playerId] = record
  }

  const entries = [...buckets].map(([key, bucketPlayers]) => [key, { meta, players: bucketPlayers }])
  const { written, swept } = await writeShards(outDir, entries)
  console.log(
    `wrote ${written} player-contract shards (${Object.keys(players).length} players, season ${meta.season}, swept ${swept})`,
  )
}

main()
