// The in-game Tensest moments list (#2979): the revealed plays ranked by
// leverage index. It reads only points selectWinProbPath already clamped.
import assert from 'node:assert/strict'
import test from 'node:test'
import { selectTensePlays, selectWinProbPath } from '../src/api/winprob.js'
import { halfIndex } from '../src/api/select.js'

const pt = (li, inning = 1, half = 'top') => ({ li, inning, half, desc: `li ${li}`, playId: null, home: 50 })

test('ranks by LI, highest first, and keeps the top 3', () => {
  const got = selectTensePlays([pt(1), pt(4), pt(2), pt(3), pt(0.5)])
  assert.deepEqual(got.map((p) => [p.idx, p.li]), [[1, 4], [3, 3], [2, 2]])
})

test('a tie at the cut keeps every tied play, in game order', () => {
  const got = selectTensePlays([pt(5), pt(2), pt(3), pt(2), pt(2)])
  assert.deepEqual(got.map((p) => p.idx), [0, 2, 1, 3, 4])
})

test('a play with no LI is never listed', () => {
  const got = selectTensePlays([pt(null), pt(1.2), pt(undefined)])
  assert.deepEqual(got.map((p) => p.idx), [1])
  assert.deepEqual(selectTensePlays([pt(null)]), [])
  assert.deepEqual(selectTensePlays([]), [])
  assert.deepEqual(selectTensePlays(null), [])
})

test('fed clamped points, a sealed half never reaches the list', () => {
  const row = (home, inning, isTopInning, atBatIndex, leverageIndex) => ({
    homeTeamWinProbability: home, leverageIndex,
    about: { inning, isTopInning, isScoringPlay: false, atBatIndex },
    result: { description: `play ${atBatIndex}` },
  })
  const feed = [row(52, 1, true, 0, 1.0), row(40, 1, false, 1, 1.4), row(70, 2, true, 2, 9.99)]
  const points = selectWinProbPath(feed, { throughHalf: halfIndex(1, 'bottom') })
  assert.deepEqual(selectTensePlays(points).map((p) => p.li), [1.4, 1.0])
})

test('ties never grow the list past 5 rows', () => {
  const got = selectTensePlays([pt(9), pt(2), pt(2), pt(2), pt(2), pt(2), pt(2), pt(5)])
  assert.equal(got.length, 5)
  assert.deepEqual(got.map((p) => p.idx), [0, 7, 1, 2, 3])
})

// The row names who was pitching (Gary, 2026-11-12): carried from the point.
test('a tense play carries its pitcher, and an empty name when the point has none', () => {
  const [top] = selectTensePlays([{ ...pt(2.5), pitcher: 'Max Fried' }, pt(1)])
  assert.equal(top.pitcher, 'Max Fried')
  assert.equal(selectTensePlays([pt(3)])[0].pitcher, '')
})
