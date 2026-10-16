// The World Series event classifier (src/lib/worldSeries/classify.js). One positive and
// one negative per tag, on the captured games in test/fixtures/world-series/ (README there).
// A play built by hand is used only for a negative the fixtures do not hold.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyGame } from '../../src/lib/worldSeries/classify.js'

const FIX = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'world-series')
const load = (pk) => JSON.parse(readFileSync(join(FIX, `${pk}-plays.json`), 'utf8'))
const CLUBS = { away: 1, home: 2 }
const rows = (pbp, opts = {}) => classifyGame(pbp, { clubs: CLUBS, wta: false, ...opts })
const of = (tag, pbp, opts) => rows(pbp, opts).filter((r) => r.tag === tag)

// A one-play game from hand-built plays: enough for a negative the fixtures lack.
const play = (i, result, about = {}, extra = {}) => ({
  atBatIndex: i,
  about: { atBatIndex: i, inning: 1, isTopInning: true, ...about },
  result: { eventType: 'field_out', rbi: 0, awayScore: 0, homeScore: 0, ...result },
  matchup: { batter: { id: 10 + i }, pitcher: { id: 99 } },
  playEvents: [],
  ...extra,
})

test('grandSlam: a home run with 4 RBI (2024 G1); a game with none is empty', () => {
  const [r] = of('grandSlam', load(775300))
  assert.equal(r.club, 2)
  assert.ok(r.player)
  assert.equal(of('grandSlam', load(67524)).length, 0)
})

test('walkOffHr and walkOffGrandSlam: 2024 G1 is both; 2025 G3 is a solo walk-off', () => {
  assert.equal(of('walkOffHr', load(775300)).length, 1)
  assert.equal(of('walkOffGrandSlam', load(775300)).length, 1)
  assert.equal(of('walkOffHr', load(813032), { innings: 18 }).length, 1)
  assert.equal(of('walkOffGrandSlam', load(813032), { innings: 18 }).length, 0)
  assert.equal(of('walkOffHr', load(67524)).length, 0)
})

test('openingHrPair: 2025 G5 opens with two home runs; 2025 G1 does not', () => {
  const [r] = of('openingHrPair', load(813022))
  assert.equal(r.club, 1)
  assert.equal(of('openingHrPair', load(813027)).length, 0)
})

test('pinchHitHr and pinchHitGrandSlam: Barger, 2025 G1; a pinch-hit single is neither', () => {
  const [hr] = of('pinchHitHr', load(813027))
  assert.equal(hr.value, 4)
  assert.equal(of('pinchHitGrandSlam', load(813027)).length, 1)
  const single = play(0, { eventType: 'single' }, {}, {
    playEvents: [{
      details: { description: 'Offensive Substitution: Pinch-hitter Bob replaces Al.', eventType: 'offensive_substitution' },
      isSubstitution: true, player: { id: 10 },
    }],
  })
  assert.equal(of('pinchHitHr', { allPlays: [single] }).length, 0)
  assert.equal(of('pinchHitHr', load(775300)).length, 0)
})

test('extraInningHr: 2025 G7 homers in the 11th; a nine-inning game has none', () => {
  assert.ok(of('extraInningHr', load(813024), { innings: 11 }).length >= 1)
  assert.equal(of('extraInningHr', load(67524)).length, 0)
})

test('pitcherHit: only in a winner-take-all game (1975 G7: 2 rows, 2025 G7: Ohtani)', () => {
  assert.equal(of('pitcherHit', load(67697), { wta: true }).length, 2)
  const [oh] = of('pitcherHit', load(813024), { wta: true, innings: 11 })
  assert.equal(oh.player, 660271)
  assert.equal(of('pitcherHit', load(67697), { wta: false }).length, 0)
})

test('gameEndingDp: the last play is a double play', () => {
  const dp = play(0, { eventType: 'grounded_into_double_play' })
  assert.equal(of('gameEndingDp', { allPlays: [dp] }).length, 1)
  assert.equal(of('gameEndingDp', load(775300)).length, 0)
})

test('triplePlay: eventType triple_play counts; the hit "Triple" does not', () => {
  assert.equal(of('triplePlay', load(67316)).length, 1)
  const tp = play(0, { eventType: 'triple_play', event: 'Triple Play' })
  assert.equal(of('triplePlay', { allPlays: [tp] }).length, 1)
  const byText = play(0, { description: 'X grounds into a triple play, 5-4-3.' })
  assert.equal(of('triplePlay', { allPlays: [byText] }).length, 1)
  const hit = play(0, { event: 'Triple', eventType: 'triple', description: 'Y triples to deep right.' })
  assert.equal(of('triplePlay', { allPlays: [hit] }).length, 0)
})

test('extraInnings: 18 innings (2018 G3) carries the count; nine does not', () => {
  assert.equal(of('extraInnings', load(563409), { innings: 18 })[0].value, 18)
  assert.equal(of('extraInnings', load(67524), { innings: 9 }).length, 0)
})

test('shutout: 1956 G5 (2-0) names the winner and its runs; a 10-9 game has none', () => {
  const [r] = of('shutout', load(67524))
  assert.equal(r.value, 2)
  assert.equal(of('shutout', load(67553)).length, 0)
})

test('shutout: a tie is not a shutout', () => {
  assert.equal(rows(load(67237)).filter((r) => r.tag === 'shutout').length, 0)
})

test('bigScore: 10 runs counts (1960 G7 home 10); 2-0 does not', () => {
  const [r] = of('bigScore', load(67553))
  assert.equal(r.value, 10)
  assert.equal(r.club, 2)
  assert.equal(of('bigScore', load(67524)).length, 0)
})

test('bigComeback: 2024 G5 Dodgers trailed by 5 and won; a wire-to-wire game has none', () => {
  const [r] = of('bigComeback', load(775296))
  assert.equal(r.value, 5)
  assert.equal(r.club, 1) // the road club
  assert.equal(of('bigComeback', load(67524)).length, 0)
})

test('multiHrGame: three home runs by one batter (1977 G6); two do not count', () => {
  const [r] = of('multiHrGame', load(67724))
  assert.equal(r.value, 3)
  assert.equal(of('multiHrGame', load(813027)).length, 0)
})

test('reachedBase: Ohtani reached 9 times in 2025 G3; 1956 G5 has no such batter', () => {
  const r = of('reachedBase', load(813032), { innings: 18 }).find((x) => x.player === 660271)
  assert.equal(r.value, 9)
  assert.equal(of('reachedBase', load(67524)).length, 0)
})

test('wtaTrailing9: only in a winner-take-all game; value 1 when the trailing club won', () => {
  assert.equal(of('wtaTrailing9', load(67553), { wta: false }).length, 0)
  const [r] = of('wtaTrailing9', load(67553), { wta: true })
  assert.equal(typeof r.value, 'number')
  assert.equal(r.wta, true)
})

test('wtaTrailing9: a game level after eight innings has no row', () => {
  const level = { allPlays: [play(0, { awayScore: 1, homeScore: 1 }, { inning: 8 }), play(1, { awayScore: 1, homeScore: 2 }, { inning: 9, isTopInning: false })] }
  assert.equal(of('wtaTrailing9', level, { wta: true }).length, 0)
})

test('a tied game gives no winner-based row', () => {
  for (const pk of [67237, 67266]) {
    const tags = new Set(rows(load(pk), { innings: 12 }).map((r) => r.tag))
    for (const t of ['shutout', 'bigComeback', 'walkOffHr']) assert.equal(tags.has(t), false, `${pk} ${t}`)
  }
})
