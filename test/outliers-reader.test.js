import assert from 'node:assert/strict'
import test from 'node:test'
import { cutoffSpan, flagsAsOf, groupFlags, packFlag } from '../src/api/hotcold/outliers.js'

// The reader of public/data/outliers/{season}.json (#2453). An entry is dated by its game
// and holds the callouts AFTER that game; a cutoff takes the latest entry dated before it.
const ops = (pct) => ['ops', 0, 0.4, pct, 12, 'e']
const FILE = {
  first: '2026-03-25',
  last: '2026-09-27',
  players: [
    // Flagged from Apr 10, closed on Apr 20.
    { i: 1, n: 'A One', r: 'h', f: [['2026-04-10', [ops(0.5)]], ['2026-04-12', [ops(1)]], ['2026-04-20', 0]] },
    { i: 2, n: 'B Two', r: 'p', f: [['2026-04-11', [['era', 1, 1.5, 99.2, 31, 'f']]]] },
  ],
}

test('a cutoff counts only entries dated before it', () => {
  assert.deepEqual(flagsAsOf(FILE, '2026-04-10'), [], 'the Apr 10 entry is not counted for a cutoff of Apr 10')
  assert.deepEqual(flagsAsOf(FILE, '2026-04-11').map((f) => f.id), [1])
})

test('the latest entry wins, and a closing marker removes the flag', () => {
  assert.equal(flagsAsOf(FILE, '2026-04-15').find((f) => f.id === 1).percentile, 1)
  assert.deepEqual(flagsAsOf(FILE, '2026-04-21').map((f) => f.id), [2])
})

test('flags unpack to a role, a tone and a weight word, most unusual first', () => {
  const out = flagsAsOf(FILE, '2026-04-15')
  assert.deepEqual(out.map((f) => [f.id, f.role, f.tone, f.weight]), [[2, 'pitching', 'hot', 'firm'], [1, 'hitting', 'cold', 'early']])
})

test('groups split by role and callout type', () => {
  const g = groupFlags(flagsAsOf(FILE, '2026-04-15'))
  assert.deepEqual(g.hitting.map((x) => x.id), ['hitting:ops:cold'])
  assert.deepEqual(g.pitching.map((x) => x.id), ['pitching:era:hot'])
})

test('the slider spans the first game date to the day after the last, never past today', () => {
  assert.deepEqual(cutoffSpan(FILE, '2026-10-21'), { min: '2026-03-25', max: '2026-09-28' })
  assert.deepEqual(cutoffSpan(FILE, '2026-09-27'), { min: '2026-03-25', max: '2026-09-27' })
})

test('packFlag keeps what a row prints', () => {
  const f = { key: 'ops', tone: 'cold', value: 0.123456, percentile: 1.04, sample: 12, weight: 'early' }
  assert.deepEqual(packFlag(f), ['ops', 0, 0.1235, 1, 12, 'e'])
})

test('a packed pace value keeps enough digits for its 1/N figure', () => {
  const flag = { key: 'hr', tone: 'cold', value: 1 / 300, percentile: 1.2, sample: 300, weight: 'real' }
  assert.equal(Math.round(1 / packFlag(flag)[2]), 300)
})
