// The nightly job's input gates: a game-prep step runs only when an MLB game
// (spring training included) is scheduled soon, a game-result step only when a
// game went Final since the last run. Driven by the schedule, never the
// calendar, so both switch back on by themselves the day games appear.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GATES, decideGates, skippedDatasets } from '../scripts/nightly/inputs.mjs'
import { existsSync } from 'node:fs'
import { evaluate } from '../scripts/check-data-freshness.mjs'

const game = (codedGameState, abstractGameCode = 'F') => ({ status: { codedGameState, abstractGameCode } })
const sched = (...games) => ({ dates: [{ games }] })

test('no games in either window closes both gates', () => {
  assert.deepEqual(decideGates({ upcoming: sched(), recent: sched() }), { upcoming: false, finals: false })
})

test('a scheduled spring game opens upcoming; a played Final opens finals', () => {
  assert.deepEqual(decideGates({ upcoming: sched(game('S', 'P')), recent: sched(game('F')) }), { upcoming: true, finals: true })
})

test('a cancelled or postponed game opens neither gate', () => {
  assert.deepEqual(decideGates({ upcoming: sched(game('C'), game('D')), recent: sched(game('C'), game('D')) }), { upcoming: false, finals: false })
})

test('a schedule that could not be read opens its gate: a wasted run beats a dark step', () => {
  assert.deepEqual(decideGates({ upcoming: null, recent: null }), { upcoming: true, finals: true })
})

test('every gated step names the datasets it writes, and those exist as freshness names', () => {
  for (const [step, g] of Object.entries(GATES)) {
    assert.ok(['upcoming', 'finals'].includes(g.when), step)
    assert.ok(g.datasets.length > 0, step)
    for (const d of g.datasets) {
      assert.match(d, /\.json$|\/$/, `${step}: ${d}`)
      assert.ok(existsSync(`public/data/${d}`), `${step}: public/data/${d} does not exist, so freshness would never exempt it`)
    }
  }
})

test('a closed gate lists its steps datasets as skipped, and freshness exempts them', () => {
  const skipped = skippedDatasets({ upcoming: false, finals: true })
  assert.ok(skipped.includes('vs-team-splits/'))
  assert.ok(!skipped.includes('spray/'))
  const now = Date.parse('2026-11-05T08:30:00Z')
  const old = { key: 'generatedAt', value: '2026-11-01T08:00:00Z' }
  const r = evaluate([{ name: 'vs-team-splits/', stamp: old }, { name: 'war.json', stamp: old }], { now, skipped })
  assert.deepEqual(r.stale.map((s) => s.name), ['war.json'])
  assert.deepEqual(r.skipped, ['vs-team-splits/'])
})
