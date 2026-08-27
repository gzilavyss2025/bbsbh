import { shardKey100, termsBucketKey } from '../lib/shardKey.js'
import { staticJsonBy } from './staticJson.js'

// The historical-contract read side: makes an admin's correction (recorded by
// /api/contract-identity, ADR-0066) visible to a reader without regenerating
// any static file. Two data sources, both static and both allowed to be
// missing without failing the page:
//
//   - a PLAYER shard, one file per shardKey100(personId), holding the rows the
//     build-time identity match already assigned to this player:
//       { meta, players: { [mlbId]: [{ rowKey, sourceFile, season, teamId,
//         terms, confidence }, ...] } }
//   - TERMS buckets, one file per `${sourceFile}-${bucket}`, holding the full
//     parsed row (season, teamId, terms) for every row a source file produced,
//     independent of which player (if any) it was matched to. This is the
//     join target for a row an admin reassigns to a player whose own shard
//     never carried it — an unresolved or wrongly-matched row. The file's
//     top level IS the rowKey map — { [rowKey]: { season, teamId, terms } },
//     no wrapper key of any kind.
//
// The live override map from /api/contract-identity sits between the two: it
// can dismiss a shard row, reassign it to a different mlbId, or promote/demote
// its confidence, and none of that touches the static files.
const fetchShard = staticJsonBy(
  (key) => `/data/contracts-history/player/${key}.json`,
  { fallback: null },
)

const fetchTermsBucket = staticJsonBy(
  (key) => `/data/contracts-history/terms/${key}.json`,
  { fallback: null },
)

async function fetchOverrides() {
  // Public, edge-cached ~60s (ADR-0066). A failure here degrades to {} —
  // the shard's own rows still render; only corrections are missing.
  try {
    const res = await fetch('/api/contract-identity')
    if (!res.ok) return {}
    const data = await res.json()
    return data?.overrides ?? {}
  } catch {
    return {}
  }
}

// The pure merge step, so a test can exercise it without any fetching.
//
//   personId       — whose history this is; decides which override entries
//                     are "mine" to append, and which shard rows were
//                     reassigned away and must drop.
//   shardRows      — this player's rows from their own shard (possibly []).
//   overrides      — the full { rowKey: override } map from
//                     /api/contract-identity. An override never carries
//                     meta.source/sourceUrl/attribution, and neither does
//                     anything this function returns — SourceLine already
//                     renders nothing when meta.source is unset, so leaving
//                     it unset IS the correct behaviour for Gary's own data.
//   termsByRowKey  — { rowKey: { season, teamId, terms } }, joined from
//                     whichever terms buckets the caller fetched. A rowKey
//                     with no entry here (missing bucket, or the row isn't
//                     in it) is skipped, never thrown.
export function mergeContractHistoryRows(personId, shardRows, overrides, termsByRowKey) {
  const overrideMap = overrides ?? {}
  const termsLookup = termsByRowKey ?? {}
  const id = personId == null ? null : String(personId)
  const carried = new Set()
  const rows = []

  for (const row of shardRows ?? []) {
    const override = overrideMap[row.rowKey]
    if (!override) {
      carried.add(row.rowKey)
      rows.push({
        rowKey: row.rowKey,
        sourceFile: row.sourceFile,
        season: row.season,
        teamId: row.teamId,
        terms: row.terms,
        confidence: row.confidence,
        originalConfidence: row.confidence,
      })
      continue
    }
    // Dismissed, or reassigned to someone else's history: this player's
    // shard no longer carries the row at all.
    if (override.dismissed) continue
    if (override.mlbId != null && String(override.mlbId) !== id) continue

    carried.add(row.rowKey)
    rows.push({
      rowKey: row.rowKey,
      sourceFile: row.sourceFile,
      season: row.season,
      teamId: row.teamId,
      terms: row.terms,
      // Present in both: the override's confidence wins outright. A
      // promoted row (confidence 'exact', originalConfidence 'fuzzy') reads
      // as exact here — that is the entire point of promoting it.
      confidence: override.confidence ?? row.confidence,
      originalConfidence: override.originalConfidence ?? row.confidence,
    })
  }

  // A row "mine" names that the shard never carried — reassigned in from
  // another player's shard, or resolved for the first time — joins its
  // season/teamId/terms from the terms bucket the caller fetched.
  for (const [rowKey, override] of Object.entries(overrideMap)) {
    if (carried.has(rowKey)) continue
    if (override.dismissed) continue
    if (id == null || override.mlbId == null || String(override.mlbId) !== id) continue

    const joined = termsLookup[rowKey]
    if (!joined) continue // missing bucket file: skip the row, don't throw

    rows.push({
      rowKey,
      sourceFile: rowKey.split('#')[0],
      season: joined.season,
      teamId: joined.teamId,
      terms: joined.terms,
      confidence: override.confidence,
      originalConfidence: override.originalConfidence ?? override.confidence,
    })
  }

  return rows.sort((a, b) => b.season - a.season)
}

export async function fetchPlayerContractHistory(personId) {
  if (personId == null) return []
  const id = String(personId)

  const shard = await fetchShard(shardKey100(personId))
  const shardRows = shard?.players?.[personId] ?? []

  const overrides = await fetchOverrides()

  const mineRowKeys = Object.entries(overrides)
    .filter(([, override]) => !override.dismissed && override.mlbId != null && String(override.mlbId) === id)
    .map(([rowKey]) => rowKey)

  const bucketKeys = new Set(mineRowKeys.map(termsBucketKey))
  const termsByRowKey = {}
  await Promise.all(
    [...bucketKeys].map(async (key) => {
      const bucket = await fetchTermsBucket(key)
      // The bucket file's top level IS the rowKey map — no `.rows` wrapper.
      // A missing bucket (fetchTermsBucket's null fallback) just contributes
      // nothing; the affected rows fall through mergeContractHistoryRows's
      // `if (!joined) continue`.
      if (bucket && typeof bucket === 'object') Object.assign(termsByRowKey, bucket)
    }),
  )

  return mergeContractHistoryRows(personId, shardRows, overrides, termsByRowKey)
}
