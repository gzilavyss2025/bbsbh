import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchFinalScores } from '../src/api/boxlines/fetch.js'
import { pitchlogView } from '../src/screens/player/next/modules/pitchlog/pitchlogView.js'

// ADR-0117 retires ADR-0110: the player page's logs and photos show a game played today once
// the schedule reports it Final. A game still being played has no row, because rows.js keeps
// only a game that is Final and scored. A cutoff (a `?d=` link) still turns the cutoff day away.

const TODAY = '2026-10-13'

const app = (date, pk, { gs = 1, w = 0 } = {}) => ({
  date,
  gameType: 'R',
  isHome: true,
  league: { id: 104 },
  opponent: { id: 112, name: 'Chicago Cubs' },
  game: { gamePk: pk, gameNumber: 1 },
  stat: { gamesStarted: gs, wins: w, losses: 0, inningsPitched: '6.0', hits: 4, runs: 1, earnedRuns: 1, baseOnBalls: 1, strikeOuts: 5, homeRuns: 0, numberOfPitches: 90, strikes: 60 },
})

// A schedule stub: every gamePk asked for is Final 6-2, except `live`, which is in progress.
function stub({ live = [] } = {}) {
  const asked = []
  const m = mock.method(globalThis, 'fetch', async (url) => {
    const pks = (String(url).match(/gamePks=([\d,]+)/)?.[1] ?? '').split(',').map(Number)
    asked.push(...pks)
    const games = pks.map((gamePk) => ({
      gamePk,
      status: { abstractGameState: live.includes(gamePk) ? 'Live' : 'Final' },
      teams: { away: { score: 2, team: { id: 112 } }, home: { score: 6, team: { id: 158 } } },
    }))
    return { ok: true, status: 200, json: async () => ({ dates: [{ games }] }) }
  })
  return { asked, restore: () => m.mock.restore() }
}

// baseballToday() reads `new Date()`: pin it to 13:00 Pacific on TODAY.
const pinToday = () => mock.timers.enable({ apis: ['Date'], now: new Date(`${TODAY}T20:00:00Z`) })

test('a game still being played today has no score and no decision', async () => {
  pinToday()
  const api = stub({ live: [3] })
  try {
    const games = [app(TODAY, 3, { w: 1 })]
    const scores = await fetchFinalScores(games, 'pitching', null)
    assert.equal(scores.has(3), false)
    const [row] = pitchlogView(games, { scores }).rows
    assert.deepEqual([row.result, row.runs, row.dec], [null, null, null])
  } finally {
    api.restore()
    mock.timers.reset()
  }
})

test('a cutoff still turns the cutoff day and later days away', async () => {
  pinToday()
  const api = stub()
  try {
    const games = [app('2026-10-08', 1), app('2026-10-12', 2), app(TODAY, 3)]
    const scores = await fetchFinalScores(games, 'pitching', '2026-10-12')
    assert.deepEqual(api.asked, [1])
    assert.deepEqual([...scores.keys()], [1])
  } finally {
    api.restore()
    mock.timers.reset()
  }
})
