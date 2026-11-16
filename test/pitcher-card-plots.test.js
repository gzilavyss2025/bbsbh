// lib/pitch/cardPlots.js: the pitcher game card's plot geometry (#2969 slice 4).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { locationScale, fitViewBox, seasonByCode, veloDelta } from '../src/lib/pitch/cardPlots.js'
import { buildPitcherGameCard } from '../src/api/pitcher/gameCard.js'


test('location: the zone is centred, its top above its bottom, and the catcher view keeps +x right', () => {
  const s = locationScale(100, 120)
  assert.ok(Math.abs(s.zone.x + s.zone.w / 2 - 50) < 1e-9)
  assert.ok(s.zone.y < s.y(0))
  assert.ok(s.x(1) > s.x(-1))
  assert.equal(s.y(1), s.zone.y)
})

test('location: a pitch far off the plate pins to the plot edge instead of leaving it', () => {
  const s = locationScale(100, 120)
  assert.equal(s.x(-9), 0)
  assert.equal(s.x(9), 100)
  assert.equal(s.y(-5), 120)
  assert.equal(s.y(5), 0)
})

test('season by code: his season speed per pitch, MLB rows by default, missing stays null', () => {
  const entry = { mlb: [{ code: 'FF', avgVelo: 96.1 }, { code: 'CU' }], aaa: [{ code: 'FF', avgVelo: 90 }] }
  const m = seasonByCode(entry)
  assert.equal(m.get('FF').velo, 96.1)
  assert.equal(m.get('CU').velo, null)
  assert.equal(seasonByCode(null).size, 0)
})

test('season by code: a Triple-A game compares against his Triple-A rows, never his MLB ones', () => {
  const entry = { mlb: [{ code: 'FF', avgVelo: 96 }], aaa: [{ code: 'FF', avgVelo: 94 }] }
  assert.equal(seasonByCode(entry, 'aaa').get('FF').velo, 94)
  assert.equal(seasonByCode(entry, 'mlb').get('FF').velo, 96)
  assert.equal(seasonByCode({ mlb: [{ code: 'FF', avgVelo: 96 }] }, 'aaa').size, 0)
})

test('velo delta: signed tenths, a real minus sign, nothing under 0.3 mph or when a side is missing', () => {
  assert.equal(veloDelta(96.9, 96.1), '+0.8')
  assert.equal(veloDelta(91.2, 91.6), '−0.4')
  assert.equal(veloDelta(91.3, 91.6), '−0.3')
  assert.equal(veloDelta(91.5, 91.6), '')
  assert.equal(veloDelta(91.6, 91.6), '')
  assert.equal(veloDelta(91.6, null), '')
})

test("field fit: the park's viewBox scales evenly into the box and centres in it", () => {
  const f = fitViewBox('0 50 620 510', 160, 186)
  assert.ok(Math.abs(f.scale - 160 / 620) < 1e-9)
  assert.equal(f.dx, 0)
  assert.ok(Math.abs(f.dy - ((186 - 510 * f.scale) / 2 - 50 * f.scale)) < 1e-9)
  const tall = fitViewBox('0 0 100 400', 100, 100)
  assert.equal(tall.scale, 0.25)
  assert.equal(tall.dx, (100 - 25) / 2)
})

test('every pitch Yamamoto threw in WS G7 has a location, and each of his 7 balls in play a landing spot', () => {
  const feed = JSON.parse(readFileSync(new URL('./fixtures/game-813024.yamamoto.json', import.meta.url)))
  const card = buildPitcherGameCard(feed, 808967)
  assert.equal(card.pitches.filter((p) => p.loc).length, 34)
  // 10 batters: 1 K, 1 BB, 1 HBP, so 7 put the ball in play; 1 hit (the double).
  const balls = card.pitches.filter((p) => p.ball)
  assert.equal(balls.length, 7)
  assert.equal(balls.filter((p) => p.hit).length, 1)
})

test('a tracked foul ball is not a ball in play: only the play-ending tracked event lands on the spray chart', () => {
  // The batter fouls one off (the park tracked it), then singles.
  const line = { battersFaced: 1, inningsPitched: '0.0' }
  const ev = (code, hitData) => ({ isPitch: true, details: { call: { code }, type: { code: 'FF' } }, ...(hitData && { hitData }) })
  const feed = {
    liveData: {
      boxscore: { teams: { home: { players: { ID1: { stats: { pitching: line } } } } } },
      plays: {
        allPlays: [{
          about: { halfInning: 'top' },
          result: { eventType: 'single' },
          matchup: { pitcher: { id: 1 }, batSide: { code: 'R' } },
          playEvents: [
            ev('F', { coordinates: { coordX: 20, coordY: 150 } }),
            ev('X', { coordinates: { coordX: 125, coordY: 100 } }),
          ],
        }],
      },
    },
  }
  const balls = buildPitcherGameCard(feed, 1).pitches.filter((p) => p.ball)
  assert.equal(balls.length, 1)
  assert.equal(balls[0].hit, true)
  assert.equal(balls[0].call, 'inplay')
})
