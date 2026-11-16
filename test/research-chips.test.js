// The /research cards added in #3140: Score, Moment, Batted ball type, Batting slot,
// Month, Home or road, and the Count card's batter ahead / even / behind. Also the
// store v2 columns behind them and the block on a season built before v2.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodePlateAppearances, encodeMonth } from '../src/api/research/shard.js'
import { FILTER_BY_KEY, countGroup, matcher, momentValues, parseQuery, scoreValues, unsupported } from '../src/api/research/filters.js'
import { storeVersion } from '../src/api/research/store.js'
import { keptLineups, lineupOf, mergeIndex } from '../scripts/lib/research/store.mjs'

const row = (o) => ({
  game_pk: '1', game_date: '2026-06-01', game_type: 'R', home_team: 'MIL', away_team: 'CHC',
  at_bat_number: '1', pitch_number: '1', balls: '0', strikes: '0', outs_when_up: '0',
  on_1b: '', on_2b: '', on_3b: '', inning: '1', inning_topbot: 'Top', batter: '10', pitcher: '20',
  stand: 'L', p_throws: 'L', pitch_type: 'SI', description: 'ball', events: '', plate_x: '0.5',
  hc_x: '', hc_y: '', launch_speed: '', launch_angle: '', bat_score_diff: '0', bat_score: '0', post_bat_score: '0', bb_type: '', ...o,
})

// Game 1: a leadoff groundout, then a bottom-9th walk-off homer down 1 with a man on.
// Game 2 (July, the road side batting): a tying single on a 2-1 count, after a wild pitch run.
const ROWS = [
  row({ events: 'field_out', description: 'hit_into_play', bb_type: 'ground_ball' }),
  row({ at_bat_number: '70', inning: '9', inning_topbot: 'Bot', batter: '11', bat_score_diff: '-1', bat_score: '3', post_bat_score: '5', events: 'home_run', description: 'hit_into_play', bb_type: 'fly_ball', balls: '3', strikes: '2' }),
  row({ game_pk: '2', game_date: '2026-07-04', pitch_number: '1', bat_score_diff: '-2', bat_score: '1', post_bat_score: '2', description: 'ball' }), // a run scores on a wild pitch
  row({ game_pk: '2', game_date: '2026-07-04', pitch_number: '2', balls: '2', strikes: '1', bat_score_diff: '-1', bat_score: '2', post_bat_score: '3', events: 'single', description: 'hit_into_play', bb_type: 'line_drive' }),
]
const shard = encodeMonth(ROWS, { season: 2026, month: '06', order: { 1: { 10: 1, 11: 4 }, 99: { 5: 2 } } })
const [leadoff, walkoff, tying] = decodePlateAppearances(shard)
const only = (search, pa) => matcher(parseQuery(search))(pa)

test('a v2 shard keeps runs on the pitch, the batted-ball type, and lineups for its own games', () => {
  assert.equal(shard.v, 2)
  assert.deepEqual(shard.order, { 1: { 10: 1, 11: 4 } }, 'a lineup for a game not in the shard is dropped')
  assert.equal(walkoff.marginAfter, 1)
  assert.equal(walkoff.bbType, 'fly_ball')
  assert.equal(walkoff.slot, 4)
  assert.equal(tying.slot, null, 'no lineup on file')
  assert.equal(tying.margin, -2, 'the Score card reads the margin when the PA began')
  assert.equal(tying.marginLast, -1, 'the Moment card reads the margin before the last pitch')
})

test('a v1 shard decodes with the new fields null', () => {
  const v1 = structuredClone(shard)
  v1.v = 1
  delete v1.order
  delete v1.cols.rs
  delete v1.cols.bb
  delete v1.dict.bb
  const [, w] = decodePlateAppearances(v1)
  assert.equal(w.marginAfter, null)
  assert.equal(w.bbType, null)
  assert.equal(w.slot, null)
  assert.deepEqual(momentValues(w), ['last'])
})

test('score: tied, ahead or behind, and by how many, capped at 3+', () => {
  assert.deepEqual(scoreValues(0), ['tied'])
  assert.deepEqual(scoreValues(2), ['ahead', 'up2'])
  assert.deepEqual(scoreValues(-7), ['behind', 'down3'])
  assert.deepEqual(scoreValues(null), [])
  assert.ok(only('?sc=down2', tying))
  assert.ok(!only('?sc=down1', tying))
})

