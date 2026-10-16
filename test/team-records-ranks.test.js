// The nightly rank block (scripts/lib/records/ranks.mjs) and its reader
// (src/api/teamrecords/ranks.js). The numbers must be rankMetric's own, so the
// main test recomputes them through buildRankingIndex/rankMetric and compares.
import assert from 'node:assert/strict'
import test from 'node:test'
import { levelRanks } from '../scripts/lib/records/ranks.mjs'
import { rankOf } from '../src/api/teamrecords/ranks.js'
import { buildRankingIndex, rankMetric } from '../src/api/situationalRecordRankings.js'

const g = (d, over) => ({ d, o: 10, r: 'W', rs: 5, ra: 2, hi: 9, ha: 7, ...over })
const shard = (teamId, games) => ({ teamId, season: 2026, sportId: 1, allStarDate: '2026-07-14', opponents: {}, names: {}, dailyRank: {}, games })

// Club 1: wins in April, loses after the break. Club 2: the reverse. Club 3 ties club 1.
const shards = [
  shard(1, [g('2026-04-01'), g('2026-04-02'), g('2026-07-20', { r: 'L' })]),
  shard(2, [g('2026-04-01', { r: 'L' }), g('2026-05-02', { r: 'L' }), g('2026-07-20')]),
  shard(3, [g('2026-04-01'), g('2026-04-02'), g('2026-07-20', { r: 'L' })]),
]
const entries = shards.map((data) => ({ team: { id: data.teamId }, data }))

test('every rank equals rankMetric for the same scope, ties sharing a rank', () => {
  const ranks = levelRanks(shards)
  for (const [half, month] of [['all', null], ['pre', null], ['post', null], ['all', 4], ['pre', 5], ['post', 7]]) {
    const index = buildRankingIndex(entries, { half, month })
    for (const id of index.metrics.keys()) {
      for (const row of rankMetric(index, id).ranked) {
        const got = rankOf({ ranks: ranks.get(row.teamId) }, id, { half, month })
        assert.equal(got?.rank ?? null, row.rank, `${id} ${half} ${month} club ${row.teamId}`)
        if (got) assert.equal(got.of, 3)
      }
    }
  }
  // Clubs 1 and 3 are identical: both rank 1 in the April scope, club 2 third.
  const t = (id) => rankOf({ ranks: ranks.get(id) }, 'scored-4-plus', { month: 4 })
  assert.deepEqual([t(1).rank, t(3).rank, t(2).rank], [1, 1, 3])
})

test('hand-checked: club 2 alone wins after the break, clubs 1 and 3 tie', () => {
  const ranks = levelRanks(shards)
  const at = (id) => rankOf({ ranks: ranks.get(id) }, 'scored-4-plus', { half: 'post' })
  assert.deepEqual([at(2).rank, at(1).rank, at(3).rank], [1, 2, 2])
})

test('a scope no club is ranked in is not shipped', () => {
  // Nobody played April after the break.
  assert.ok(!levelRanks(shards).get(1).scopes.includes('post:4'))
})

test('half and month combine: Pre-All-Star May ranks differ from full-season May', () => {
  const ranks = levelRanks(shards)
  assert.ok(ranks.get(1).scopes.includes('pre:5'))
  assert.equal(rankOf({ ranks: ranks.get(2) }, 'scored-4-plus', { half: 'pre', month: 5 })?.of, 3)
})

test('no All-Star date means no half scopes', () => {
  const ranks = levelRanks(shards.map((s) => ({ ...s, allStarDate: null })))
  assert.deepEqual(ranks.get(1).scopes, ['all', 'all:4', 'all:5', 'all:7'])
})

test('missing data reads null, never throws', () => {
  const ranks = { ranks: levelRanks(shards).get(1) }
  assert.equal(rankOf(null, 'scored-4-plus'), null)
  assert.equal(rankOf({}, 'scored-4-plus'), null)
  assert.equal(rankOf(ranks, 'no-such-metric'), null)
  assert.equal(rankOf(ranks, 'scored-4-plus', { month: 12 }), null)
  assert.equal(rankOf(ranks, 'scored-4-plus', { cutoff: '2026-05-01' }), null)
  assert.ok(rankOf(ranks, 'scored-4-plus'))
})
