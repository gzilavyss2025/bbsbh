import test from 'node:test'
import assert from 'node:assert/strict'
import { packUmpireGames, unpackUmpireGames } from '../src/lib/umpire/rows.js'

const row = (o) => ({
  gamePk: 1, date: '2026-05-01', awayId: 158, awayAbbr: 'MIL', homeId: 112, homeAbbr: 'CHC',
  venueId: 17, venueName: 'Wrigley Field', awayScore: 3, homeScore: 5,
  awayIsWinner: false, homeIsWinner: true, role: 'HP', ...o,
})
const roundTrip = (games) => unpackUmpireGames(packUmpireGames(games))

test('pack moves abbreviations, venue and winner flags out of the row and back, losslessly', () => {
  const games = [row({}), row({ gamePk: 2, awayScore: 6, awayIsWinner: true, homeIsWinner: false })]
  const packed = packUmpireGames(games)
  assert.deepEqual(packed.teams, { 158: 'MIL', 112: 'CHC' })
  assert.deepEqual(packed.venues, { 17: 'Wrigley Field' })
  for (const g of packed.games) {
    assert.ok(!('awayAbbr' in g) && !('venueName' in g) && !('awayIsWinner' in g))
  }
  assert.deepEqual(unpackUmpireGames(packed), games)
})

test('a tie keeps its null flags: the scores cannot say it was suspended, not lost', () => {
  const games = [row({ awayScore: 4, homeScore: 4, awayIsWinner: null, homeIsWinner: null })]
  assert.deepEqual(roundTrip(games), games)
  const flags = [row({ awayScore: 4, homeScore: 4, awayIsWinner: false, homeIsWinner: false })]
  assert.deepEqual(roundTrip(flags), flags)
})

test('a missing id or a club whose abbreviation changed stays on its row', () => {
  const games = [row({ awayId: null, awayAbbr: '' }), row({ gamePk: 2, homeAbbr: 'CHW' })]
  assert.deepEqual(roundTrip(games), games)
})

test('a shard written before the pack passes through unchanged', () => {
  const games = [row({})]
  assert.deepEqual(unpackUmpireGames({ games }), games)
  assert.deepEqual(unpackUmpireGames(null), [])
})

// The pack must come back out on EVERY read path. A single season goes through
// readSeasonShard's readOne alone; only 'all' runs the combine callback.
test('loadUmpire unpacks a packed shard for the current season, a year and all (#2288)', async (t) => {
  const index = { seasons: [2026, 2027], current: 2027 }
  const packed = (season, pk) => ({
    season, id: 9, name: 'Ump', generatedAt: 'a',
    ...packUmpireGames([row({ gamePk: pk, date: `${season}-05-01` })]),
  })
  const FILES = {
    '/data/umpires/seasons.json': index,
    '/data/umpires/2026/9.json': packed(2026, 1),
    '/data/umpires/2027/9.json': packed(2027, 2),
    '/data/umpire-accuracy/seasons.json': index,
    '/data/umpire-accuracy/2026/umpire-accuracy-summary.json': { season: 2026, umpires: {} },
    '/data/umpire-accuracy/2027/umpire-accuracy-summary.json': { season: 2027, umpires: {} },
    '/data/umpire-accuracy/all/umpire-accuracy-summary.json': { seasons: [2026, 2027], umpires: {} },
  }
  t.mock.method(globalThis, 'fetch', async (url) => {
    const body = FILES[url]
    return body === undefined ? { ok: false, status: 404 } : { ok: true, status: 200, json: async () => body }
  })
  const { loadUmpire } = await import('../src/api/umpires.js')
  for (const seasonYear of [undefined, 2026, 'all']) {
    const u = await loadUmpire(9, { seasonYear })
    assert.ok(u.games.length, `${seasonYear}: no games`)
    for (const g of u.games) {
      assert.equal(g.awayAbbr, 'MIL', `${seasonYear}: awayAbbr`)
      assert.equal(g.venueName, 'Wrigley Field', `${seasonYear}: venueName`)
      assert.equal(g.homeIsWinner, true, `${seasonYear}: homeIsWinner`)
    }
    assert.ok(!('teams' in u) && !('venues' in u), `${seasonYear}: pack tables leaked into the page data`)
  }
})

test('a null abbreviation or venue stays null through the pack (#2288)', () => {
  const games = [row({}), row({ gamePk: 2, awayAbbr: null, venueName: null })]
  assert.deepEqual(roundTrip(games), games)
})
