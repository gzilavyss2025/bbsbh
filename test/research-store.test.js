// The /research store (#2234): the shard layout round trip, the filter definitions
// (Gary's decision 7), the URL format, the answer, and the generator's date rules.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodePlateAppearances, encodeMonth } from '../src/api/research/shard.js'
import { buildQuery, fieldOf, horizontalThird, matcher, parseQuery, unsupported } from '../src/api/research/filters.js'
import { answer } from '../src/api/research/answer.js'
import { mergeIndex, monthDays, savantDayUrl, seasonMonths } from '../scripts/lib/research/store.mjs'

// One Savant CSV row, with only the columns the store reads.
const row = (o) => ({
  game_pk: '1', game_date: '2026-06-01', game_type: 'R', home_team: 'MIL', away_team: 'CHC',
  at_bat_number: '1', pitch_number: '1', balls: '0', strikes: '0', outs_when_up: '0',
  on_1b: '', on_2b: '', on_3b: '', inning: '1', inning_topbot: 'Top', batter: '10', pitcher: '20',
  stand: 'L', p_throws: 'L', pitch_type: 'SI', description: 'ball', events: '', plate_x: '0.5',
  hc_x: '', hc_y: '', launch_speed: '', launch_angle: '', bat_score_diff: '0', ...o,
})

const ROWS = [
  row({ pitch_number: '1' }),
  row({ pitch_number: '2', balls: '1', description: 'automatic_strike', plate_x: '', pitch_type: '' }), // pitch clock: dropped
  row({ pitch_number: '3', balls: '1', strikes: '0', description: 'hit_into_play', events: 'home_run', plate_x: '0.6', hc_x: '40', hc_y: '80', launch_speed: '101.3', launch_angle: '27' }),
  row({ at_bat_number: '2', batter: '11', stand: 'R', pitch_number: '1', description: 'called_strike', events: 'strikeout', on_2b: '7', outs_when_up: '1' }),
  row({ game_pk: '2', game_date: '2026-06-01', at_bat_number: '1', events: 'walk', balls: '3', strikes: '2' }), // game 2 of a doubleheader
  row({ game_pk: '3', game_date: '2026-06-03', at_bat_number: '1', batter: '10', pitch_number: '1', events: 'home_run', description: 'hit_into_play', plate_x: '-0.6', hc_x: '200', hc_y: '80' }),
]

const shard = encodeMonth(ROWS, { season: 2026, month: '06', names: { 10: 'Lefty Bat', 20: 'Lefty Arm' } })
const pas = decodePlateAppearances(shard)

test('a month shard round-trips to plate appearances', () => {
  assert.equal(shard.cols.g.length, 5, 'the pitch-clock row with no plate_x and no event is dropped')
  assert.equal(shard.through, '2026-06-03')
  assert.deepEqual(shard.people, { 10: 'Lefty Bat', 20: 'Lefty Arm' })
  assert.equal(pas.length, 4)
  const hr = pas[0]
  assert.equal(hr.event, 'home_run')
  assert.equal(hr.pitches.length, 2)
  assert.equal(hr.pitches[1].px, 0.6)
  assert.equal(hr.launchSpeed, 101.3)
  assert.equal(hr.batTeam, 'CHC')
  assert.equal(pas[1].runners, 2)
  assert.equal(pas[1].stand, 'R')
})

test('the later of two same-day games between the same clubs is game 2', () => {
  assert.equal(pas[0].gameNumber, 1)
  assert.equal(pas[2].gameNumber, 2)
  assert.equal(pas[3].gameNumber, 1)
})

test('inner third is the third of the plate nearest the batter, flipped by side', () => {
  assert.equal(horizontalThird(0.6, 'L'), 'inner')
  assert.equal(horizontalThird(-0.6, 'L'), 'outer')
  assert.equal(horizontalThird(-0.6, 'R'), 'inner')
  assert.equal(horizontalThird(0, 'R'), 'middle')
  assert.equal(horizontalThird(0.75, 'L'), null, 'off the plate is in no third')
  assert.equal(horizontalThird(null, 'L'), null)
})

