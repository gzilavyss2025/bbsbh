import assert from 'node:assert/strict'
import test from 'node:test'
import { pitcherLine } from '../../src/lib/postseason/worldseries/probables.js'

const SLATE = '2026-10-27'
const o = (date, ip, er, k, bb, pitches, gs, opp = 'CLE', isHome = true) => ({
  date,
  isHome,
  opponent: { abbreviation: opp },
  stat: { inningsPitched: ip, earnedRuns: er, strikeOuts: k, baseOnBalls: bb, numberOfPitches: pitches, gamesStarted: gs },
})
const log = [o('2026-10-05', '6.0', 2, 7, 1, 88, 1), o('2026-10-12', '5.1', 1, 6, 2, 95, 1, 'SD', false), o('2026-10-20', '1.2', 0, 2, 0, 24, 0)]

test('cutoff: an outing on the slate date is not in the line', () => {
  const withToday = [...log, o(SLATE, '7.0', 0, 12, 0, 101, 1)]
  assert.deepEqual(pitcherLine(withToday, SLATE), pitcherLine(log, SLATE))
})

test('line: thirds of an inning sum, ERA from earned runs, starts and relief counted', () => {
  const l = pitcherLine(log, SLATE)
  assert.equal(l.ip, '13.0')
  assert.equal(l.era, '2.08')
  assert.deepEqual([l.k, l.bb, l.gs, l.relief, l.games], [15, 3, 2, 1, 3])
})

test('an empty October has no ERA, never NaN', () => {
  const l = pitcherLine([], SLATE)
  assert.equal(l.era, null)
  assert.equal(l.ip, '0.0')
})
