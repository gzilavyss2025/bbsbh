// lib/pitch/cardPlots.js: the pitcher game card's plot geometry (#2969 slice 4).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { locationScale, movementScale, seasonByCode, veloDelta, MOVE_RANGE } from '../src/lib/pitch/cardPlots.js'
import { buildPitcherGameCard } from '../src/api/pitcher/gameCard.js'

const PHYS = ['x0', 'z0', 'pfxX', 'pfxZ', 'extension', 'plateTime', 'spinRate']

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

test('movement: zero is the centre, up is up, and a wild reading clamps to the edge', () => {
  const m = movementScale(100, 100)
  assert.equal(m.x(0), 50)
  assert.equal(m.y(0), 50)
  assert.ok(m.y(10) < 50)
  assert.equal(m.x(MOVE_RANGE * 3), 100)
  assert.equal(m.y(-MOVE_RANGE * 3), 100)
})

test('season by code: MLB rows first, pfx read by field name, missing stays null', () => {
  const entry = {
    mlb: [{ code: 'FF', avgVelo: 96.1, phys: [-1.8, 5.3, -5.3, 9.3, 6.6, 0.39, 2251] }, { code: 'CU', avgVelo: 77 }],
    aaa: [{ code: 'FF', avgVelo: 90 }],
  }
  const m = seasonByCode(entry, PHYS)
  assert.deepEqual(m.get('FF'), { velo: 96.1, pfxX: -5.3, pfxZ: 9.3 })
  assert.deepEqual(m.get('CU'), { velo: 77, pfxX: null, pfxZ: null })
  assert.equal(seasonByCode({ aaa: [{ code: 'SL', avgVelo: 85 }] }, PHYS).get('SL').velo, 85)
  assert.equal(seasonByCode(null, PHYS).size, 0)
})

test('velo delta: signed tenths, a real minus sign, and nothing when a side is missing', () => {
  assert.equal(veloDelta(96.9, 96.1), '+0.8')
  assert.equal(veloDelta(91.5, 91.6), '−0.1')
  assert.equal(veloDelta(91.6, 91.6), '0.0')
  assert.equal(veloDelta(91.6, null), '')
})

test('every pitch Yamamoto threw in WS G7 has a location and a movement to plot', () => {
  const feed = JSON.parse(readFileSync(new URL('./fixtures/game-813024.yamamoto.json', import.meta.url)))
  const card = buildPitcherGameCard(feed, 808967)
  assert.equal(card.pitches.filter((p) => p.loc).length, 34)
  assert.equal(card.pitches.filter((p) => p.pfxX != null && p.pfxZ != null).length, 34)
})
