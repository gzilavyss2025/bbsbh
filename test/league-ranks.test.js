// League rank "N of M" (#1856) and the hero tile data (#1907): the pure halves.
// Open surfaces (ADR-0034): a rank is not a score.
import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchRankMarks, poolsOf, rankMarks } from '../src/api/player/leagueRanks.js'
import { hitterTiles, pitcherTiles, withLeagueFigure } from '../src/api/person/stats.js'

// The shape of /api/v1/stats?playerPool=qualified&leagueId=104&fields=... (checked live
// 2026-10-13: hitting totalSplits 68, pitching 20; Turang 668930 is in the hitting pool).
const pool = (ids) => ({ ids: new Set(ids) })
const NL = 104
const POOLS = new Map([[NL, pool([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])]])
const split = (stat, league = { id: NL, name: 'National League' }) => ({ league, stat })

test('poolsOf reads each group of one response: the qualified ids and their count', () => {
  const data = {
    stats: [
      { group: { displayName: 'hitting' }, totalSplits: 2, splits: [{ player: { id: 7 } }, { player: { id: 9 } }] },
      { group: { displayName: 'pitching' }, totalSplits: 1, splits: [{ player: { id: 3 } }] },
    ],
  }
  const p = poolsOf(data)
  assert.equal(p.hitting.ids.size, 2)
  assert.ok(p.hitting.ids.has(9))
  assert.equal(p.pitching.ids.size, 1)
  assert.deepEqual(poolsOf(null), { hitting: pool([]), pitching: pool([]) })
})

test('a qualified hitter in the top 10 gets "N of M", in the order of the stat list', () => {
  const marks = rankMarks([split({ homeRuns: 2, avg: '5', rbi: 10 })], 'hitting', POOLS, 3)
  assert.deepEqual(marks.map((m) => [m.key, m.rank, m.of, m.text]), [
    ['avg', 5, 12, '5 of 12'],
    ['homeRuns', 2, 12, '2 of 12'],
    ['rbi', 10, 12, '10 of 12'],
  ])
})

test('rank 11 and beyond shows nothing', () => {
  assert.deepEqual(rankMarks([split({ avg: '11', homeRuns: 25 })], 'hitting', POOLS, 3), [])
})

test('ties keep both marks at the same rank', () => {
  const marks = rankMarks([split({ avg: '2', obp: '2' })], 'hitting', POOLS, 3)
  assert.deepEqual(marks.map((m) => m.text), ['2 of 12', '2 of 12'])
})

test('a player outside the qualified pool gets no rank, even at rank 1 (a closer)', () => {
  assert.deepEqual(rankMarks([split({ saves: 1 })], 'pitching', new Map([[NL, pool([1, 2])]]), 99), [])
})

test('a missing league, a league with no pool, or no splits gives no rank', () => {
  assert.deepEqual(rankMarks([split({ avg: '1' }, null)], 'hitting', POOLS, 3), [])
  assert.deepEqual(rankMarks([split({ avg: '1' }, { id: 103 })], 'hitting', POOLS, 3), [])
  assert.deepEqual(rankMarks([], 'hitting', POOLS, 3), [])
  assert.deepEqual(rankMarks(undefined, 'hitting', POOLS, 3), [])
})

test('a player traded across leagues gets no rank: each league ranks one club, the tiles total both', () => {
  const two = [split({ avg: '1' }), split({ avg: '2' }, { id: 103, name: 'American League' })]
  const pools = new Map([[NL, pool([3])], [103, pool([3])]])
  assert.deepEqual(rankMarks(two, 'hitting', pools, 3), [])
})

test('a stat outside the list, or one that is not a number, is skipped', () => {
  assert.deepEqual(rankMarks([split({ hits: 1, avg: 'x' })], 'hitting', POOLS, 3), [])
})

test('pitching reads the pitching list', () => {
  const marks = rankMarks([split({ era: '1', strikeOuts: 3, avg: '4' })], 'pitching', POOLS, 3)
  assert.deepEqual(marks.map((m) => m.key), ['era', 'strikeOuts'])
})

test('hitter tiles carry the SO caption "680 PA"', () => {
  const tiles = hitterTiles({ avg: '.280', strikeOuts: 120, plateAppearances: 680 }, 2)
  assert.equal(tiles.find((t) => t.k === 'SO').caption, '680 PA')
  assert.equal(tiles.find((t) => t.k === 'AVG').caption, undefined)
})

test('pitcher tiles carry the W–L caption "20 GS"; a closer has none', () => {
  const stat = { wins: 10, losses: 4, gamesStarted: 20, saves: 30 }
  assert.equal(pitcherTiles(stat, 'SP', 3).find((t) => t.k === 'W–L').caption, '20 GS')
  assert.equal(pitcherTiles(stat, 'CL', 3).find((t) => t.k === 'SV').caption, undefined)
  assert.equal(pitcherTiles({ wins: 1, losses: 1 }, 'RP', 3)[0].caption, undefined)
})

test('withLeagueFigure sets "lg" on AVG (.xxx) and ERA (x.xx) and leaves the rest', () => {
  const hit = withLeagueFigure(hitterTiles({ avg: '.280' }, 1), 'hitting', 0.2478)
  assert.equal(hit.find((t) => t.k === 'AVG').lg, '.248')
  assert.equal(hit.filter((t) => t.lg).length, 1)
  const arm = withLeagueFigure(pitcherTiles({ era: '3.00' }, 'SP', 1), 'pitching', 4.17)
  assert.equal(arm.find((t) => t.k === 'ERA').lg, '4.17')
  assert.equal(withLeagueFigure(hitterTiles({ avg: '.280' }, 1), 'hitting', null).some((t) => t.lg), false)
})

test('fetchRankMarks asks once per league for both groups, and not at all with no rankings', async (t) => {
  const urls = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    urls.push(String(url))
    return Response.json({
      stats: [{ group: { displayName: 'hitting' }, splits: [{ player: { id: 3 } }] }],
    })
  })
  const splits = [split({ avg: '4', homeRuns: 1 })]
  const marks = await fetchRankMarks(3, 'hitting', splits, 2031)
  assert.deepEqual(marks.map((m) => m.text), ['4 of 1', '1 of 1'])
  // The pitching group rides the same request, and the second call hits the cache.
  assert.deepEqual(await fetchRankMarks(3, 'pitching', splits, 2031), [])
  assert.equal(urls.length, 1)
  assert.match(urls[0], /playerPool=qualified.*leagueId=104/)
  assert.deepEqual(await fetchRankMarks(3, 'hitting', [], 2031), [])
  assert.equal(urls.length, 1)
})
