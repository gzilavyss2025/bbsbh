// The D1 slate masthead's two pure halves: the per-level game count read
// (src/api/slate/levelCounts.js) and the ladder model the masthead draws from
// it (src/lib/slate/ladder.js). The count read is pinned to ask statsapi for
// ids alone — a game count is not a score, and the request must never carry one.
import assert from 'node:assert/strict'
import test from 'node:test'
import { countGamesBySport, fetchLevelCounts } from '../src/api/slate/levelCounts.js'
import { ladderStops, countText, dateLines } from '../src/lib/slate/ladder.js'
import { LEVELS, SPORT_IDS } from '../src/lib/teams.js'

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const game = (sport) => ({ gamePk: Math.random(), teams: { away: { team: { id: 1, sport: { id: sport } } } } })

test('countGamesBySport counts games per level, doubleheaders included', () => {
  const raw = { dates: [{ games: [game(1), game(1), game(11), game(14)] }] }
  assert.deepEqual(countGamesBySport(raw), { 1: 2, 11: 1, 12: 0, 13: 0, 14: 1 })
})

test('countGamesBySport answers zeros for an empty day', () => {
  assert.deepEqual(countGamesBySport({ dates: [] }), { 1: 0, 11: 0, 12: 0, 13: 0, 14: 0 })
})

test('fetchLevelCounts asks for every level in one call, pruned to ids', async (t) => {
  const urls = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    urls.push(url)
    return response({ dates: [{ games: [game(1), game(12)] }] })
  })
  const counts = await fetchLevelCounts('2026-07-22')
  assert.equal(urls.length, 1)
  assert.match(urls[0], /sportId=1,11,12,13,14/)
  assert.match(urls[0], /date=2026-07-22/)
  assert.match(urls[0], /fields=dates,games,gamePk,teams,away,team,sport,id/)
  assert.doesNotMatch(urls[0], /score|linescore|isWinner/)
  assert.equal(counts[1], 1)
  assert.equal(counts[12], 1)
})

test('fetchLevelCounts degrades to {} on a failed read', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response({ error: 'boom' }, 500))
  assert.deepEqual(await fetchLevelCounts('2026-07-22'), {})
})

test('countText: blank while loading, a dash for none or a missing feed', () => {
  assert.equal(countText(null, 1), '')
  assert.equal(countText({ 1: 15 }, 1), '15')
  assert.equal(countText({ 1: 0 }, 1), '—')
  assert.equal(countText({}, 11), '—')
})

test('ladderStops: the five levels in rail order, Winter last when it has games', () => {
  const winter = { label: 'WINTER', sportId: 17, leagueId: 131 }
  const levels = [LEVELS[0], winter, ...LEVELS.slice(1)]
  const counts = { 1: 15, 11: 0, 12: 0, 13: 0, 14: 0 }
  const stops = ladderStops({ levels, counts, sportId: SPORT_IDS.AAA, winterGames: 4 })
  assert.deepEqual(stops.map((s) => s.label), ['MLB', 'AAA', 'AA', 'A+', 'A', 'Winter'])
  assert.equal(stops.find((s) => s.picked).label, 'AAA')
  assert.equal(stops[5].winter, true)
  assert.equal(stops[5].leagueId, 131)
  assert.equal(stops[5].count, '4')
  assert.equal(stops[0].aria, 'Major League, 15 games')
  assert.equal(stops[3].aria, 'High-A, no games')
  assert.equal(stops[1].empty, true)
  assert.equal(stops[0].empty, false)
})

test('ladderStops: one game reads singular, unknown counts stay out of the label', () => {
  const stops = ladderStops({ levels: LEVELS, counts: { 1: 1 }, sportId: 1 })
  assert.equal(stops.length, 5)
  assert.equal(stops[0].aria, 'Major League, 1 game')
  assert.equal(ladderStops({ levels: LEVELS, counts: null, sportId: 1 })[0].aria, 'Major League')
})

test('dateLines reads the weekday and month off the date itself', () => {
  assert.deepEqual(dateLines('2026-07-20'), { dow: 'Monday', md: 'Jul 20', short: 'Mon Jul 20' })
  assert.equal(dateLines('2026-10-18').dow, 'Sunday')
})
