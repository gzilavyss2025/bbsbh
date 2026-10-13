// League rank "N of M" (#1856) and the hero tile data (#1907): the pure halves.
// Open surfaces (ADR-0034): a rank is not a score.
import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchRankMarks, poolsOf, rankMarks } from '../src/api/player/leagueRanks.js'
import { hitterTiles, pitcherTiles, withLeagueFigure } from '../src/api/person/stats.js'

// The shape of /api/v1/stats?leagueId=104&limit=1&fields=...totalSplits (checked live
// 2026-10-13, NL: qualified hitting 68, pitching 20; all hitting 412, pitching 473).
const NL = 104
const sizes = (qh, qp, ah, ap) => ({ qualified: { hitting: qh, pitching: qp }, all: { hitting: ah, pitching: ap } })
const POOLS = new Map([[NL, sizes(68, 20, 412, 473)]])
const split = (stat, league = { id: NL, name: 'National League' }) => ({ league, stat })

test('poolsOf reads totalSplits of each group', () => {
  const data = {
    stats: [
      { group: { displayName: 'hitting' }, totalSplits: 68 },
      { group: { displayName: 'pitching' }, totalSplits: 20 },
    ],
  }
  assert.deepEqual(poolsOf(data), { hitting: 68, pitching: 20 })
  assert.deepEqual(poolsOf(null), { hitting: 0, pitching: 0 })
})

test('a rate stat ranks among the qualified, a counting stat among all players of the league', () => {
  const marks = rankMarks([split({ homeRuns: 2, avg: '5', rbi: 10 })], 'hitting', POOLS)
  assert.deepEqual(marks.map((m) => [m.label, m.rank, m.of, m.text]), [
    ['HR', 2, 412, '2 of 412'],
    ['RBI', 10, 412, '10 of 412'],
    ['AVG', 5, 68, '5 of 68'],
  ])
  const arm = rankMarks([split({ era: '1', strikeOuts: 3, wins: 2, saves: 4, inningsPitched: 5 })], 'pitching', POOLS)
  assert.deepEqual(arm.map((m) => [m.label, m.text]), [
    ['ERA', '1 of 20'], ['K', '3 of 473'], ['W–L', '2 of 473'], ['SV', '4 of 473'], ['IP', '5 of 473'],
  ])
})

test('a stat with a hero tile carries the tile key; a stat without one carries its own name', () => {
  const stat = { avg: '1', homeRuns: 1, rbi: 1, obp: '1', slg: '1', ops: '1', stolenBases: 1, hits: 1, strikeOuts: 1 }
  const hit = rankMarks([split(stat)], 'hitting', POOLS)
  assert.deepEqual(hit.map((m) => m.label), ['HR', 'RBI', 'AVG', 'OBP', 'SLG', 'OPS', 'SB'])
  const tiles = hitterTiles({}, 1).map((t) => t.k)
  assert.ok(['HR', 'RBI', 'AVG'].every((k) => tiles.includes(k)))
  // OBP, SLG, OPS and WHIP are rates (qualified pool); SB is a count (all players).
  assert.deepEqual(hit.map((m) => m.of), [412, 412, 68, 68, 68, 68, 412])
  const arm = rankMarks([split({ era: '1', whip: '1', wins: 1, saves: 1, inningsPitched: 1, strikeOuts: 1, avg: '1' })], 'pitching', POOLS)
  assert.deepEqual(arm.map((m) => [m.label, m.of]), [
    ['ERA', 20], ['WHIP', 20], ['K', 473], ['W–L', 473], ['SV', 473], ['IP', 473],
  ])
  const lead = [...pitcherTiles({}, 'CL', 1), ...pitcherTiles({}, 'SP', 1)].map((t) => t.k)
  assert.ok(['ERA', 'K', 'W–L', 'SV', 'IP'].every((k) => lead.includes(k)))
})

test('rank 11 and beyond shows nothing', () => {
  assert.deepEqual(rankMarks([split({ avg: '11', homeRuns: 25 })], 'hitting', POOLS), [])
})

test('ties keep both marks at the same rank', () => {
  const marks = rankMarks([split({ homeRuns: 2, rbi: 2 })], 'hitting', POOLS)
  assert.deepEqual(marks.map((m) => m.text), ['2 of 412', '2 of 412'])
})

