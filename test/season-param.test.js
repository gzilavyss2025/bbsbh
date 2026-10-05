// One season parameter (#1201). Every reader of a season store takes
// `{ seasonYear }`: a year, 'all', or nothing for the store's current season.
// A fake /data tree with two seasons on file (2026 and 2027) stands in for
// public/data, and each test checks the URLs a reader asks for.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'

const index = { seasons: [2026, 2027], current: 2027 }
const FILES = {
  '/data/spray/seasons.json': index,
  '/data/spray/2026/01.json': { season: 2026, bat: { 101: { n: 'Two Seasons', t: 158, b: 'R', p: [[1, 2, 90, 0, 0, 0, 0, 5]], o: { R: [3, 1, 0, 0, 1] } } } },
  '/data/spray/2027/01.json': { season: 2027, bat: { 101: { n: 'Two Seasons', t: 158, b: 'R', p: [[3, 4, 95, 4, 1, 0, 0, 6]], o: { R: [2, 1, 1, 1, 2], L: [1, 0, 0, 0, 0] } } } },
  '/data/spray/2027/02.json': { season: 2027, bat: { 202: { n: 'Rookie', t: 121, b: 'L', p: [], o: { R: [1, 0, 0, 0, 0] } } } },
  '/data/fouls/seasons.json': index,
  '/data/fouls/2026/fouls.json': { season: 2026 },
  '/data/fouls/2027/fouls.json': { season: 2027 },
  '/data/fouls/2026/03.json': { season: 2026, batters: { 303: { name: 'F', teamId: 158, g: 10, fouls: 20, maxGameFouls: 5, maxGamePk: 1 } }, pitchers: {} },
  '/data/fouls/2027/03.json': { season: 2027, batters: { 303: { name: 'F', teamId: 158, g: 4, fouls: 9, maxGameFouls: 6, maxGamePk: 2 } }, pitchers: {} },
  '/data/pitch-arsenal/seasons.json': index,
  '/data/pitch-arsenal/2026/04.json': { season: 2026, pit: { 404: { name: 'A', throws: 'L', mlb: [{ code: 'FF', pitches: 30, avgVelo: 90 }], aaa: [] } }, post: {} },
  '/data/pitch-arsenal/2027/04.json': { season: 2027, pit: { 404: { name: 'A', throws: 'L', mlb: [{ code: 'FF', pitches: 10, avgVelo: 94 }], aaa: [] } }, post: {} },
  '/data/pitch-arsenal-pool/seasons.json': index,
  '/data/pitch-arsenal-pool/all/mlb.json': { seasons: [2026, 2027], level: 'mlb' },
  '/data/pitch-command/seasons.json': index,
  '/data/umpires/seasons.json': index,
  '/data/umpires/2026/9.json': { season: 2026, id: 9, name: 'Ump', generatedAt: 'a', games: [{ gamePk: 1, date: '2026-05-01' }] },
  '/data/umpires/2027/9.json': { season: 2027, id: 9, name: 'Ump', generatedAt: 'b', games: [{ gamePk: 2, date: '2027-04-01' }] },
  '/data/umpire-accuracy/seasons.json': index,
  '/data/umpire-accuracy/2026/umpire-accuracy-summary.json': { season: 2026, umpires: {} },
  '/data/umpire-accuracy/all/umpire-accuracy-summary.json': { seasons: [2026, 2027], umpires: {} },
  '/data/abs/seasons.json': index,
  '/data/abs/2026/abs-exposure-clubs-mlb.json': { season: 2026, levels: {} },
}

const fetched = []
before(() => {
  mock.method(globalThis, 'fetch', async (url) => {
    fetched.push(String(url))
    const body = FILES[url]
    return body === undefined ? { ok: false, status: 404 } : { ok: true, status: 200, json: async () => body }
  })
})
after(() => mock.restoreAll())

// The data files a call asked for, without the seasons.json reads.
async function urlsOf(call) {
  fetched.length = 0
  const value = await call()
  return { value, urls: fetched.filter((u) => !u.endsWith('/seasons.json')) }
}

test('seasonFolderOf: nothing is current, a year must be on file, all is all', async () => {
  const { seasonFolderOf } = await import('../src/api/staticJson.js')
  assert.equal(await seasonFolderOf('spray'), 2027)
  assert.equal(await seasonFolderOf('spray', 2026), 2026)
  assert.equal(await seasonFolderOf('spray', '2026'), 2026) // a feed's season is a string
  assert.equal(await seasonFolderOf('spray', 1850), null)
  assert.equal(await seasonFolderOf('spray', 'all'), 'all')
})

test('a reader with a year reads that folder; with no year, the current one', async () => {
  const { fetchSprayFor } = await import('../src/api/spray.js')
  assert.deepEqual((await urlsOf(() => fetchSprayFor(101, { seasonYear: 2026 }))).urls, ['/data/spray/2026/01.json'])
  assert.deepEqual((await urlsOf(() => fetchSprayFor(202))).urls, ['/data/spray/2027/02.json'])
})

