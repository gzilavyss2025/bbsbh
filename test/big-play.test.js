import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { bigPlayKind } from '../src/components/inning/focus/bigPlay.js'
import { BIG_PLAY_MS } from '../src/components/inning/focus/beats.js'

const ab = (o) => ({ kind: 'atbat', live: false, rbi: 0, outNumber: null, basesAfter: [], ...o })

test('home runs: a grand slam is told from the rest by its four RBI', () => {
  assert.equal(bigPlayKind(ab({ eventType: 'home_run', rbi: 1 })), 'homer')
  assert.equal(bigPlayKind(ab({ eventType: 'home_run', rbi: 3 })), 'homer')
  assert.equal(bigPlayKind(ab({ eventType: 'home_run', rbi: 4 })), 'slam')
})

test('extra-base hits', () => {
  assert.equal(bigPlayKind(ab({ eventType: 'triple' })), 'triple')
  assert.equal(bigPlayKind(ab({ eventType: 'double' })), 'double')
  assert.equal(bigPlayKind(ab({ eventType: 'single' })), null)
})

test('the bases left loaded: the third out with all three bases held', () => {
  assert.equal(bigPlayKind(ab({ eventType: 'strikeout', outNumber: 3, basesAfter: [1, 2, 3] })), 'stranded')
  assert.equal(bigPlayKind(ab({ eventType: 'strikeout', outNumber: 3, basesAfter: [1, 3] })), null)
  assert.equal(bigPlayKind(ab({ eventType: 'strikeout', outNumber: 2, basesAfter: [1, 2, 3] })), null)
})

test('a live plate appearance, a non-at-bat card and a missing entry get no stamp', () => {
  assert.equal(bigPlayKind(ab({ eventType: 'home_run', live: true })), null)
  assert.equal(bigPlayKind({ kind: 'event', eventType: 'home_run' }), null)
  assert.equal(bigPlayKind(null), null)
})

test('every kind has a literal duration, and the classifier imports nothing', () => {
  for (const k of ['slam', 'homer', 'triple', 'double', 'stranded']) {
    assert.ok(Number.isFinite(BIG_PLAY_MS[k]) && BIG_PLAY_MS[k] > 0, `${k} has no duration`)
  }
  const src = readFileSync(new URL('../src/components/inning/focus/bigPlay.js', import.meta.url), 'utf8')
  assert.equal(/^\s*import\b/m.test(src.replace(/^\s*\/\/.*$/gm, '')), false)
})
