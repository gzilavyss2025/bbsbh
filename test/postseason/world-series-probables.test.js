import assert from 'node:assert/strict'
import test from 'node:test'
import { pitchBars, pitcherLine } from '../../src/lib/postseason/worldseries/probables.js'

const SLATE = '2026-10-27'
const o = (date, ip, er, k, bb, pitches, gs, opp = 'CLE', isHome = true) => ({
  date,
  isHome,
  opponent: { abbreviation: opp },
  stat: { inningsPitched: ip, earnedRuns: er, strikeOuts: k, baseOnBalls: bb, numberOfPitches: pitches, gamesStarted: gs },
})
const log = [o('2026-10-05', '6.0', 2, 7, 1, 88, 1), o('2026-10-12', '5.1', 1, 6, 2, 95, 1, 'SD', false), o('2026-10-20', '1.2', 0, 2, 0, 24, 0)]

test('cutoff: an outing on the slate date is in neither the line nor the bars', () => {
  const withToday = [...log, o(SLATE, '7.0', 0, 12, 0, 101, 1)]
  assert.deepEqual(pitcherLine(withToday, SLATE), pitcherLine(log, SLATE))
  assert.deepEqual(pitchBars(withToday, SLATE), pitchBars(log, SLATE))
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

test('bars: oldest first, latest ink, start slate, relief striped, labelled by date and opponent', () => {
  const bars = pitchBars(log, SLATE)
  assert.deepEqual(bars.map((b) => [b.pitches, b.kind]), [[88, 'start'], [95, 'start'], [24, 'latest']])
  assert.equal(bars[1].away, true)
  assert.equal(bars[1].opp, 'SD')
  const relief = [o('2026-10-05', '1.0', 0, 1, 0, 15, 0), o('2026-10-06', '1.0', 0, 1, 0, 12, 0)]
  assert.deepEqual(pitchBars(relief, SLATE).map((b) => b.kind), ['relief', 'latest'])
})

test('bars cap at the last six outings', () => {
  const many = Array.from({ length: 9 }, (_, i) => o(`2026-10-${String(10 + i).padStart(2, '0')}`, '1.0', 0, 1, 0, 10 + i, 0))
  const bars = pitchBars(many, SLATE)
  assert.equal(bars.length, 6)
  assert.equal(bars[0].pitches, 13)
})
