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
import { computePayRanks, largestSplit } from '../lib/contract-pay-rank.mjs'
import { mapConcurrent } from '../lib/concurrency.mjs'
import { writeShards } from '../lib/io.js'
import { getJson } from '../lib/statsapi.mjs'
import { normalizeContractsPayload } from './normalize-contracts.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', '..', 'public', 'data', 'player-contracts')
const FEED_URL = 'https://www.feverbaseball.com/api/data/contracts'

// The Contract card's positional pay rank needs a primary position per player,
// which the Fever feed does not carry. statsapi's /people endpoint takes a
// comma-joined personIds list, and the SAME call can hydrate pitching stats —
// so the SP/RP split (see contract-pay-rank.mjs, judgement call 1) costs no
// extra round trips, only a hydrate parameter. ~1,300 players is 13 requests.
// Conservative chunking for the same reason prospectAgeBenchmark.mjs gives:
// statsapi documents no cap on personIds, but a large single query risks a
// slow or failed response, and here that would cost the whole league's ranks.
const CHUNK_SIZE = 100
const CONCURRENCY = 4
const STATS_HYDRATE = 'stats(group=[pitching],type=[season,career],season=SEASON)'

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function statLine(person, typeName) {
  const group = (person.stats ?? []).find((entry) => entry.type?.displayName === typeName)
  return largestSplit(group?.splits)
}

// Map<playerId, { position, season, career }> for contract-pay-rank.mjs.
// A chunk that fails leaves its players without a position, which costs them
// their rank and nothing else — one flaky request must not fail the nightly
// run and blank every shard.
async function fetchPositionMeta(ids, season) {
  const hydrate = STATS_HYDRATE.replace('SEASON', String(season))
  const chunks = chunk(ids, CHUNK_SIZE)
  const results = await mapConcurrent(chunks, CONCURRENCY, async (idChunk) => {
    const query = `personIds=${idChunk.join(',')}&hydrate=${encodeURIComponent(hydrate)}`
    try {
      return (await getJson(`/api/v1/people?${query}`)).people ?? []
    } catch (error) {
      console.warn(`player-contracts: position lookup failed for ${idChunk.length} players — ${error.message}`)
      return []
    }
  })
  const byId = new Map()
  for (const people of results) {
    for (const person of people ?? []) {
      byId.set(String(person.id), {
        position: person.primaryPosition?.abbreviation ?? null,
        season: statLine(person, 'season'),
        career: statLine(person, 'career'),
      })
    }
  }
  return byId
}

async function fetchContracts() {
  const response = await fetch(FEED_URL)
  if (!response.ok) throw new Error(`feverbaseball contracts: HTTP ${response.status}`)
  return response.json()
}

async function main() {
  const { meta, players } = normalizeContractsPayload(await fetchContracts())

  const positions = await fetchPositionMeta(Object.keys(players), meta.season)
  const payRanks = computePayRanks(players, positions, meta.season)
  for (const [playerId, record] of Object.entries(players)) {
    record.payRank = payRanks.get(String(playerId)) ?? null
  }

  const buckets = new Map(
    Array.from({ length: 100 }, (_, number) => [String(number).padStart(2, '0'), {}]),
  )
  for (const [playerId, record] of Object.entries(players)) {
    buckets.get(shardKey100(playerId))[playerId] = record
  }

  const entries = [...buckets].map(([key, bucketPlayers]) => [key, { meta, players: bucketPlayers }])
  const { written, swept } = await writeShards(outDir, entries)
  console.log(
    `wrote ${written} player-contract shards (${Object.keys(players).length} players, ` +
      `${payRanks.size} pay-ranked, season ${meta.season}, swept ${swept})`,
  )
}

main()
