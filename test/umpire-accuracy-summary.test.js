import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// public/data/umpire-accuracy.json is the season ARCHIVE (every scored game row,
// ~2 MB by August); umpire-accuracy-summary.json is the same records with the
// `games` arrays dropped (~0.12 MB). The lineup page, the box score, and the
// rankings table read aggregates only, so they read the small one — see
// src/api/umpires.js's loadAccuracySummary().
//
// Two things have to hold for that split to be safe, and both are tested here:
//   1. the two files carry the SAME aggregates (the generator writes them in one
//      run from one object, so a difference means one file went stale), and
//   2. the ranking index reads the same numbers from either source.

const read = (f) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), 'utf8'))

test('the summary file is the archive minus its game rows, nothing else', () => {
  const full = read('umpire-accuracy.json')
  const slim = read('umpire-accuracy-summary.json')

  assert.equal(slim.season, full.season)
  assert.deepEqual(Object.keys(slim.umpires).sort(), Object.keys(full.umpires).sort())

  for (const [id, u] of Object.entries(full.umpires)) {
    const { games, ...aggregates } = u
    assert.ok(Array.isArray(games), `${id}: archive row has no game list`)
    // Byte-for-byte the same aggregates — this is what lets the two sources
    // produce the same rank, tier, and zone baseline.
    assert.deepEqual(slim.umpires[id], aggregates, `${id}: aggregates differ between the two files`)
    assert.equal(slim.umpires[id].games, undefined, `${id}: summary still carries game rows`)
  }
})

test('the summary file is a small fraction of the archive', () => {
  // The whole point of the second file. Not a tight bound — just a floor that
  // fails if someone re-adds the per-game rows and quietly restores the weight
  // the lineup page pays on every visit.
  const size = (f) => readFileSync(new URL(`../public/data/${f}`, import.meta.url)).length
  const ratio = size('umpire-accuracy-summary.json') / size('umpire-accuracy.json')
  assert.ok(ratio < 0.5, `summary is ${(ratio * 100).toFixed(0)}% of the archive`)
})

// --- the index reads the same numbers from either file ------------------------

// One fetch stub per module instance, serving whichever accuracy file the test
// wants to expose. A `?case=` suffix on the import gives each case its own copy
// of the module, because umpires.js memoizes both the file and the index.
function stubFetch({ archive, summary }) {
  globalThis.fetch = async (url) => {
    const body =
      url === '/data/umpire-accuracy.json'
        ? archive
        : url === '/data/umpire-accuracy-summary.json'
          ? summary
          : UMPIRES // umpires.json — the assignment log the detail page opens with
    if (!body) return { ok: false, status: 404 }
    return { ok: true, status: 200, json: async () => body }
  }
}

const UMPIRES = {
  season: 2026,
  generatedAt: '2026-08-09T00:00:00.000Z',
  umpires: { 1: { id: 1, name: 'Ada Ump', games: [] } },
}

// Two umpires past the five-game ranking floor and one below it.
const ump = (id, name, accuracy, games, extra = {}) => ({
  id,
  name,
  season: {
    games,
    called: 1000,
    correct: Math.round(1000 * accuracy),
    expanded: 20,
    squeezed: 10,
    high: 8,
    low: 6,
    inside: 4,
    outside: 12,
    accuracy,
    cellCalled: Array(9).fill(100),
    cellStrikeCall: Array(9).fill(40),
    cellMiss: [5, 4, 3, 2, 1, 2, 3, 4, 5],
    ...extra,
  },
  seasonAAA: null,
  seasonPost: null,
})

const game = (gamePk, favorAway, favorHome) => ({
  gamePk,
  level: 'MLB',
  gameType: 'R',
  favorAway,
  favorHome,
})

const ARCHIVE = {
  season: 2026,
  umpires: {
    // The game rows carry favor, so a lean built from the ARCHIVE reads
    // `source: 'favor'` — a lean built without it could only reach the weaker
    // zone fallback, which is how the last test tells the two apart.
    1: { ...ump(1, 'Ada Ump', 0.94, 20), games: [game(1, 0.3, 0.2)] },
    2: { ...ump(2, 'Bo Ump', 0.91, 12), games: [game(2, -0.1, -0.2)] },
    3: { ...ump(3, 'Cy Ump', 0.99, 2), games: [game(3, 0.0, 0.1)] },
  },
}
const SUMMARY = {
  season: 2026,
  umpires: Object.fromEntries(
    Object.entries(ARCHIVE.umpires).map(([id, { games, ...rest }]) => [id, rest]),
  ),
}

test('rankings and the one-line summary agree, archive or summary file', async () => {
  stubFetch({ archive: ARCHIVE, summary: SUMMARY })
  const slim = await import('../src/api/umpires.js?case=slim')
  const fromSlim = await slim.loadUmpireRankings()
  const slimOne = await slim.umpireAccuracySummary(2)

  // Same module, summary file missing: it falls back to the archive and must
  // reach identical numbers.
  stubFetch({ archive: ARCHIVE, summary: null })
  const full = await import('../src/api/umpires.js?case=full')
  const fromFull = await full.loadUmpireRankings()
  const fullOne = await full.umpireAccuracySummary(2)

  assert.deepEqual(fromSlim, fromFull)
  assert.deepEqual(slimOne, fullOne)

  // …and the ranking itself is right: the sub-floor umpire is out, best first.
  assert.deepEqual(
    fromSlim.ranked.map((r) => [r.id, r.rank]),
    [
      [1, 1],
      [2, 2],
    ],
  )
  assert.equal(slimOne.rank, 2)
  assert.equal(slimOne.total, 2)
})

test('a lineup-page visit first does not cost the detail page its lean', async () => {
  // The pitcher/hitter lean is the one figure that reads GAME ROWS, so an index
  // built from the aggregates alone cannot carry it. The memo has to know that
  // and rebuild from the archive, or whichever surface loaded first would
  // decide whether the Tendencies card has a lean at all.
  stubFetch({ archive: ARCHIVE, summary: SUMMARY })
  const mod = await import('../src/api/umpires.js?case=lean')
  await mod.loadUmpireRankings() // builds the aggregates-only index first
  const u = await mod.loadUmpire(1) // …and this one needs the lean
  assert.ok(u, 'umpire detail should load')
  // 'favor' = built from the game rows. A cached aggregates-only index would
  // leave this null (or, unguarded, fall back to the weaker zone figure).
  assert.equal(u.lean.source, 'favor')
})
