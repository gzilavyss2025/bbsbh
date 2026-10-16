// The per-club rank block gen-team-records.mjs writes into each shard as
// `ranks`, read back by src/api/teamrecords/ranks.js. It runs the app's own
// buildRankingIndex + rankMetric once per scope over a level's shards, so the
// card's "4 of 30" and the /situational-records board cannot disagree.
//
// Shape, per club:  { n, scopes: ['all','all:3',…,'pre',…], m: { metricId: [rank per scope] } }
// `n` is the level's club count. A rank of 0 means "not ranked in that scope"
// (the club never was in the split); a metric with no rank anywhere is left out.
// Metric-major arrays rather than scope-major objects: the ids are the bulk of
// the bytes and this writes each one once per club.
import { buildRankingIndex, rankMetric, levelMonths } from '../../../src/api/situationalRecordRankings.js'
import { rankScopeKey } from '../../../src/api/teamrecords/ranks.js'

// `shards`: one level's club files. Returns Map(teamId -> ranks block).
// The half and the month COMBINE: every month is ranked within each half, so
// "Pre-All-Star, May" is its own scope.
export function levelRanks(shards) {
  const entries = shards.filter((s) => s.games?.length).map((data) => ({ team: { id: data.teamId }, data }))
  const halves = entries.some((e) => e.data.allStarDate) ? ['all', 'pre', 'post'] : ['all']
  const months = levelMonths(entries).map((m) => m.month)
  const candidates = halves.flatMap((half) =>
    [null, ...months].map((month) => ({ half, month, key: rankScopeKey(half, month) })),
  )
  // Rank each scope once, then keep only those some club is ranked in: a month
  // on the wrong side of the break (post-All-Star April) would ship all zeros.
  const scopes = candidates
    .map((c) => {
      const index = buildRankingIndex(entries, { half: c.half, month: c.month })
      return { ...c, metrics: [...index.metrics.keys()].map((id) => [id, rankMetric(index, id).ranked.filter((r) => r.rank != null)]) }
    })
    .filter((c) => c.metrics.some(([, rows]) => rows.length))

  const out = new Map(entries.map((e) => [e.team.id, { n: entries.length, scopes: scopes.map((s) => s.key), m: {} }]))
  scopes.forEach(({ metrics }, i) => {
    for (const [id, rows] of metrics) {
      for (const row of rows) {
        const m = out.get(row.teamId).m
        ;(m[id] ??= new Array(scopes.length).fill(0))[i] = row.rank
      }
    }
  })
  return out
}
