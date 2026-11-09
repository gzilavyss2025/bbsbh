// The sliced season board (#2981): the generator keeps every tense play (LI >= the
// floor) with its park, and the page ranks and slices that flat list itself.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mergePlays, playRows } from '../scripts/lib/tensest/tensest.mjs'
import { clubTop, filterPlays, filterOptions, leagueTop } from '../src/api/tensest/slices.js'

const game = { gamePk: 9, gameType: 'R', officialDate: '2026-07-10', venue: { id: 2680, name: 'Petco Park' },
  teams: { away: { team: { id: 158 }, score: 4 }, home: { team: { id: 135 }, score: 3 } } }
const feedPlay = (li) => ({ leverageIndex: li, result: { event: 'Single', description: 'x' }, about: { inning: 9, isTopInning: true },
  matchup: { batter: { id: 1, fullName: 'Jackson Chourio' }, pitcher: { id: 2, fullName: 'Mason Miller' } } })

test('playRows carries the park from the schedule game, not the home club', () => {
  const [row] = playRows(game, [feedPlay(5)])
  assert.deepEqual([row.vid, row.vn], [2680, 'Petco Park'])
})

test('playRows: a game with no venue on record gets nulls, not a crash', () => {
  const [row] = playRows({ ...game, venue: undefined }, [feedPlay(5)])
  assert.deepEqual([row.vid, row.vn], [null, null])
})

// A flat row: pk, i, li, batting club via top/aw/hm, batter, pitcher, park.
const p = (pk, li, o = {}) => ({ pk, i: 1, li, aw: 158, hm: 135, top: 1, bid: 1, bn: 'Jackson Chourio', pid: 2, pn: 'Mason Miller', vid: 2680, vn: 'Petco Park', ...o })

test('mergePlays keeps one row per play, tensest first', () => {
  const out = mergePlays([p(1, 5)], [p(1, 5), p(2, 9)])
  assert.deepEqual(out.map((r) => [r.pk, r.li]), [[2, 9], [1, 5]])
})

test('leagueTop and clubTop rank with ties, filing a play under the club batting and the club pitching', () => {
  const plays = [p(1, 9), p(2, 9), p(3, 8), p(4, 7, { top: 0 })]
  assert.deepEqual(leagueTop(plays, 2).map((r) => [r.pk, r.rank]), [[1, 1], [2, 1]])
  // top half: away (158) bats, home (135) pitches; the bottom-half play the reverse
  assert.deepEqual(clubTop(plays, 158, 'bat', 25).map((r) => r.pk), [1, 2, 3])
  assert.deepEqual(clubTop(plays, 135, 'pit', 25).map((r) => r.pk), [1, 2, 3])
  assert.deepEqual(clubTop(plays, 135, 'bat', 25).map((r) => r.pk), [4])
})

test('filterPlays combines batter, pitcher, park, batting club and pitching club', () => {
  const plays = [p(1, 9), p(2, 8, { pid: 3, pn: 'Edwin Díaz' }), p(3, 7, { vid: 32, vn: 'American Family Field' }), p(4, 6, { top: 0, bid: 5, bn: 'Fernando Tatis Jr.' })]
  assert.deepEqual(filterPlays(plays, { pitcher: 2 }).map((r) => r.pk), [1, 3, 4])
  assert.deepEqual(filterPlays(plays, { pitcher: 2, park: 2680 }).map((r) => r.pk), [1, 4])
  assert.deepEqual(filterPlays(plays, { batter: 5 }).map((r) => r.pk), [4])
  assert.deepEqual(filterPlays(plays, { batting: 135 }).map((r) => r.pk), [4])
  assert.deepEqual(filterPlays(plays, { pitching: 135 }).map((r) => r.pk), [1, 2, 3])
  assert.deepEqual(filterPlays(plays, {}).map((r) => r.pk), [1, 2, 3, 4])
  assert.deepEqual(filterPlays(plays, { batter: 99 }), [])
})

test('filterOptions lists each batter, pitcher and park once, by name', () => {
  const plays = [p(1, 9), p(2, 8, { pid: 3, pn: 'Edwin Díaz' }), p(3, 7, { vid: null, vn: null })]
  const o = filterOptions(plays)
  assert.deepEqual(o.pitchers, [{ id: 3, name: 'Edwin Díaz' }, { id: 2, name: 'Mason Miller' }])
  assert.deepEqual(o.batters, [{ id: 1, name: 'Jackson Chourio' }])
  assert.deepEqual(o.parks, [{ id: 2680, name: 'Petco Park' }])
})
