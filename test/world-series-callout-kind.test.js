// A World Series callout wears the trophy instead of the star. The flag comes
// from the note's `kind` alone, so the note builders need no change.
import assert from 'node:assert/strict'
import test from 'node:test'
import { isWorldSeriesKind } from '../src/lib/worldSeries/calloutKind.js'

test('every World Series kind is flagged', () => {
  for (const k of ['wsSeriesOdds', 'wsStarterStart', 'wsLastTime', 'wsLastTimeGame', 'wsWtaTrailing9']) {
    assert.equal(isWorldSeriesKind(k), true, k)
  }
})

test('other kinds, and a missing kind, keep the star', () => {
  for (const k of ['leader', 'marathonAb', 'starterRec', 'wsx', 'wasted', '', null, undefined]) {
    assert.equal(isWorldSeriesKind(k), false, String(k))
  }
})
