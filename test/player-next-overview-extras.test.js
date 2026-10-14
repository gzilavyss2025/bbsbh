// The Overview extras season card's pure view (#2010): chips that light a hero tile, the
// count tag, the By round rows and the one-tile-lit toggle.
import test from 'node:test'
import assert from 'node:assert/strict'
import { chipsView, countTag, nextLit, roundRows } from '../src/screens/player/next/top/overviewView.js'

const hitBlock = {
  group: 'hitting',
  ranks: [{ league: 'NL', club: null, items: [
    { label: '2B', rank: 2, text: '2nd' },
    { label: 'R', rank: 3, text: '3rd' },
    { label: 'RBI', rank: 6, text: '6th' },
  ] }],
  postseason: { title: '2026 Postseason', games: 6, tiles: [] },
  otherLevels: [],
}

test('a chip finds its hero tile by label; R and 2B have none', () => {
  const [lg] = chipsView(hitBlock)
  assert.deepEqual(lg.items.map((i) => [i.label, i.tile]), [['2B', null], ['R', null], ['RBI', 'RBI']])
})

test('a pitching chip reads RANK_STATS for pitching, not hitting', () => {
  const [lg] = chipsView({ group: 'pitching', ranks: [{ league: 'AL', items: [{ label: 'Wins', rank: 1, text: '1st' }] }] })
  assert.equal(lg.items[0].tile, 'W–L')
})

test('no ranks gives no chips', () => {
  assert.deepEqual(chipsView({ group: 'hitting', ranks: null }), [])
})

test('count tag lists ranks, postseason and levels from counts', () => {
  assert.equal(countTag([hitBlock]), '3 ranks · Postseason')
  const gasser = { group: 'pitching', ranks: null, postseason: { games: 1 }, otherLevels: [{ level: 'AAA', sportId: 11 }] }
  assert.equal(countTag([gasser]), 'Postseason · AAA')
  assert.equal(countTag([{ ranks: [{ items: [{}] }] }]), '1 rank')
  assert.equal(countTag([{}]), '')
})

test('one tile lights at a time; a second tap on the same chip clears it', () => {
  const a = nextLit(null, 'hitting', 'RBI')
  assert.deepEqual(a, { group: 'hitting', tile: 'RBI' })
  assert.equal(nextLit(a, 'hitting', 'RBI'), null)
  assert.deepEqual(nextLit(a, 'hitting', 'HR'), { group: 'hitting', tile: 'HR' })
  assert.equal(nextLit(a, 'hitting', null), null)
})

const bat = (h, ab, hr) => ({ gamesPlayed: 1, atBats: ab, hits: h, homeRuns: hr, rbi: 0, strikeOuts: 0, plateAppearances: ab, avg: '.000', ops: '.000' })

test('round rows build a tile row per round, keyed by gameType, with a dash for a gap', () => {
  const rows = roundRows([
    { gameType: 'D', series: 'NLDS', stat: { ...bat(2, 16, 0), gamesPlayed: 4, ops: '.347' } },
    { gameType: 'L', series: 'NLCS', stat: { ...bat(3, 5, 1), gamesPlayed: 2, ops: '2.150', avg: undefined } },
  ], 'hitting', null)
  assert.deepEqual(rows.map((r) => [r.gameType, r.series, r.games]), [['D', 'NLDS', 4], ['L', 'NLCS', 2]])
  assert.equal(rows[0].tiles.at(-1).k, 'OPS')
  assert.equal(rows[0].tiles.at(-1).v, '.347')
  assert.equal(rows[1].tiles.find((t) => t.k === 'AVG').v, '—')
  assert.equal(rows[0].tiles.length, 5)
})

test('pitcher round rows end in WHIP and lead by role', () => {
  const rows = roundRows([{ gameType: 'D', series: 'NLDS', stat: { gamesPlayed: 1, gamesStarted: 1, wins: 0, losses: 0, inningsPitched: '4.0', era: '2.25', strikeOuts: 3, whip: '1.00' } }], 'pitching', 'SP')
  assert.deepEqual(rows[0].tiles.map((t) => t.k), ['W–L', 'IP', 'ERA', 'K', 'WHIP'])
})

test('null rounds give no rows', () => {
  assert.deepEqual(roundRows(null, 'hitting', null), [])
})
