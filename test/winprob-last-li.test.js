// Gameday's Pressure meter (#3006) shows the last revealed play's leverage:
// the last point selectWinProbPath lets through, never a play past the reveal.
import assert from 'node:assert/strict'
import test from 'node:test'
import { selectLastLi, selectWinProbPath } from '../src/api/winprob.js'
import { halfIndex } from '../src/api/select.js'

const row = (home, inning, isTopInning, atBatIndex, leverageIndex) => ({
  homeTeamWinProbability: home, ...(leverageIndex === undefined ? {} : { leverageIndex }),
  about: { inning, isTopInning, isScoringPlay: false, atBatIndex },
  result: { description: `play ${atBatIndex}` },
})
const feed = [row(52, 1, true, 0), row(48, 1, true, 1, 1.1), row(40, 1, false, 2, 2.6), row(70, 2, true, 3, 9.99)]

test('before any reveal: nothing', () => {
  assert.equal(selectLastLi(selectWinProbPath(feed, { throughHalf: -1 })), null)
  assert.equal(selectLastLi([]), null)
  assert.equal(selectLastLi(null), null)
})

test('the game\'s first play has no reading: null, never NaN', () => {
  assert.equal(selectLastLi(selectWinProbPath(feed.slice(0, 1))), null)
})

test('the last revealed play, clamped mid-half to the step', () => {
  // Through top 1, stepping bottom 1 up to at-bat 2.
  const at = { throughHalf: halfIndex(1, 'top'), stepHalfIndex: halfIndex(1, 'bottom'), throughAtBatIndex: 2 }
  assert.equal(selectLastLi(selectWinProbPath(feed, at)), 2.6)
  // The sealed top 2 (LI 9.99) never shows.
  assert.equal(selectLastLi(selectWinProbPath(feed, { throughHalf: halfIndex(1, 'bottom') })), 2.6)
})
