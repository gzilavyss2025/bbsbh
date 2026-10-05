import assert from 'node:assert/strict'
import test from 'node:test'
import { gameLogView } from '../src/api/person/gameLog.js'
import { MLB_LOG_GAME_TYPES } from '../src/api/boxlines/rows.js'

const row = (date, gameType, gamePk) => ({
  date,
  gameType,
  isHome: true,
  opponent: { teamName: 'Rays' },
  game: { gamePk },
  stat: { hits: 1, atBats: 4 },
})

test('the MLB game log asks for the regular season and every postseason round, never the umbrella P', () => {
  assert.equal(MLB_LOG_GAME_TYPES, 'R,F,D,L,W')
})

test('gameLogView: an October row wears its round and a regular-season row wears none', () => {
  const view = gameLogView(
    [row('2026-09-28', 'R', 1), row('2026-10-01', 'F', 2), row('2026-10-05', 'D', 3), row('2026-10-12', 'L', 4), row('2026-10-26', 'W', 5)],
    'hitting',
    null,
    8,
  )
  assert.deepEqual(
    view.rows.map((r) => r.series),
    ['WS', 'LCS', 'DS', 'WC', ''],
  )
})

test('gameLogView: the cutoff still holds back a postseason game on or after the day', () => {
  const view = gameLogView([row('2026-09-28', 'R', 1), row('2026-10-05', 'D', 3)], 'hitting', '2026-10-05', 8)
  assert.deepEqual(view.rows.map((r) => r.gamePk), [1])
})
