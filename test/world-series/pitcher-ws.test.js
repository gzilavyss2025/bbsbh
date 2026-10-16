import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { resetPitcherReads } from '../../src/api/game.js'
import { fetchPitcherWorldSeriesCareer, fetchWorldSeriesStartsBefore } from '../../src/api/postseason/pitcherWorldSeries.js'

// yearByYear gameType=W rows. A split with a `team` is one club's share; the
// split with no `team` is the traded arm's combined line.
const row = (season, gs, extra = {}) => ({
  season: String(season),
  stat: { gamesPlayed: gs, gamesStarted: gs, inningsPitched: '6.0', strikeOuts: 5, earnedRuns: 2, hits: 4, baseOnBalls: 1, ...extra },
})
const yby = (...splits) => ({ stats: [{ splits }] })
const EMPTY = yby()

function withApi(route, run) {
  resetPitcherReads()
  const urls = []
  const m = mock.method(globalThis, 'fetch', async (url) => {
    urls.push(String(url))
    return { ok: true, status: 200, json: async () => route(String(url)) ?? EMPTY }
  })
  return run(urls).finally(() => m.mock.restore())
}

test('only earlier seasons are summed; this season comes through the handed line', async () => {
  const body = yby(row(2016, 2), row(2024, 1), row(2026, 3)) // 2026 is the game year: left out
  const thisWs = { games: 1, gamesStarted: 1, wins: 0, losses: 0, saves: 0, holds: 0, inningsPitched: '5.0', strikeOuts: 4, baseOnBalls: 0, hits: 3, earnedRuns: 1 }
  const line = await withApi(() => body, () => fetchPitcherWorldSeriesCareer(1, 2026, thisWs))
  assert.equal(line.games, 4)
  assert.equal(line.gamesStarted, 4)
  assert.equal(line.strikeOuts, 14)
  assert.equal((await withApi(() => body, () => fetchPitcherWorldSeriesCareer(1, 2026))).games, 3)
})

test("a traded pitcher's keyless combined split is used, not the club splits too", async () => {
  const body = yby(
    { ...row(2018, 1), team: { id: 1 } },
    { ...row(2018, 1), team: { id: 2 } },
    row(2018, 2), // combined, no team key, listed last
  )
  const line = await withApi(() => body, () => fetchPitcherWorldSeriesCareer(1, 2026))
  assert.equal(line.games, 2)
})

test('the URL asks gameType=W yearByYear and never stats=career', async () => {
  const urls = await withApi(() => EMPTY, async (u) => (await fetchPitcherWorldSeriesCareer(1, 2026), u))
  const q = new URL(urls[0], 'https://x.test').searchParams
  assert.equal(q.get('stats'), 'yearByYear')
  assert.equal(q.get('gameType'), 'W')
  assert.ok(!urls.some((u) => u.includes('stats=career')))
})

test('a pitcher with no World Series game is null', async () => {
  assert.equal(await withApi(() => EMPTY, () => fetchPitcherWorldSeriesCareer(1, 2026)), null)
})

test('earlier starts: earlier Series plus this year before the game date, nothing from the game itself', async () => {
  const route = (u) => {
    if (u.includes('byDateRange')) {
      assert.ok(u.includes('gameType=W') && u.includes('endDate=2026-10-23'))
      return yby({ stat: { gamesPlayed: 1, gamesStarted: 1, inningsPitched: '5.0' } })
    }
    return yby(row(2016, 2))
  }
  assert.equal(await withApi(route, () => fetchWorldSeriesStartsBefore(1, '2026-10-24')), 3)
  assert.equal(await withApi(() => EMPTY, () => fetchWorldSeriesStartsBefore(1, '2026-10-24')), 0)
})
