// The umpire-assignment backfill (#1202): assignments are on file from 2023,
// pitch-call accuracy only from 2026. A season view of an older year must show
// that year's games and NO accuracy. If staticJson.js's seasonFolderOf sent a
// year before the store's first to the current season, a 2024 umpire page
// would print 2026's accuracy, rank and zone map beside 2024's games.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'

const SUMMARY_2026 = {
  season: 2026,
  umpires: { 9: { id: 9, name: 'Ump', season: { called: 100, accuracy: 0.95, games: 20 } } },
}
const FILES = {
  '/data/umpires/seasons.json': { seasons: [2024, 2026], current: 2026 },
  '/data/umpires/2024/9.json': { season: 2024, id: 9, name: 'Ump', games: [{ gamePk: 1, date: '2024-05-01', role: 'HP' }] },
  '/data/umpires/2026/9.json': { season: 2026, id: 9, name: 'Ump', games: [{ gamePk: 2, date: '2026-05-01', role: 'HP' }] },
  '/data/umpire-accuracy/seasons.json': { seasons: [2026], current: 2026 },
  '/data/umpire-accuracy/2026/umpire-accuracy-summary.json': SUMMARY_2026,
  '/data/umpire-accuracy/2026/9.json': { games: [] },
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

test('a backfilled season shows its games and no accuracy at all', async () => {
  const { loadUmpire } = await import('../src/api/umpires.js')
  fetched.length = 0
  const u = await loadUmpire(9, { seasonYear: 2024 })
  assert.deepEqual(u.games.map((g) => g.gamePk), [1])
  assert.equal(u.accuracy, null)
  assert.equal(u.rank, null)
  assert.equal(u.zoneCells, null)
  assert.equal(u.lean, null)
  // Not a 2026 file is read for a 2024 page.
  assert.deepEqual(fetched.filter((f) => f.includes('/umpire-accuracy/2026/')), [])
})

test('a year after the last on file is still the current season (a spring game page)', async () => {
  const { loadUmpire } = await import('../src/api/umpires.js')
  const u = await loadUmpire(9, { seasonYear: 2027 })
  assert.deepEqual(u.games.map((g) => g.gamePk), [2])
  assert.equal(u.accuracy.season.accuracy, 0.95)
})

test('the current season keeps its accuracy', async () => {
  const { loadUmpire, umpireAccuracySummary } = await import('../src/api/umpires.js')
  assert.equal((await loadUmpire(9, { seasonYear: 2026 })).accuracy.season.accuracy, 0.95)
  assert.equal((await loadUmpire(9)).accuracy.season.accuracy, 0.95)
  // The lineup page's one-line fact follows the same rule.
  assert.equal(await umpireAccuracySummary(9, { seasonYear: 2024 }), null)
  assert.equal((await umpireAccuracySummary(9, { seasonYear: 2026 })).accuracy, 0.95)
})

test('the umpire says which seasons his accuracy covers', async () => {
  const { loadUmpire } = await import('../src/api/umpires.js')
  assert.deepEqual((await loadUmpire(9, { seasonYear: 2026 })).accuracySeasons, [2026])
  assert.deepEqual((await loadUmpire(9, { seasonYear: 2024 })).accuracySeasons, [])
})
