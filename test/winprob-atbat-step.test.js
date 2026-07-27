// lastVisibleAtBatIndex (playbyplay.js) — the boundary PlayByPlay reports back
// via onStepInfo so InningViewer can clamp the win-probability chart to grow
// one point per at-bat step (ADR-0016) instead of jumping a whole half at
// once (see api/winprob.js's stepHalfIndex/throughAtBatIndex, and
// test/winprob.test.js for the selector-side coverage). Entries are hand-built
// here — the function only reads `.kind`/`.atBatIndex`, the same shape
// computeHalfInningFeed produces, so a synthetic array is sufficient and
// avoids needing atBatIndex wired into the shared mini-game fixture.
import assert from 'node:assert/strict'
import test from 'node:test'
import { lastVisibleAtBatIndex } from '../src/api/playbyplay.js'

const atbat = (atBatIndex) => ({ kind: 'atbat', atBatIndex })
const event = (eventType) => ({ kind: 'event', eventType })
const placed = () => ({ kind: 'placed' })

test('lastVisibleAtBatIndex reads the last at-bat within the cap', () => {
  const entries = [atbat(0), atbat(1), atbat(2)]
  assert.equal(lastVisibleAtBatIndex(entries, 1), 0)
  assert.equal(lastVisibleAtBatIndex(entries, 2), 1)
  assert.equal(lastVisibleAtBatIndex(entries, 3), 2)
})

test('lastVisibleAtBatIndex skips trailing event/placed entries with no atBatIndex', () => {
  // A step commonly ends on a sub notice trailing the at-bat it followed
  // (nextStepBoundary bundles the two) — the boundary must still resolve to
  // the at-bat's own atBatIndex, not null.
  const entries = [atbat(0), atbat(5), event('pitching_substitution'), placed()]
  assert.equal(lastVisibleAtBatIndex(entries, 4), 5)
  assert.equal(lastVisibleAtBatIndex(entries, 3), 5)
})

test('lastVisibleAtBatIndex is null before any at-bat card is visible', () => {
  // A fresh half's opening entries can be leading event notes only (a
  // pre-pitch sub announced ahead of the first batter).
  const entries = [event('defensive_substitution'), atbat(3)]
  assert.equal(lastVisibleAtBatIndex(entries, 1), null)
  assert.equal(lastVisibleAtBatIndex(entries, 0), null)
  assert.equal(lastVisibleAtBatIndex([], 0), null)
})

test('lastVisibleAtBatIndex defaults the cap to the whole array', () => {
  const entries = [atbat(0), atbat(1)]
  assert.equal(lastVisibleAtBatIndex(entries, null), 1)
})

test('lastVisibleAtBatIndex ignores an interrupted at-bat with no atBatIndex on record', () => {
  // Defensive: computeHalfInningFeed always sets atBatIndex from the play's
  // own about.atBatIndex, but a null-guarded read (play.about?.atBatIndex ??
  // null) is still possible in principle — must not surface it as a boundary.
  const entries = [atbat(2), { kind: 'atbat', atBatIndex: null }]
  assert.equal(lastVisibleAtBatIndex(entries, 2), 2)
})