test('a year not on file reads nothing and resolves to the fallback', async () => {
  const { fetchFoulsFor, fetchFouls } = await import('../src/api/fouls.js')
  const one = await urlsOf(() => fetchFoulsFor(303, { seasonYear: 2025 }))
  assert.equal(one.value, null)
  assert.deepEqual(one.urls, [])
  const board = await urlsOf(() => fetchFouls({ seasonYear: 2025 }))
  assert.equal(board.value, null)
  assert.deepEqual(board.urls, [])
})

test("a leader board's 'all' reads the all/ file, and a missing one is the fallback", async () => {
  const { fetchFouls } = await import('../src/api/fouls.js')
  const { value, urls } = await urlsOf(() => fetchFouls({ seasonYear: 'all' }))
  // fouls/all/ is not on disk until the first nightly run after #1200.
  assert.deepEqual(urls, ['/data/fouls/all/fouls.json'])
  assert.equal(value, null)
  assert.equal((await fetchFouls({ seasonYear: 2026 })).season, 2026)

  const { fetchPitchArsenalPool } = await import('../src/api/pitchArsenal.js')
  const pool = await urlsOf(() => fetchPitchArsenalPool(true, { seasonYear: 'all' }))
  assert.deepEqual(pool.urls, ['/data/pitch-arsenal-pool/all/mlb.json'])
  assert.deepEqual(pool.value.seasons, [2026, 2027])
})

test("one player's 'all' reads every season's shard and adds them", async () => {
  const { fetchSprayFor, sprayView } = await import('../src/api/spray.js')
  const spray = await urlsOf(() => fetchSprayFor(101, { seasonYear: 'all' }))
  assert.deepEqual(spray.urls, ['/data/spray/2027/01.json']) // 2026's shard was read in an earlier test, and is memoized
  assert.deepEqual(spray.value.seasons, [2026, 2027])
  assert.equal(spray.value.season, null)
  assert.deepEqual(spray.value.bat[101].o.R, [5, 2, 1, 1, 3])
  assert.equal(spray.value.bat[101].p.length, 2)
  // The combined shard is in the shape the card's own view model reads.
  assert.equal(sprayView(spray.value, 101), null) // under MIN_SPRAY_BIP, read the normal way

  const { fetchFoulsFor, batterFoulLine } = await import('../src/api/fouls.js')
  const fouls = await fetchFoulsFor(303, { seasonYear: 'all' })
  assert.equal(fouls.batters[303].g, 14)
  assert.equal(fouls.batters[303].fouls, 29)
  assert.equal(fouls.batters[303].maxGamePk, 2)
  assert.equal(batterFoulLine(fouls, 303).maxGameFouls, 6) // the card's own line reads the sum

  const { fetchPitchArsenalFor } = await import('../src/api/pitchArsenal.js')
  const arsenal = await fetchPitchArsenalFor(404, { seasonYear: 'all' })
  assert.equal(arsenal.pit[404].mlb[0].pitches, 40)
  assert.equal(arsenal.pit[404].mlb[0].avgVelo, 91) // (30 × 90 + 10 × 94) / 40
})

test("a rookie's 'all' is his one season, not a zero beside a gap", async () => {
  const { fetchSprayFor } = await import('../src/api/spray.js')
  const { value } = await urlsOf(() => fetchSprayFor(202, { seasonYear: 'all' }))
  assert.deepEqual(value.bat[202].o, { R: [1, 0, 0, 0, 0] })
  assert.equal((await fetchSprayFor(999, { seasonYear: 'all' })), null) // in no season at all
})

test("an umpire's 'all' joins his seasons' games; a year reads that year's summary", async () => {
  const { loadUmpire, umpireAccuracySummary } = await import('../src/api/umpires.js')
  const { value, urls } = await urlsOf(() => loadUmpire(9, { seasonYear: 'all' }))
  assert.ok(urls.includes('/data/umpires/2026/9.json') && urls.includes('/data/umpires/2027/9.json'))
  assert.ok(urls.includes('/data/umpire-accuracy/all/umpire-accuracy-summary.json'))
  assert.deepEqual(value.games.map((g) => g.gamePk), [2, 1])
  assert.equal(value.season, null)
  assert.deepEqual(value.seasons, [2026, 2027])

  const one = await urlsOf(() => umpireAccuracySummary(9, { seasonYear: 2026 }))
  assert.deepEqual(one.urls, ['/data/umpire-accuracy/2026/umpire-accuracy-summary.json'])
  assert.equal(one.value, null) // no row for him in that summary
})

test("the command map takes one season: 'all' is null, with no fetch", async () => {
  const { fetchCommandFor } = await import('../src/api/commandMap.js')
  const { value, urls } = await urlsOf(() => fetchCommandFor(404, { seasonYear: 'all' }))
  assert.equal(value, null)
  assert.deepEqual(urls, [])
})

test('the ABS club file takes the season too', async () => {
  const { fetchAbsExposureClubs } = await import('../src/api/around-the-game/absExposure.js')
  const { value, urls } = await urlsOf(() => fetchAbsExposureClubs('MLB', { seasonYear: 2026 }))
  assert.deepEqual(urls, ['/data/abs/2026/abs-exposure-clubs-mlb.json'])
  assert.equal(value.season, 2026)
})
