// The play log's data pass (Gary, 2026-11-18): the league rate beside a "how often" share,
// counts not a percent under 50 PAs, Exit velo and Launch angle ranges, Count reached vs
// Final count (3-2 is even), the pitcher's role that game, and times facing the pitcher.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodePlateAppearances, encodeMonth } from '../src/api/research/shard.js'
import { buildQuery, countGroup, matcher, parseQuery, unsupported } from '../src/api/research/filters.js'
import { leagueCounts, shareText } from '../src/api/research/answer.js'

const row = (o) => ({
  game_pk: '1', game_date: '2026-06-01', game_type: 'R', home_team: 'MIL', away_team: 'CHC',
  at_bat_number: '1', pitch_number: '1', balls: '0', strikes: '0', outs_when_up: '0',
  on_1b: '', on_2b: '', on_3b: '', inning: '1', inning_topbot: 'Top', batter: '10', pitcher: '20',
  stand: 'L', p_throws: 'L', pitch_type: 'SI', description: 'hit_into_play', events: 'field_out', plate_x: '0.5',
  hc_x: '', hc_y: '', launch_speed: '', launch_angle: '', bat_score_diff: '0', bat_score: '0', post_bat_score: '0', bb_type: '', ...o,
})

// Game 1, top half: pitcher 20 starts and faces batter 10 twice, then 21 relieves.
// Bottom half: pitcher 30 starts. A full-count homer at 104.6 mph, 28 degrees.
const ROWS = [
  row({ launch_speed: '95.2', launch_angle: '-5' }),
  row({ at_bat_number: '2', batter: '11', events: 'strikeout', description: 'swinging_strike' }),
  row({ at_bat_number: '3', inning_topbot: 'Bot', batter: '40', pitcher: '30', balls: '3', strikes: '2', events: 'home_run', launch_speed: '104.6', launch_angle: '28' }),
  row({ at_bat_number: '4', inning: '2', events: 'single', launch_speed: '88', launch_angle: '12' }),
  row({ at_bat_number: '5', inning: '3', pitcher: '21', events: 'walk', description: 'ball', balls: '3', strikes: '1' }),
]
const pas = decodePlateAppearances(encodeMonth(ROWS, { season: 2026, month: '06' }))
const [first, , homer, again, relief] = pas
const hits = (search) => pas.filter(matcher(parseQuery(search))).map((p) => p.atBat)

test('under 50 PAs a share reads as counts; at 50 or more as a percent', () => {
  assert.equal(shareText(5, 20), '5 of 20 PAs')
  assert.equal(shareText(1, 1), '1 of 1 PA')
  assert.equal(shareText(5, 50), '10.0% of 50 PAs')
})

test('the league rate counts the same result over every PA, with no situation filters', () => {
  const q = parseQuery('?ask=often&res=home_run&bh=R&out=2')
  assert.deepEqual(leagueCounts(pas, q), { n: 1, base: 5 })
  assert.equal(leagueCounts(pas, parseQuery('?ask=often&bh=R')), null, 'no result card, no league rate')
})

test('Exit velo and Launch angle ranges, either end open, negatives allowed', () => {
  assert.deepEqual(hits('?ev=100-'), [3])
  assert.deepEqual(hits('?ev=-95'), [4])
  assert.deepEqual(hits('?la=--1'), [1])
  assert.deepEqual(hits('?la=-5-12'), [1, 4])
  assert.deepEqual(hits('?ev=90-100&la=-10-0'), [1])
  const q = parseQuery('?la=-5-12&ev=95-')
  assert.deepEqual(q.ranges, { ev: [95, null], la: [-5, 12] })
  assert.equal(buildQuery(q), '?ev=95-&la=-5-12')
  assert.ok(unsupported(2014).some((b) => b.key === 'ev'), 'no launch data before 2015')
})

test('3-2 is even; Final count reads the last pitch, Count reached any pitch', () => {
  assert.equal(countGroup([3, 2]), 'even')
  assert.deepEqual(hits('?fc=even'), [1, 2, 3, 4])
  assert.deepEqual(hits('?fc=3-2'), [3])
  assert.deepEqual(hits('?cnt=3-1'), [5])
  assert.deepEqual(parseQuery('?cnt=ahead.0-2').chips, { cnt: { vals: ['0-2'], inv: false }, fc: { vals: ['ahead'], inv: false } }, 'an old link keeps its meaning')
})

test("the pitcher's role that game, and times facing him", () => {
  assert.equal(first.role, 'SP')
  assert.equal(relief.role, 'RP')
  assert.equal(homer.role, 'SP', 'each side has its own starter')
  assert.equal(first.tto, 1)
  assert.equal(again.tto, 2, 'the second time batter 10 faces pitcher 20')
  assert.equal(relief.tto, 1, 'a new pitcher starts the count again')
  assert.deepEqual(hits('?role=RP'), [5])
  assert.deepEqual(hits('?tto=2'), [4])
})
