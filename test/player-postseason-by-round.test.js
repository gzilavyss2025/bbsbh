// The Overview extras card's "By round" switch (#2005): a player's postseason game log, one line
// per round. The log is asked for by round (F,D,L,W), never gameType=P: the pitching log would
// then mark every row 'P' and the round would be lost (boxlines/rows.js, POSTSEASON).
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchPostseasonByRound, postseasonByRoundView } from '../src/api/player/postseasonRegister.js'

const NL = { id: 104 }
const bat = (date, gameType, gamePk, stat) => ({
  date, gameType, league: NL, game: { gamePk },
  stat: { gamesPlayed: 1, atBats: 4, hits: 1, homeRuns: 0, rbi: 0, ...stat },
})
const arm = (date, gameType, gamePk, stat) => ({
  date, gameType, league: NL, game: { gamePk },
  stat: { gamesPlayed: 1, gamesStarted: 1, inningsPitched: '6.0', hits: 4, earnedRuns: 2, baseOnBalls: 1, strikeOuts: 7, ...stat },
})

const TURANG = [
  bat('2026-10-04', 'D', 1, { hits: 2 }),
  bat('2026-10-05', 'D', 2, { hits: 1, homeRuns: 1, rbi: 2 }),
  bat('2026-10-12', 'L', 3, { hits: 0 }),
  bat('2026-10-13', 'L', 4, { hits: 3 }),
]

test('a hitter\'s games group by round, in bracket order, each with its own sum', () => {
  const v = postseasonByRoundView([...TURANG].reverse(), 'hitting')
  assert.deepEqual(v.map((r) => [r.series, r.stat.gamesPlayed, r.stat.hits]), [['NLDS', 2, 3], ['NLCS', 2, 3]])
  assert.equal(v[0].stat.homeRuns, 1)
})

test('the rounds add up to the postseason total', () => {
  const v = postseasonByRoundView(TURANG, 'hitting')
  assert.equal(v.reduce((n, r) => n + r.stat.atBats, 0), 16)
  assert.equal(v.reduce((n, r) => n + r.stat.hits, 0), 6)
})

test('a player with one round gets one row; two equal lines are two games, not a duplicate', () => {
  const v = postseasonByRoundView([arm('2026-10-04', 'D', 1), arm('2026-10-09', 'D', 2)], 'pitching')
  assert.equal(v.length, 1)
  assert.equal(v[0].series, 'NLDS')
  assert.equal(v[0].stat.gamesPlayed, 2)
  assert.equal(v[0].stat.inningsPitched, '12.0')
  assert.equal(v[0].stat.strikeOuts, 14)
})

test('the World Series is both leagues\' and wears no league letter', () => {
  const v = postseasonByRoundView([bat('2026-10-25', 'W', 9, {})], 'hitting')
  assert.equal(v[0].series, 'WS')
})

test('no postseason games, or an unknown round, is null', () => {
  assert.equal(postseasonByRoundView([], 'hitting'), null)
  assert.equal(postseasonByRoundView([bat('2026-10-04', 'P', 1, {})], 'hitting'), null)
})

test('a game on or after `until` is held back', () => {
  const v = postseasonByRoundView(TURANG, 'hitting', '2026-10-13')
  assert.equal(v[1].stat.gamesPlayed, 1)
  assert.equal(postseasonByRoundView(TURANG, 'hitting', '2026-10-04'), null)
})

test('the fetch asks for the four rounds, never P, and holds today back', async () => {
  const urls = []
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    urls.push(String(url))
    const json = /\/seasons\//.test(url) ? { seasons: [{ postSeasonStartDate: '2000-01-01' }] } : { stats: [{ splits: TURANG }] }
    return { ok: true, status: 200, json: async () => json }
  })
  try {
    const out = await fetchPostseasonByRound(668930, 'hitting', { season: 2026, cutoff: '2026-10-13', today: '2026-10-14' })
    const log = urls.filter((u) => /stats=gameLog/.test(u))
    assert.equal(log.length, 1)
    assert.match(log[0], /gameType=F,D,L,W/)
    assert.doesNotMatch(log[0], /gameType=P/)
    assert.equal(out[1].stat.gamesPlayed, 1)
    assert.equal(await fetchPostseasonByRound(668930, 'hitting', { season: 2026, cutoff: '2025-09-10' }), null)
    assert.equal(await fetchPostseasonByRound(1, 'hitting', { season: 2026, hasDebuted: false }), null)
  } finally {
    fetchMock.mock.restore()
  }
})