test('opp field is more than 15 degrees from center toward the opposite side', () => {
  // hc_x 40 is toward left field (the home plate x is 125.42).
  assert.equal(fieldOf(40, 80, 'L'), 'oppo')
  assert.equal(fieldOf(40, 80, 'R'), 'pull')
  assert.equal(fieldOf(200, 80, 'R'), 'oppo')
  assert.equal(fieldOf(130, 60, 'R'), 'center')
  assert.equal(fieldOf(null, null, 'R'), null)
})

test('the worked example matches only the lefty oppo homer off a sinker inside', () => {
  const q = parseQuery('?res=home_run&fld=oppo&pt=SI&loc=inner&bh=L&ph=L')
  assert.deepEqual(pas.filter(matcher(q)).map((p) => p.key), ['1-1'])
})

test('invert excludes, count means passed through, and the cutoff holds out its day', () => {
  assert.deepEqual(pas.filter(matcher(parseQuery('?res=!home_run'))).map((p) => p.event), ['strikeout', 'walk'])
  assert.deepEqual(pas.filter(matcher(parseQuery('?cnt=1-0'))).map((p) => p.key), ['1-1'])
  assert.deepEqual(pas.filter(matcher(parseQuery('?res=home_run'), '2026-06-03')).map((p) => p.date), ['2026-06-01'])
})

test('the URL round-trips and drops values it does not know', () => {
  const q = parseQuery('?ask=most&res=!home_run.double&bh=L&bat=10&team=MIL&pt=ZZ&park=<x>')
  assert.deepEqual(q.chips, { res: { vals: ['home_run', 'double'], inv: true }, bh: { vals: ['L'], inv: false } })
  assert.equal(q.park, null)
  assert.deepEqual(parseQuery(buildQuery(q)), q)
  assert.equal(buildQuery(q, { d: '2026-06-02' }).endsWith('&d=2026-06-02'), true)
})

test('the answer is newest first, with ordinals and the any-result base', () => {
  const a = answer(pas, parseQuery('?res=home_run&bat=10'))
  assert.deepEqual(a.matches.map((m) => [m.date, m.ordinal]), [['2026-06-03', 2], ['2026-06-01', 1]])
  assert.equal(a.base, 3, 'the same query with any result: two homers and a walk')
  assert.equal(a.totals.hr, 2)
  assert.deepEqual(a.batters, [{ id: 10, n: 2 }])
})

test('a season range before the tracking era blocks the pitch cards', () => {
  assert.deepEqual(unsupported(2026), [])
  assert.deepEqual(unsupported(2000).map((u) => u.key), ['pt', 'loc', 'fld'])
})

test('the generator never asks Savant with the ignored hand params, and never for today', () => {
  const url = new URL(savantDayUrl('2026-06-01'))
  assert.equal(url.searchParams.has('stand'), false)
  assert.equal(url.searchParams.has('p_throws'), false)
  assert.equal(url.searchParams.get('game_date_gt'), '2026-06-01')
  assert.equal(url.searchParams.get('game_date_lt'), '2026-06-01')
  assert.deepEqual(monthDays(2026, '06', '2026-06-03'), ['2026-06-01', '2026-06-02'])
  assert.equal(monthDays(2026, '02', '2026-03-01').length, 28)
  assert.deepEqual(seasonMonths(2026, '2026-05-02'), ['03', '04', '05'])
})

test('the index keeps the months it already had', () => {
  const one = mergeIndex(null, 2026, '05', { through: '2026-05-31', cols: { g: [0, 0] } }, 1, 't1')
  const two = mergeIndex(one, 2026, '06', shard, 4, 't2')
  assert.deepEqual(Object.keys(two.seasons[2026].months), ['05', '06'])
  assert.equal(two.seasons[2026].months['06'].pitches, 5)
  assert.equal(two.built, 't2')
})
