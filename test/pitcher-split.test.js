// Coverage for src/api/pitcherSplit.js's splitPitchingStaff — the shared
// Starting Pitchers / Bullpen partition used by loadRoster.js (season) and
// recentForm.js (last-10-games). Pins the bug it replaced: two independently
// capped top-N lists could both reject the same pitcher.
import assert from 'node:assert/strict'
import test from 'node:test'
import { splitPitchingStaff } from '../src/api/pitcherSplit.js'

const compareStarters = (a, b) => b.starts - a.starts
const compareRelievers = (a, b) => b.appearances - a.appearances

test('every pitcher who started at least one game is a starter — no top-N cutoff', () => {
  const entries = [1, 2, 3, 4, 5, 6].map((id) => ({ id, starts: 7 - id, appearances: 0, saves: 0 }))
  const { starters, bullpen } = splitPitchingStaff(entries, { compareStarters, compareRelievers })
  assert.deepEqual(starters.map((s) => s.id), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(bullpen, [])
})

test('a 6th starter with no relief appearances is not dropped from both sections', () => {
  // The Kyle Harrison/Brewers bug: a 6th starter, ranked below an old top-5
  // starters cutoff, had zero relief appearances — so he never qualified for
  // the Bullpen list either and vanished from the roster page entirely.
  const entries = [
    { id: 1, starts: 10, appearances: 0, saves: 0 },
    { id: 2, starts: 9, appearances: 0, saves: 0 },
    { id: 3, starts: 8, appearances: 0, saves: 0 },
    { id: 4, starts: 7, appearances: 0, saves: 0 },
    { id: 5, starts: 6, appearances: 0, saves: 0 },
    { id: 6, starts: 1, appearances: 0, saves: 0 }, // the 6th man
  ]
  const { starters, bullpen } = splitPitchingStaff(entries, { compareStarters, compareRelievers })
  assert.equal(starters.some((s) => s.id === 6), true)
  assert.equal(bullpen.some((s) => s.id === 6), false)
})

test('the closer (most saves) leads the bullpen; everyone else ranks by the caller comparator', () => {
  const entries = [
    { id: 1, starts: 30, appearances: 0, saves: 0 },
    { id: 2, starts: 0, appearances: 40, saves: 1 },
    { id: 3, starts: 0, appearances: 55, saves: 20 },
  ]
  const { starters, bullpen } = splitPitchingStaff(entries, { compareStarters, compareRelievers })
  assert.deepEqual(starters.map((s) => s.id), [1])
  assert.deepEqual(bullpen.map((s) => s.id), [3, 2])
})

test('no saves at all means no closer — everyone in the bullpen ranks by the comparator alone', () => {
  const entries = [
    { id: 1, starts: 30, appearances: 0, saves: 0 },
    { id: 2, starts: 0, appearances: 20, saves: 0 },
    { id: 3, starts: 0, appearances: 40, saves: 0 },
  ]
  const { bullpen } = splitPitchingStaff(entries, { compareStarters, compareRelievers })
  assert.deepEqual(bullpen.map((s) => s.id), [3, 2])
})

test('a pitcher who has neither started nor appeared is excluded from both sections', () => {
  const entries = [{ id: 1, starts: 0, appearances: 0, saves: 0 }]
  const { starters, bullpen } = splitPitchingStaff(entries, { compareStarters, compareRelievers })
  assert.deepEqual(starters, [])
  assert.deepEqual(bullpen, [])
})
