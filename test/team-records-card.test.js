// The Records card's model (next/standings/records/recordsModel.js): the cutoff gate on every rank,
// the d + s on every door, the thin-split cut-off, and the MiLB and pre-ranks shards.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { groupCount, inningRows, MIN_RANKED, recordsModel, axisPos } from '../src/screens/team/next/standings/records/recordsModel.js'
import { rankPos, rankThird } from '../src/components/ui/frame/rankBar.js'

const shard = (id) => JSON.parse(readFileSync(new URL(`../public/data/team-records/2026/${id}.json`, import.meta.url)))
const brewers = shard(158)
const rows = (m) => m.groups.flatMap((g) => g.rows)

test('live page: ranks show, with the level size', () => {
  const m = recordsModel(brewers, { asOf: null })
  assert.equal(m.of, 30)
  assert.ok(rows(m).some((r) => r.rank && r.rank.of === 30))
  assert.ok(m.groups.find((g) => g.title === 'Scoring').ticks.length > 0)
})

test('dated page: a cutoff turns every rank into a dash and drops the strips', () => {
  const m = recordsModel(brewers, { cutoff: '2026-06-01', asOf: '2026-06-02' })
  assert.equal(m.of, null)
  assert.ok(rows(m).length > 0)
  assert.ok(rows(m).every((r) => r.rank === null))
  assert.ok(m.groups.every((g) => g.ticks.length === 0))
})

test('the card hands recordsModel the page cutoff and date', () => {
  const src = readFileSync(new URL('../src/screens/team/next/standings/records/RecordsCard.jsx', import.meta.url), 'utf8')
  assert.match(src, /recordsModel\(data,\s*\{[^}]*\bcutoff\b[^}]*\basOf\b/s)
})

test('every door carries d and s, the half and the month', () => {
  const m = recordsModel(brewers, { asOf: '2026-08-10', cutoff: '2026-08-09', half: 'post', month: 8 })
  for (const r of rows(m)) {
    const q = new URL(r.to, 'https://x').searchParams
    assert.equal(q.get('d'), '2026-08-10', r.id)
    assert.equal(q.get('s'), '1', r.id)
    assert.equal(q.get('half'), 'post', r.id)
    assert.equal(q.get('month'), '8', r.id)
    assert.equal(q.get('metric'), r.id)
  }
})

test('a thin split shows no rank', () => {
  const m = recordsModel(brewers, { month: 4 })
  const thin = rows(m).filter((r) => r.played < MIN_RANKED)
  assert.ok(thin.length > 0)
  assert.ok(thin.every((r) => r.rank === null))
  assert.ok(rows(m).some((r) => r.played >= MIN_RANKED && r.rank))
})

test('half and month combine: the rank is the scope\'s own', () => {
  const a = recordsModel(brewers, { half: 'pre', month: 7 })
  const b = recordsModel(brewers, { month: 7 })
  assert.notDeepEqual(rows(a).map((r) => r.rank?.rank), rows(b).map((r) => r.rank?.rank))
})

test('a pre-ranks shard keeps its rows and has no strips', () => {
  const { ranks, ...old } = brewers
  const m = recordsModel(old, {})
  assert.equal(m.of, null)
  assert.ok(rows(m).length > 0 && rows(m).every((r) => r.rank === null))
})

test('Single-A: 11 groups with the counts, no "By league"', () => {
  const milb = shard(249)
  const m = recordsModel(milb, {})
  assert.ok(!m.groups.some((g) => g.title === 'By league'))
  assert.equal(m.groups.length, groupCount(milb))
  // The shards are regenerated nightly, so the count is pinned by shape, not by a number: the MLB
  // shard has exactly the one extra "By league" group.
  assert.ok(recordsModel(brewers, {}).groups.some((g) => g.title === 'By league'))
  assert.equal(groupCount(brewers), groupCount(milb) + 1)
})

test('the inning rows pair the halves and pick the better one', () => {
  const { innings, extras } = inningRows(recordsModel(brewers, {}).groups.find((g) => g.title === 'Scoring by inning'))
  assert.equal(innings.length, 9)
  for (const i of innings) {
    if (i.better) assert.ok(i[i.better].rate > i[i.better === 'top' ? 'bottom' : 'top'].rate)
  }
  assert.ok(extras === null || extras.id === 'scored-extras')
  assert.equal(axisPos(0.2), 0)
  assert.equal(axisPos(0.95), 1)
  assert.equal(axisPos(0.65), 0.5)
})

test('rank bar: best at the right, thirds from the level size', () => {
  assert.equal(rankPos(1, 30), 1)
  assert.equal(rankPos(30, 30), 0)
  assert.deepEqual([1, 10, 11, 20, 21, 30].map((r) => rankThird(r, 30)), ['top', 'top', 'mid', 'mid', 'low', 'low'])
})