test('moments: walk-off, go-ahead, tying, and the game\'s first and last PA', () => {
  assert.deepEqual(momentValues(leadoff), ['first'])
  assert.deepEqual(momentValues(walkoff), ['ahead', 'walkoff', 'last'])
  assert.deepEqual(momentValues(tying), ['tie', 'first', 'last'], 'the wild pitch run is not the single\'s')
  assert.deepEqual(momentValues({ marginLast: 0, marginAfter: 1, top: true, inning: 9 }), ['ahead'], 'a top-half go-ahead is no walk-off')
  assert.deepEqual(momentValues({ marginLast: -1, marginAfter: 2, top: false, inning: 8 }), ['ahead'], 'nor one before the 9th')
  assert.deepEqual(momentValues({ marginLast: 1, marginAfter: 2 }), [], 'adding to a lead is no moment')
})

test('count groups read the last pitch\'s count, from the batter\'s side; a full count is in none', () => {
  assert.equal(countGroup([2, 1]), 'ahead')
  assert.equal(countGroup([1, 1]), 'even')
  assert.equal(countGroup([0, 0]), 'even')
  assert.equal(countGroup([1, 2]), 'behind')
  assert.equal(countGroup([3, 2]), null)
  assert.equal(countGroup([null, null]), null)
  assert.ok(only('?cnt=ahead', tying))
  assert.ok(!only('?cnt=even', tying), 'passing through 0-0 does not make a PA even')
  assert.ok(only('?cnt=0-0', tying), 'a plain count still means passed through')
})

test('batted ball type, batting slot, month, and home or road', () => {
  assert.ok(only('?bb=line_drive', tying))
  assert.ok(only('?bb=!ground_ball', walkoff))
  assert.ok(only('?slot=4', walkoff))
  assert.ok(!only('?slot=4', tying))
  assert.ok(only('?mon=07', tying))
  assert.ok(only('?mon=06', leadoff))
  assert.ok(only('?ha=R', leadoff), 'the top half bats on the road')
  assert.ok(only('?ha=H', walkoff))
})

test('a card needing store v2 is blocked until every searched month is rebuilt', () => {
  const index = mergeIndex(null, 2026, '06', shard, [], 'x')
  assert.equal(index.seasons[2026].months['06'].v, 2)
  index.seasons[2025] = { months: { '06': { through: '2025-06-30', pitches: 1, pas: 1 } } }
  assert.equal(storeVersion(index, [2026]), 2)
  assert.equal(storeVersion(index, [2025, 2026]), 1, 'a month with no v was built as v1')
  assert.deepEqual(unsupported(2025, 1).filter((b) => b.rebuild).map((b) => b.key), ['mom', 'bb', 'slot'])
  assert.deepEqual(unsupported(2025, 2), [])
  assert.deepEqual(unsupported(2005, 2).find((b) => b.key === 'bb'), { key: 'bb', label: 'Batted ball type', since: 2008 }, 'a season before the card reads its since year')
  for (const k of ['sc', 'mom', 'bb', 'slot', 'mon', 'ha']) assert.ok(FILTER_BY_KEY[k], k)
})

test('a lineup comes from the box score\'s battingOrder, subs in their slot', () => {
  const box = { teams: { home: { players: { ID1: { person: { id: 1 }, battingOrder: '400' }, ID2: { person: { id: 2 }, battingOrder: '401' }, ID3: { person: { id: 3 } } } }, away: { players: { ID4: { person: { id: 4 }, battingOrder: '900' } } } } }
  assert.deepEqual(lineupOf(box), { 1: 4, 2: 4, 4: 9 })
  assert.deepEqual(lineupOf(null), {})
  assert.deepEqual(keptLineups({ v: 2, order: { 5: { 1: 3 } } }), { 5: { 1: 3 } })
  assert.deepEqual(keptLineups({ v: 1 }), {}, 'a v1 shard has no lineups to keep')
  assert.deepEqual(keptLineups(null), {})
})
