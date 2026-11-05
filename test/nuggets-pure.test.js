import assert from 'node:assert/strict'
import test from 'node:test'
import { THRESHOLDS, meets, thresholdById } from '../src/lib/nuggets/thresholds.js'
import { sumByPlayer, crossingDate, mintNuggets, mintOrHold, newCrossers } from '../scripts/lib/nuggets/nuggets.mjs'

const RBI = thresholdById('rbi100')
const BOTH = thresholdById('rbi100-r100')

test('every threshold is well formed', () => {
  const ids = new Set()
  for (const t of THRESHOLDS) {
    assert.ok(!ids.has(t.id), `duplicate ${t.id}`)
    ids.add(t.id)
    assert.ok(['hitting', 'pitching'].includes(t.group), t.id)
    assert.equal(t.span, 'season', `${t.id}: v1 is the season span only`)
    assert.ok(Number.isInteger(t.plainMax) && t.plainMax > 0, `${t.id}: plainMax`)
    assert.ok(t.all.length > 0 && t.all.every((c) => typeof c.stat === 'string' && c.min > 0), t.id)
  }
})

test('sumByPlayer adds a traded player\'s clubs into one row', () => {
  const rows = sumByPlayer([
    { player: { id: 1 }, stat: { rbi: 60, runs: '10' } },
    { player: { id: 2 }, stat: { rbi: 99 } },
    { player: { id: 1 }, stat: { rbi: 45 } },
  ])
  assert.equal(rows.get(1).rbi, 105)
  assert.equal(rows.get(1).runs, 10)
  assert.ok(meets(RBI, rows.get(1)))
  assert.ok(!meets(RBI, rows.get(2)))
})

test('crossingDate is the first game date at which every condition holds', () => {
  const games = [
    { date: '2026-05-02', stat: { rbi: 51, runs: 99 } },
    { date: '2026-05-01', stat: { rbi: 49, runs: 0 } },
    { date: '2026-05-03', stat: { rbi: 2, runs: 1 } },
  ]
  assert.equal(crossingDate(games, RBI), '2026-05-02')
  assert.equal(crossingDate(games, BOTH), '2026-05-03')
  assert.equal(crossingDate(games.slice(0, 2), BOTH), null)
})

test('newCrossers keeps members with no entry yet', () => {
  const totals = new Map([[1, { rbi: 100 }], [2, { rbi: 120 }], [3, { rbi: 10 }]])
  assert.deepEqual(newCrossers(totals, RBI, [{ player: 1 }]), [2])
})

const pickNone = () => null

test('mintNuggets: count is every entry on or before the date, new crossers included', () => {
  const have = [{ player: 1, date: '2026-05-01', count: 1, anchor: null, relation: null }]
  const out = mintNuggets(have, [{ player: 3, date: '2026-06-01' }, { player: 2, date: '2026-05-10' }, { player: 4, date: '2026-05-10' }], { pickAnchor: pickNone })
  assert.deepEqual(out.map((n) => [n.player, n.date, n.count]), [
    [1, '2026-05-01', 1], [2, '2026-05-10', 3], [4, '2026-05-10', 3], [3, '2026-06-01', 4],
  ])
})

test('mintNuggets never rewrites an old entry and a second run adds nothing', () => {
  const have = [{ player: 1, date: '2026-05-01', count: 1, anchor: 'x', relation: 'equal' }]
  const once = mintNuggets(have, [{ player: 2, date: '2026-04-01' }], { pickAnchor: pickNone })
  assert.deepEqual(once.find((n) => n.player === 1), have[0], 'the old entry is frozen')
  assert.equal(once.find((n) => n.player === 2).count, 1)
  const twice = mintNuggets(once, [{ player: 2, date: '2026-04-01' }], { pickAnchor: pickNone })
  assert.deepEqual(twice, once)
})

// Review (#2949): a crosser whose game log could not be read might be dated before the
// others, and their frozen counts would then be one short. So the threshold waits a night.
test('mintOrHold holds a threshold for the night when any game log failed to load', () => {
  const have = [{ player: 1, date: '2026-05-01', count: 1, anchor: null, relation: null }]
  const held = mintOrHold(have, [{ player: 2, date: '2026-05-10' }, null], { pickAnchor: pickNone })
  assert.equal(held.held, true)
  assert.deepEqual(held.list, have)
  const ok = mintOrHold(have, [{ player: 2, date: '2026-05-10' }, { player: 3, date: null }], { pickAnchor: pickNone })
  assert.equal(ok.held, false, 'a log that loaded but never reaches the line does not hold the rest')
  assert.deepEqual(ok.list.map((n) => n.player), [1, 2])
})

test('mintNuggets freezes the anchor pick with the count', () => {
  const pickAnchor = (count, { seed }) => ({ anchor: { id: `a${count}` }, relation: 'equal', seed })
  const [n] = mintNuggets([], [{ player: 7, date: '2026-05-01' }], { pickAnchor })
  assert.deepEqual(n, { player: 7, date: '2026-05-01', count: 1, anchor: 'a1', relation: 'equal' })
})

// Done means (#2809): the committed 2026 backfill gives the probe's dates
// (.scratch/anchor-callouts/spec.md, "The 2026 shutout cohort").
test('the 2026 store holds the probe\'s shutout cohort', async () => {
  const { default: store } = await import('../public/data/nuggets/2026.json', { with: { type: 'json' } })
  const sho = Object.fromEntries(store.nuggets.sho1.map((n) => [n.player, n]))
  assert.deepEqual([sho[645261].date, sho[645261].count], ['2026-04-01', 1]) // Alcantara
  assert.deepEqual([sho[694819].date, sho[694819].count], ['2026-06-12', 5]) // Misiorowski
  assert.deepEqual([sho[669160].date, sho[669160].count], ['2026-06-15', 6]) // May
  assert.deepEqual([sho[691587].date, sho[691587].count, sho[691587].anchor, sho[691587].relation], ['2026-09-25', 11, 'moon-walked', 'fewer']) // Pérez
  for (const t of THRESHOLDS) {
    const list = store.nuggets[t.id]
    assert.ok(Array.isArray(list), `${t.id} is in the store`)
    list.forEach((n, i) => assert.ok(i === 0 || list[i - 1].date <= n.date, `${t.id} is sorted by date`))
  }
})
