// A season view's picked year that one store lacks gives no figures (#1482).
// The umpires store has 2026 and 2027; the accuracy and spray stores stop at
// 2026. `strict` is what a season view passes; a game page passes nothing and
// keeps the spring fallback (ADR-0086).
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'

const both = { seasons: [2026, 2027], current: 2027 }
const old = { seasons: [2026], current: 2026 }
const FILES = {
  '/data/umpires/seasons.json': both,
  '/data/umpires/2026/9.json': { season: 2026, id: 9, name: 'Ump', generatedAt: 'a', games: [{ gamePk: 1, role: 'HP' }] },
  '/data/umpires/2027/9.json': { season: 2027, id: 9, name: 'Ump', generatedAt: 'b', games: [{ gamePk: 2, role: 'HP' }] },
  '/data/umpire-accuracy/seasons.json': old,
  '/data/umpire-accuracy/2026/umpire-accuracy-summary.json': {
    season: 2026,
    umpires: { 9: { id: 9, name: 'Ump', season: { called: 100, accuracy: 0.93, games: 5 } } },
  },
  '/data/fouls/seasons.json': old,
  '/data/fouls/2026/03.json': { season: 2026, batters: {}, pitchers: {} },
  '/data/pitch-arsenal/seasons.json': old,
  '/data/pitch-arsenal/2026/04.json': { season: 2026, pit: {}, post: {} },
  '/data/spray/seasons.json': old,
  '/data/spray/2026/01.json': { season: 2026, bat: { 101: { n: 'B', t: 158, b: 'R', p: [[1, 2, 90, 0, 0, 0, 0, 5]], o: {} } } },
}

before(() => {
  mock.method(globalThis, 'fetch', async (url) => {
    const body = FILES[String(url)]
    return body === undefined ? { ok: false, status: 404 } : { ok: true, status: 200, json: async () => body }
  })
})
after(() => mock.restoreAll())

test('seasonFolderOf: strict gives a year after the last nothing; default keeps the spring fallback', async () => {
  const { seasonFolderOf } = await import('../src/api/staticJson.js')
  assert.equal(await seasonFolderOf('spray', 2027), 2026) // default: the current season
  assert.equal(await seasonFolderOf('spray', 2027, { strict: true }), null)
  assert.equal(await seasonFolderOf('spray', 2026, { strict: true }), 2026) // on file: unchanged
  assert.equal(await seasonFolderOf('spray', undefined, { strict: true }), 2026) // no pick: current
  assert.equal(await seasonFolderOf('spray', 'all', { strict: true }), 'all')
})

test('readers: a strict year the store lacks reads no file and gives no figures', async () => {
  const { fetchSprayFor } = await import('../src/api/spray.js')
  assert.equal((await fetchSprayFor(101, { seasonYear: 2027 })).season, 2026) // game page
  assert.equal(await fetchSprayFor(101, { seasonYear: 2027, strict: true }), null)
  assert.equal((await fetchSprayFor(101, { seasonYear: 2026, strict: true })).season, 2026)
  const { fetchFoulsFor } = await import('../src/api/fouls.js')
  const { fetchPitchArsenalFor } = await import('../src/api/pitchArsenal.js')
  assert.equal((await fetchFoulsFor(303, { seasonYear: 2027 })).season, 2026)
  assert.equal(await fetchFoulsFor(303, { seasonYear: 2027, strict: true }), null)
  assert.equal((await fetchPitchArsenalFor(404, { seasonYear: 2027 })).season, 2026)
  assert.equal(await fetchPitchArsenalFor(404, { seasonYear: 2027, strict: true }), null)
})

test('loadUmpire: a season the accuracy store lacks has games and no accuracy, never another season', async () => {
  const { loadUmpire } = await import('../src/api/umpires.js')
  const now = await loadUmpire(9, { seasonYear: 2027, strict: true })
  assert.equal(now.games.length, 1)
  assert.equal(now.games[0].gamePk, 2)
  assert.equal(now.accuracy, null)
  assert.equal(now.rank, null)
  const then = await loadUmpire(9, { seasonYear: 2026, strict: true })
  assert.equal(then.accuracy.season.accuracy, 0.93)
  // The game pages (no strict) still read 2026 accuracy beside a 2027 game.
  assert.equal((await loadUmpire(9, { seasonYear: 2027 })).accuracy.season.accuracy, 0.93)
})
