// Unit coverage for recentDecidedGames — the Team Page's Last 10 Games card
// window. The one invariant worth pinning: the window comes from `won !=
// null`, which fetchTeamSchedule already cutoff-gates against a mid-scoring
// visitor's ?d= date, never from Final status directly (which would bypass
// that cutoff and could surface the very game the visitor opened this page
// from). See recentDecidedGames' own header comment in src/api/scheduleGames.js.
import assert from 'node:assert/strict'
import test from 'node:test'
import { recentDecidedGames } from '../src/api/scheduleGames.js'

function game(apiDate, { won = null, final = false } = {}) {
  return {
    gamePk: apiDate,
    apiDate,
    gameNumber: 1,
    doubleHeader: 'N',
    isHome: true,
    // A row can be Final in the feed's own sense while still cutoff-gated
    // to `won: null` by fetchTeamSchedule — this flag exists only so the
    // "never filter on Final" test below has something to (wrongly) filter on.
    final,
    won,
  }
}

test('keeps only games with a decided won, in list order', () => {
  const schedule = [
    game('2026-07-01', { won: true, final: true }),
    game('2026-07-02', { won: null, final: false }), // not yet played
    game('2026-07-03', { won: false, final: true }),
  ]
  assert.deepEqual(
    recentDecidedGames(schedule).map((g) => g.apiDate),
    ['2026-07-01', '2026-07-03'],
  )
})

test('never surfaces a game whose won is cutoff-gated to null, even if Final in the feed', () => {
  // Simulates a mid-scoring visitor: fetchTeamSchedule has already frozen
  // `won` to null for today's game and anything later, regardless of the
  // feed's own `final` flag. A filter keyed on `final` instead of `won`
  // would leak this game's result — that's exactly the regression this
  // pins.
  const schedule = [
    game('2026-08-01', { won: true, final: true }),
    game('2026-08-02', { won: null, final: true }), // the game being scored right now
  ]
  const window = recentDecidedGames(schedule)
  assert.equal(window.some((g) => g.apiDate === '2026-08-02'), false)
  assert.deepEqual(window.map((g) => g.apiDate), ['2026-08-01'])
})

test('keeps only the most recent `limit` decided games, oldest first', () => {
  const schedule = Array.from({ length: 12 }, (_, i) =>
    game(`2026-07-${String(i + 1).padStart(2, '0')}`, { won: i % 2 === 0, final: true }),
  )
  const window = recentDecidedGames(schedule)
  assert.equal(window.length, 10)
  assert.equal(window[0].apiDate, '2026-07-03')
  assert.equal(window[window.length - 1].apiDate, '2026-07-12')
})

test('degrades to an empty window when nothing is decided yet', () => {
  const schedule = [game('2026-04-01', { won: null }), game('2026-04-02', { won: null })]
  assert.deepEqual(recentDecidedGames(schedule), [])
})
