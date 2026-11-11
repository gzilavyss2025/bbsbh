// The Streak Finder's loader (/streaks): a club's game log comes in 40-season
// date-range blocks, cached per block for the session, and a 404 reads as no games.
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadLogs, toGames } from '../src/api/streaks/streaks.js'

const realFetch = globalThis.fetch
test.afterEach(() => {
  globalThis.fetch = realFetch
})

function stubFetch(answer) {
  const urls = []
  globalThis.fetch = async (url) => {
    urls.push(String(url))
    return answer(String(url))
  }
  return urls
}
const ok = (splits) => ({ ok: true, status: 200, json: async () => ({ stats: [{ splits }] }) })
const split = (season, sb) => ({ season: String(season), date: `${season}-07-01`, stat: { stolenBases: sb }, game: { gamePk: 1, gameNumber: 1 } })
const THIS_YEAR = new Date().getFullYear()
// Answers the seasons inside the request's date range, so a block holds only its own games.
const byRange = (seasons) => (url) => {
  const [, a, b] = url.match(/startDate=(\d+)-01-01&endDate=(\d+)-12-31/)
  return ok(seasons.filter((y) => y >= +a && y <= +b).map((y) => split(y, y % 10)))
}

test('a long history loads in 40-season blocks, one request each per game type', async () => {
  const urls = stubFetch(byRange([1987, 2012]))
  const logs = await loadLogs(9001, 'hitting', 1969, 2012, true)
  assert.equal(urls.length, 4)
  assert.ok(urls.some((u) => /startDate=1950-01-01&endDate=1989-12-31&gameType=R/.test(u)))
  assert.ok(urls.some((u) => /startDate=1990-01-01&endDate=2029-12-31&gameType=P/.test(u)))
  assert.deepEqual(toGames(logs, 'stolenBases').map((g) => [g.season, g.post]).sort(), [[1987, false], [1987, true], [2012, false], [2012, true]])
})

test('a narrower range reuses the cached blocks and keeps only its seasons', async () => {
  const urls = stubFetch(byRange([1971, 1987, 1988]))
  await loadLogs(9002, 'pitching', 1969, 1989, false)
  const logs = await loadLogs(9002, 'pitching', 1987, 1987, false)
  assert.equal(urls.length, 1)
  assert.deepEqual(toGames(logs, 'stolenBases').map((g) => g.season), [1987])
})

test('the block holding the current season goes stale after ten minutes, older blocks never', async (t) => {
  const urls = stubFetch(byRange([2000, THIS_YEAR]))
  const now = Date.now()
  const blockEnd = 1870 + Math.floor((THIS_YEAR - 1870) / 40) * 40 + 39
  const current = () => urls.filter((u) => u.includes(`endDate=${blockEnd}-12-31`)).length
  await loadLogs(9003, 'hitting', 1900, THIS_YEAR, false)
  const first = urls.length
  await loadLogs(9003, 'hitting', 1900, THIS_YEAR, false)
  assert.equal(urls.length, first, 'a stat switch a moment later makes no request')
  t.mock.method(Date, 'now', () => now + 11 * 60_000)
  await loadLogs(9003, 'hitting', 1900, THIS_YEAR, false)
  assert.equal(urls.length, first + 1)
  assert.equal(current(), 2)
})

test('a 404 is a range with no games, not a failure', async () => {
  stubFetch(() => ({ ok: false, status: 404, json: async () => ({}) }))
  assert.deepEqual(toGames(await loadLogs(9004, 'hitting', 1968, 1968, false), 'stolenBases'), [])
})

test('a timeout or server error is not retried here: the page has a Retry button', async () => {
  const urls = stubFetch(() => ({ ok: false, status: 503, json: async () => ({}) }))
  await assert.rejects(loadLogs(9005, 'hitting', 1990, 1991, false))
  assert.equal(urls.length, 1)
})
