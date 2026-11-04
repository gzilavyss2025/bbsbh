// The Overview extras season card's pure view (#2010): chips that light a hero tile, the
// count tag, the By round rows and the one-tile-lit toggle.
import test from 'node:test'
import assert from 'node:assert/strict'
import { roundRows } from '../src/screens/player/next/top/overviewView.js'

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
  assert.equal(rows[0].tiles.length, 8)
})

test('pitcher round rows end in WHIP and lead by role', () => {
  const rows = roundRows([{ gameType: 'D', series: 'NLDS', stat: { gamesPlayed: 1, gamesStarted: 1, wins: 0, losses: 0, inningsPitched: '4.0', era: '2.25', strikeOuts: 3, whip: '1.00' } }], 'pitching', 'SP')
  assert.deepEqual(rows[0].tiles.map((t) => t.k), ['W–L', 'IP', 'ERA', 'K', 'WHIP'])
})

test('null rounds give no rows', () => {
  assert.deepEqual(roundRows(null, 'hitting', null), [])
})