test('a missing league, a league with no pool, an empty pool or no splits gives no rank', () => {
  assert.deepEqual(rankMarks([split({ avg: '1' }, null)], 'hitting', POOLS), [])
  assert.deepEqual(rankMarks([split({ avg: '1' }, { id: 103 })], 'hitting', POOLS), [])
  assert.deepEqual(rankMarks([split({ avg: '1', homeRuns: 1 })], 'hitting', new Map([[NL, sizes(0, 0, 0, 0)]])), [])
  assert.deepEqual(rankMarks([], 'hitting', POOLS), [])
  assert.deepEqual(rankMarks(undefined, 'hitting', POOLS), [])
})

test('a player traded across leagues gets no rank: each league ranks one club, the tiles total both', () => {
  const two = [split({ avg: '1' }), split({ avg: '2' }, { id: 103, name: 'American League' })]
  assert.deepEqual(rankMarks(two, 'hitting', new Map([[NL, sizes(68, 20, 412, 473)], [103, sizes(60, 20, 400, 450)]])), [])
})

test('a split with no stat does not count as a league: a traded player still reads his one ranked split', () => {
  const two = [split({ homeRuns: 3 }), { league: { id: 103 } }]
  assert.deepEqual(rankMarks(two, 'hitting', POOLS).map((m) => m.text), ['3 of 412'])
})

test('a stat outside the list, or one that is not a number, is skipped', () => {
  assert.deepEqual(rankMarks([split({ hits: 1, avg: 'x' })], 'hitting', POOLS), [])
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

const poolsReply = (url, size) => {
  const n = String(url).includes('playerPool=qualified') ? size.q : size.a
  return Response.json({ stats: [{ group: { displayName: 'hitting' }, totalSplits: n }, { group: { displayName: 'pitching' }, totalSplits: n }] })
}

test('fetchRankMarks asks twice per league (qualified, all) for both groups, and not at all with no rankings', async (t) => {
  const urls = []
  t.mock.method(globalThis, 'fetch', async (url) => (urls.push(String(url)), poolsReply(url, { q: 68, a: 412 })))
  const splits = [split({ avg: '4', homeRuns: 1 })]
  const marks = await fetchRankMarks(3, 'hitting', splits, 2031)
  assert.deepEqual(marks.map((m) => m.text), ['1 of 412', '4 of 68'])
  // The pitching group rides the same two requests, and the second call hits the cache.
  assert.deepEqual(await fetchRankMarks(3, 'pitching', splits, 2031), [])
  assert.equal(urls.length, 2)
  assert.ok(urls.some((u) => /playerPool=qualified.*leagueId=104/.test(u)))
  assert.ok(urls.some((u) => /playerPool=all.*leagueId=104/.test(u)))
  assert.deepEqual(await fetchRankMarks(3, 'hitting', [], 2031), [])
  assert.equal(urls.length, 2)
})

test('an empty pool response is not kept: the next ask tries again', async (t) => {
  let size = { q: 0, a: 0 }
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (url) => (calls++, poolsReply(url, size)))
  const splits = [split({ homeRuns: 1 })]
  assert.deepEqual(await fetchRankMarks(3, 'hitting', splits, 2032), [])
  size = { q: 68, a: 412 }
  assert.deepEqual((await fetchRankMarks(3, 'hitting', splits, 2032)).map((m) => m.text), ['1 of 412'])
  assert.equal(calls, 4)
})

test('a traded hitter keeps the SO tile caption: the summed season carries plate appearances (#1907)', async () => {
  const { aggregateSplits, hitterTiles } = await import('../src/api/person/stats.js')
  const stint = (pa, so) => ({ team: { id: pa }, stat: { plateAppearances: pa, atBats: pa - 10, hits: 30, strikeOuts: so, baseOnBalls: 10 } })
  const season = aggregateSplits([stint(300, 70), stint(380, 101)], 'hitting')
  assert.equal(season.plateAppearances, 680)
  const so = hitterTiles(season, null).find((t) => t.k === 'SO')
  assert.equal(so.caption, '680 PA')
})

test('a rank larger than its pool shows nothing: early in a season "8 of 6" is not a rank', () => {
  const early = new Map([[NL, sizes(6, 6, 412, 473)]])
  assert.deepEqual(rankMarks([split({ era: '8', strikeOuts: 2 })], 'pitching', early).map((m) => m.text), ['2 of 473'])
})

test('an unknown group gives no marks, not an error', () => {
  assert.deepEqual(rankMarks([split({ avg: '1' })], 'fielding', POOLS), [])
})

test('a player traded across leagues costs no pool request', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (url) => (calls++, poolsReply(url, { q: 68, a: 412 })))
  const two = [split({ avg: '1' }), split({ avg: '2' }, { id: 103, name: 'American League' })]
  assert.deepEqual(await fetchRankMarks(3, 'hitting', two, 2033), [])
  assert.equal(calls, 0)
})
