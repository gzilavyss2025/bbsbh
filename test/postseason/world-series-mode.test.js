// World Series mode (#1906, slice 1). Real 2025 data: LAD beat TOR in seven,
// Game 1 on 10-24, Game 7 on 11-01. ALCS Game 7 was 10-20, so TOR was the
// last club to be known heading into 10-21.
import assert from 'node:assert/strict'
import test from 'node:test'
import { lcsRoundOf, seriesMode, worldSeriesMode } from '../../src/lib/postseason/worldseries/mode.js'
import { bracket2025 } from './fixtures.js'

const modeOn = (date) => worldSeriesMode(bracket2025(date))

test('off when only one club is known (ALCS Game 7 day)', () => {
  assert.equal(modeOn('2025-10-20'), null)
})

test('on before Game 1 once both clubs are known: an off day pointing at Game 1', () => {
  const m = modeOn('2025-10-23')
  assert.equal(m.dayType, 'off')
  assert.equal(m.gameNumber, 1)
})

test('Game 1 day is a game day', () => {
  const m = modeOn('2025-10-24')
  assert.equal(m.dayType, 'game')
  assert.equal(m.gameNumber, 1)
})

test('a travel day between Games 2 and 3 is an off day naming Game 3', () => {
  const m = modeOn('2025-10-26')
  assert.equal(m.dayType, 'off')
  assert.equal(m.gameNumber, 3)
})

test('a later game day carries that game number', () => {
  const m = modeOn('2025-10-28')
  assert.equal(m.dayType, 'game')
  assert.equal(m.gameNumber, 4)
})

test('Game 7 day is still on: the clincher is not counted heading in', () => {
  const m = modeOn('2025-11-01')
  assert.equal(m.dayType, 'game')
  assert.equal(m.gameNumber, 7)
})

test('off the day after the clincher: the champion band takes over', () => {
  assert.equal(modeOn('2025-11-02'), null)
})

test('off with no bracket or no World Series', () => {
  assert.equal(worldSeriesMode(null), null)
  assert.equal(worldSeriesMode({ worldSeries: null }), null)
})

test('seriesMode: a decided series still gets a mode (the live page shows it), off day, no game', () => {
  const ws = bracket2025('2025-11-02').worldSeries
  assert.equal(ws.decided, true)
  const m = seriesMode(ws)
  assert.equal(m.series, ws)
  assert.equal(m.dayType, 'off')
  assert.equal(m.gameNumber, null)
})

test('seriesMode: agrees with worldSeriesMode on every mode-on day', () => {
  for (const d of ['2025-10-23', '2025-10-24', '2025-10-26', '2025-10-28', '2025-11-01']) {
    const b = bracket2025(d)
    assert.deepEqual(seriesMode(b.worldSeries), worldSeriesMode(b))
  }
})

test('seriesMode: null until both clubs are known', () => {
  assert.equal(seriesMode(bracket2025('2025-10-20').worldSeries), null)
  assert.equal(seriesMode(null), null)
})

test('lcsRoundOf: names the league whose LCS the club played, else empty', () => {
  const b = bracket2025('2025-10-24')
  const [a, z] = b.worldSeries.slots.map((s) => s.club.id)
  assert.match(lcsRoundOf(b, a), /^(AL|NL)CS$/)
  assert.notEqual(lcsRoundOf(b, a), lcsRoundOf(b, z))
  assert.equal(lcsRoundOf(b, 1), '')
})
