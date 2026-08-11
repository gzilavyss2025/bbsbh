import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeAccuracyRows, upsertGame } from '../scripts/lib/umpire-accuracy-merge.mjs'

// Regression for a real production incident (2026-08-11): MLB corrected the
// AAA gamePk 814888 Home Plate assignment from "Glenn Ballangao" (832019) to
// "Joe Belangia" (682501) after gen-umpire-accuracy.mjs had already merged
// the game under the wrong id. Without the fix, the stale row stays under
// 832019 forever — he keeps accuracy data for a game he never called, and
// has no gen-umpires.mjs shard (that generator always rebuilds fresh from
// the live schedule), failing test/umpire-shards.test.js's invariant.
test('a reassigned game moves to its new umpire instead of duplicating', () => {
  const prev = {
    832019: {
      id: 832019,
      name: 'Glenn Ballangao',
      games: [{ gamePk: 814888, date: '2026-08-09', level: 'AAA', called: 211 }],
    },
  }
  const rows = [
    {
      gamePk: 814888,
      date: '2026-08-09',
      level: 'AAA',
      gameType: 'R',
      umpId: 682501,
      umpName: 'Joe Belangia',
      acc: { called: 211 },
    },
  ]
  const merged = mergeAccuracyRows(prev, rows)
  assert.equal(merged[832019], undefined, 'old umpire should have no ghost entry left')
  assert.ok(merged[682501], 'new umpire should hold the reassigned game')
  assert.equal(merged[682501].games.length, 1)
  assert.equal(merged[682501].games[0].gamePk, 814888)
})

test('an umpire keeps his other games when only one is reassigned away', () => {
  const prev = {
    832019: {
      id: 832019,
      name: 'Glenn Ballangao',
      games: [
        { gamePk: 814888, date: '2026-08-09', level: 'AAA', called: 211 },
        { gamePk: 800001, date: '2026-08-05', level: 'AAA', called: 200 },
      ],
    },
  }
  const rows = [
    {
      gamePk: 814888,
      date: '2026-08-09',
      level: 'AAA',
      gameType: 'R',
      umpId: 682501,
      umpName: 'Joe Belangia',
      acc: { called: 211 },
    },
  ]
  const merged = mergeAccuracyRows(prev, rows)
  assert.equal(merged[832019].games.length, 1)
  assert.equal(merged[832019].games[0].gamePk, 800001)
})

test('a fresh row for an unseen umpire is just added', () => {
  const rows = [
    {
      gamePk: 900001,
      date: '2026-08-11',
      level: 'MLB',
      gameType: 'R',
      umpId: 555,
      umpName: 'New Ump',
      acc: { called: 150 },
    },
  ]
  const merged = mergeAccuracyRows({}, rows)
  assert.equal(merged[555].games.length, 1)
})

test('upsertGame dedupes by gamePk, newest first', () => {
  const games = upsertGame([{ gamePk: 1, date: '2026-08-01' }], { gamePk: 1, date: '2026-08-01', called: 5 })
  assert.equal(games.length, 1)
  assert.equal(games[0].called, 5)
  const withNewer = upsertGame(games, { gamePk: 2, date: '2026-08-10' })
  assert.equal(withNewer[0].gamePk, 2, 'newest game sorts first')
})
