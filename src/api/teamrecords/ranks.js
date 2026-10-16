// Where a club's situational record ranks among the clubs at its level, read
// off the `ranks` field gen-team-records.mjs writes into each club's shard
// (scripts/lib/records/ranks.mjs, which runs situationalRecordRankings.js's own
// buildRankingIndex/rankMetric). One request: the card already holds the shard.
//
// CUTOFF-GATED. The ranks are the whole season through the last nightly, so
// they cannot answer a dated (`?d=`) page without looking past its date. A
// cutoff therefore reads null, the same as a shard with no ranks: the caller
// prints a dash, never a rank from the future.
//
// Never throws. A missing shard, a pre-ranks shard, an unknown metric or a
// scope the file does not carry (a month the level never played) read null.

// The scope names a half and a month the way teamRecordsFor takes them.
export const rankScopeKey = (half = 'all', month = null) => (month ? `${half}:${month}` : half)

// { rank, of } for one metric in one scope, or null. `of` is the level's club
// count, the "30" in "4 of 30". `metricId` is a RECORD_GROUPS row id or a
// COUNT_METRICS id.
export function rankOf(data, metricId, { half = 'all', month = null, cutoff = null } = {}) {
  const ranks = data?.ranks
  if (cutoff || !ranks) return null
  const i = ranks.scopes?.indexOf(rankScopeKey(half, month)) ?? -1
  const rank = i < 0 ? 0 : ranks.m?.[metricId]?.[i]
  return rank ? { rank, of: ranks.n } : null
}
