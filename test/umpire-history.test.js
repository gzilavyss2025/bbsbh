import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { buildUmpireHistory, shardUmpireHistory } from '../scripts/lib/umpire/history.mjs'
import { shardKey100 } from '../src/lib/shardKey.js'
import { careerSeasons, recordWith } from '../src/api/history/umpireHistory.js'

// Umpire history before Tally's own season files (issue 1565): games at each
// position per season, and each club's record with the umpire at home plate.
// Source: the Stats API schedule with officials, one call per season.

const ump = (id, fullName, officialType) => ({ official: { id, fullName }, officialType })
const game = (gamePk, date, { away = 158, home = 112, as = 3, hs = 2, aw, hw, type = 'R', state = 'Final', officialDate = date, officials, gameNumber = 1 } = {}) => ({
  gamePk,
  gameType: type,
  gameNumber,
  officialDate,
  status: { abstractGameState: state },
  teams: {
    away: { team: { id: away }, score: as, isWinner: aw ?? as > hs },
    home: { team: { id: home }, score: hs, isWinner: hw ?? hs > as },
  },
  officials: officials ?? [ump(1, 'Al Plate', 'Home Plate'), ump(2, 'Bo Base', 'First Base')],
  _date: date,
})
const schedule = (season, games) => {
  const byDate = new Map()
  for (const g of games) {
    const { _date, ...rest } = g
    if (!byDate.has(_date)) byDate.set(_date, [])
    byDate.get(_date).push(rest)
  }
  return { season, dates: [...byDate].map(([date, gs]) => ({ date, games: gs })) }
}

// Ten games over two seasons.
const seasons = [
  schedule(2001, [
    game(1, '2001-04-02'), // MIL wins at CHC
    game(2, '2001-04-03', { as: 1, hs: 5 }), // CHC wins
    // A doubleheader: two games, the same day, the same crew.
    game(3, '2001-04-04', { gameNumber: 1 }),
    game(4, '2001-04-04', { gameNumber: 2, as: 0, hs: 4 }),
    // A tie (a game called and never resumed): it counts as a game worked, in no record.
    game(5, '2001-04-05', { as: 2, hs: 2, aw: false, hw: false }),
    // A game with no officials listed: no umpire to credit.
    game(6, '2001-04-06', { officials: [] }),
    // A postponed game the schedule also lists under its first date: only the
    // listing whose date is its own officialDate counts.
    game(7, '2001-04-07', { officialDate: '2001-04-08' }),
    game(7, '2001-04-08'),
  ]),
  schedule(2002, [
    // A postseason game with a six-man crew.
    game(8, '2002-10-02', { type: 'D', officials: [ump(2, 'Bo Base', 'Home Plate'), ump(1, 'Al Plate', 'Left Field'), ump(3, 'Cy Corner', 'Right Field')] }),
    // An All-Star Game: its sides are not clubs, so it is left out.
    game(9, '2002-07-09', { type: 'A', away: 159, home: 160 }),
    // A game not Final: left out.
    game(10, '2002-04-10', { state: 'Preview' }),
  ]),
]

test('buildUmpireHistory counts games at each position per season', () => {
  const { umpires, report } = buildUmpireHistory(seasons)
  assert.deepEqual(umpires.get(1).seasons, [
    [2001, 6, 0, 0, 0, 0, 0],
    [2002, 0, 0, 0, 0, 1, 0],
  ])
  assert.deepEqual(umpires.get(2).seasons, [
    [2001, 0, 6, 0, 0, 0, 0],
    [2002, 1, 0, 0, 0, 0, 0],
  ])
  assert.deepEqual(umpires.get(3).seasons, [[2002, 0, 0, 0, 0, 0, 1]])
  assert.equal(umpires.get(1).name, 'Al Plate')
  assert.deepEqual(report, { seasons: [2001, 2002], games: 7, noOfficials: 1, umpires: 3 })
})

test('buildUmpireHistory keeps each club record with the home-plate umpire only', () => {
  const { umpires } = buildUmpireHistory(seasons)
  // Games 1, 3, 7 MIL wins; games 2, 4 CHC wins; game 5 a tie.
  assert.deepEqual(umpires.get(1).record, { 112: [2, 3], 158: [3, 2] })
  // Bo Base worked the plate once: game 8, MIL 3 at CHC 2.
  assert.deepEqual(umpires.get(2).record, { 112: [0, 1], 158: [1, 0] })
  assert.deepEqual(umpires.get(3).record, {})
})

test('shardUmpireHistory files each umpire under shardKey100 of his id', () => {
  const { umpires } = buildUmpireHistory(seasons)
  umpires.set(101, { name: 'Di Same', seasons: [[2001, 1, 0, 0, 0, 0, 0]], record: {} })
  const shards = shardUmpireHistory(umpires, { firstSeason: 2001, throughSeason: 2002 })
  assert.deepEqual([...shards.keys()].sort(), ['01', '02', '03'])
  const s01 = shards.get(shardKey100(1))
  assert.equal(s01.firstSeason, 2001)
  assert.equal(s01.throughSeason, 2002)
  assert.deepEqual(Object.keys(s01.umpires), ['1', '101'])
  assert.equal('generatedAt' in s01, false)
})

test('the reader returns career seasons and a club record, and degrades when missing', async (t) => {
  const { umpires } = buildUmpireHistory(seasons)
  const shards = shardUmpireHistory(umpires, { firstSeason: 2001, throughSeason: 2002 })
  const fetched = mock.method(globalThis, 'fetch', async (url) => {
    const m = /\/data\/umpire-history\/(\d\d)\.json$/.exec(String(url))
    const body = m && shards.get(m[1])
    return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 404 }
  })
  t.after(() => fetched.mock.restore())

  assert.deepEqual(await careerSeasons(1), [
    { season: 2001, games: 6, byRole: { HP: 6, '1B': 0, '2B': 0, '3B': 0, LF: 0, RF: 0 } },
    { season: 2002, games: 1, byRole: { HP: 0, '1B': 0, '2B': 0, '3B': 0, LF: 1, RF: 0 } },
  ])
  assert.deepEqual(await recordWith(1, 158), { wins: 3, losses: 2, throughSeason: 2002 })
  // A club with no game behind this umpire's plate, an unknown umpire, a missing shard.
  assert.equal(await recordWith(3, 158), null)
  assert.equal(await recordWith(99, 158), null)
  assert.deepEqual(await careerSeasons(99), [])
  assert.deepEqual(await careerSeasons(1234), [])
})
