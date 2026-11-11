// The Streak Finder's loader (/streaks): one date-range game-log request per log and
// game type covers every season, cached for the session, and a 404 reads as no games.
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadLogs, toGames } from '../src/api/streaks/streaks.js'

function stubFetch(answer) {
  const urls = []
  globalThis.fetch = async (url) => {
    urls.push(String(url))
    return answer(String(url))
  }
  return urls
}
const ok = (splits) => ({ ok: true, status: 200, json: async () => ({ stats: [{ splits }] }) })
const split = (season, date, sb) => ({ season: String(season), date, stat: { stolenBases: sb }, game: { gamePk: 1, gameNumber: 1 } })

test('one request per game type covers the whole season range', async () => {
  const urls = stubFetch(() => ok([split(1987, '1987-07-26', 5), split(2012, '2012-09-15', 3)]))
  const logs = await loadLogs(9001, 'hitting', 1969, 2026, true)
  assert.equal(urls.length, 2)
  assert.match(urls[0], /startDate=1969-01-01&endDate=2026-12-31&gameType=R/)
  assert.match(urls[1], /gameType=P/)
  assert.deepEqual(toGames(logs, 'stolenBases').map((g) => [g.season, g.post, g.value]), [[1987, false, 5], [2012, false, 3], [1987, true, 5], [2012, true, 3]])
})

test('a second load of the same log reads the cache', async () => {
  const urls = stubFetch(() => ok([]))
  await loadLogs(9002, 'pitching', 2000, 2001, false)
  await loadLogs(9002, 'pitching', 2000, 2001, false)
  assert.equal(urls.length, 1)
})

test('a 404 is a range with no games, not a failure', async () => {
  stubFetch(() => ({ ok: false, status: 404, json: async () => ({}) }))
  assert.deepEqual(await loadLogs(9003, 'hitting', 1968, 1968, false), [{ splits: [], post: false }])
})
