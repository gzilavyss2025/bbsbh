// src/api/pitcher/gameCard.js (#2969 slice 2) on a real captured game:
// Yoshinobu Yamamoto in World Series 2025 Game 7 (gamePk 813024), relief,
// 2.2 IP, 34 pitches. Fixture: test/fixtures/game-813024.yamamoto.json,
// rebuilt by .scratch/pitcher-game-card/build-fixture.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildPitcherGameCard, isBarrel, isHardHit } from '../src/api/pitcher/gameCard.js'

const feed = JSON.parse(readFileSync(new URL('./fixtures/game-813024.yamamoto.json', import.meta.url)))
const card = buildPitcherGameCard(feed, 808967)

test('the line matches the box score (2.2 IP, 1 H, 0 R, 1 BB, 1 K, 34-21)', () => {
  const l = card.line
  assert.equal(l.name, 'Yoshinobu Yamamoto')
  assert.deepEqual([l.ip, l.h, l.r, l.er, l.bb, l.k, l.hr], ['2.2', 1, 0, 0, 1, 1, 0])
  assert.equal(l.pitches, 34)
  assert.equal(l.strikes, 21)
})

test('every pitch is on the card, and the strikes it counts agree with the box', () => {
  assert.equal(card.pitches.length, card.line.pitches)
  assert.equal(card.pitches.filter((p) => p.call !== 'ball').length, card.line.strikes)
})

test('swinging strikes, barrels and hard-hit balls from the pitches', () => {
  assert.equal(card.line.swStr, 2)
  assert.equal(card.line.barrels, 0)
  assert.equal(card.line.hardHit, 2)
})

test('pitch mix: usage sums to 1, most-used first, splitter leads', () => {
  const sum = card.mix.reduce((a, m) => a + m.usage, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9)
  assert.deepEqual(card.mix.map((m) => m.type), ['FS', 'FC', 'FF', 'CU', 'SI'])
  const fs = card.mix[0]
  assert.equal(fs.count, 19)
  assert.equal(fs.whiffs, 2)
  assert.equal(fs.velo.toFixed(1), '91.6')
})

test('RHB/LHB split: each side sums to 1, and the splitter is 9 of his 11 pitches to lefties', () => {
  for (const k of ['usageVsR', 'usageVsL']) {
    assert.ok(Math.abs(card.mix.reduce((a, m) => a + m[k], 0) - 1) < 1e-9)
  }
  assert.equal(card.mix[0].usageVsL, 9 / 11)
})

test('arsenal rates: zone, chase and swinging-strike per pitch type', () => {
  const fs = card.mix[0]
  assert.equal(fs.zonePct, 8 / 19)
  assert.equal(fs.chasePct, 2 / 11)
  assert.equal(fs.swStrPct, 2 / 19)
})

test('a pitcher with no line in the game gets no card', () => {
  assert.equal(buildPitcherGameCard(feed, 1), null)
  assert.equal(buildPitcherGameCard({}, 808967), null)
})

test('barrel window follows Statcast: 98 mph 26–30°, 100 mph 24–33°, 116 mph 8–50°', () => {
  assert.equal(isBarrel(97.9, 28), false)
  assert.equal(isBarrel(98, 26), true)
  assert.equal(isBarrel(98, 31), false)
  assert.equal(isBarrel(100, 24), true)
  assert.equal(isBarrel(100, 33), true)
  assert.equal(isBarrel(100, 34), false)
  assert.equal(isBarrel(116, 8), true)
  assert.equal(isBarrel(116, 50), true)
  assert.equal(isBarrel(120, 51), false)
  assert.equal(isBarrel(null, 20), false)
})

test('hard-hit is 95 mph and up', () => {
  assert.equal(isHardHit(95), true)
  assert.equal(isHardHit(94.9), false)
  assert.equal(isHardHit(null), false)
})

test('a pitching change in the middle of a plate appearance splits its pitches', () => {
  // Starter 1 throws a ball, is pulled mid-count, reliever 2 finishes the PA.
  const pitch = (code) => ({ isPitch: true, details: { call: { code }, type: { code: 'FF' } } })
  const line = { battersFaced: 1, inningsPitched: '0.0' }
  const mini = {
    liveData: {
      boxscore: { teams: { home: { players: { ID1: { stats: { pitching: line } }, ID2: { stats: { pitching: line } } } } } },
      plays: {
        allPlays: [
          { about: { halfInning: 'top' }, matchup: { pitcher: { id: 1 }, batSide: { code: 'R' } }, playEvents: [pitch('X')] },
          {
            about: { halfInning: 'top' },
            matchup: { pitcher: { id: 2 }, batSide: { code: 'R' } },
            playEvents: [pitch('B'), { isPitch: false, details: { eventType: 'pitching_substitution' }, player: { id: 2 } }, pitch('S'), pitch('C')],
          },
        ],
      },
    },
  }
  assert.equal(buildPitcherGameCard(mini, 1).pitches.length, 2)
  assert.equal(buildPitcherGameCard(mini, 2).pitches.length, 2)
})

test('the game the card names: WS, Nov 1, 2025, LAD 5 TOR 4 in 11, his role', () => {
  const g = card.game
  assert.equal(g.round, 'WS')
  assert.equal(g.date, 'Nov 1, 2025')
  assert.deepEqual([g.away.abbr, g.away.runs, g.home.abbr, g.home.runs], ['LAD', 5, 'TOR', 4])
  assert.equal(g.final, true)
  assert.equal(g.innings, 11)
  assert.equal(card.line.role, 'Relief')
})
