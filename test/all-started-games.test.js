// Unit coverage for allStartedGames — TeamPhotosPage's own game list, and its
// deliberate departure from every other consumer's `won != null` gate (see
// that function's own header in src/api/scheduleGames.js). The one invariant
// worth pinning: it keys on `started`, never on `won` — a live game has no
// `won` yet but must still be walked, since surfacing that game's photos is
// the entire reason this export exists instead of reusing allDecidedGames.
import assert from 'node:assert/strict'
import test from 'node:test'
import { allStartedGames } from '../src/api/scheduleGames.js'

function game(apiDate, { started = false, won = null } = {}) {
  return { gamePk: apiDate, apiDate, gameNumber: 1, doubleHeader: 'N', isHome: true, started, won }
}

test('keeps a live game (started, not yet decided) alongside decided ones', () => {
  const schedule = [
    game('2026-07-01', { started: true, won: true }),
    game('2026-07-02', { started: true, won: null }), // in progress right now
    game('2026-07-03', { started: false, won: null }), // not played yet
  ]
  assert.deepEqual(
    allStartedGames(schedule).map((g) => g.apiDate),
    ['2026-07-01', '2026-07-02'],
  )
})

test('drops a not-yet-started game even when every other field looks decided', () => {
  const schedule = [game('2026-08-10', { started: false, won: true })]
  assert.deepEqual(allStartedGames(schedule), [])
})

test('degrades to an empty list when nothing has started yet', () => {
  assert.deepEqual(allStartedGames([]), [])
})
