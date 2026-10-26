import assert from 'node:assert/strict'
import test from 'node:test'
import { leadingFigures, pitcherLine } from '../../src/lib/postseason/worldseries/probables.js'

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

// The Probables card tints a figure only on the starter who leads it (Game 3, 2026: Gasser 9.0 IP,
// 1.00 ERA, 6 K, 2 BB against Peralta 16.2 IP, 1.08 ERA, 12 K, 7 BB). It once tinted all eight.
const gasser = { games: 2, ipValue: 9, era: '1.00', k: 6, bb: 2 }
const peralta = { games: 4, ipValue: 16 + 2 / 3, era: '1.08', k: 12, bb: 7 }

test('leadingFigures: more innings and strikeouts lead, a lower ERA and fewer walks lead', () => {
  assert.deepEqual(leadingFigures(gasser, peralta), ['ERA', 'BB'])
  assert.deepEqual(leadingFigures(peralta, gasser), ['IP', 'K'])
})

test('leadingFigures: the two sides never lead the same figure', () => {
  const a = leadingFigures(gasser, peralta)
  const b = leadingFigures(peralta, gasser)
  assert.deepEqual(a.filter((label) => b.includes(label)), [])
})

test('leadingFigures: a tie leads nothing, and a side with no October line leads nothing', () => {
  assert.deepEqual(leadingFigures(gasser, { ...gasser }), [])
  assert.deepEqual(leadingFigures(gasser, { games: 0, ipValue: 0, era: null, k: 0, bb: 0 }), [])
  assert.deepEqual(leadingFigures({ games: 0 }, peralta), [])
  assert.deepEqual(leadingFigures(gasser, null), [])
})

test('leadingFigures: a starter with no ERA yet cannot lead it', () => {
  const noEra = { games: 1, ipValue: 0, era: null, k: 0, bb: 0 }
  assert.ok(!leadingFigures(noEra, gasser).includes('ERA'))
  assert.ok(!leadingFigures(gasser, noEra).includes('ERA'))
})
