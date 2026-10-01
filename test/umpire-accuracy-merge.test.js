import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mergeAccuracyRows, SUMMARY, writeAccuracyStore } from '../scripts/lib/umpire-accuracy-merge.mjs'

// Regression for a real production incident (2026-08-11): MLB corrected the
// AAA gamePk 814888 Home Plate assignment from "Glenn Ballangao" (832019) to
// "Joe Belangia" (682501) after gen-umpire-accuracy.mjs had already merged
// the game under the wrong id. Without the fix, the stale row stays under
// 832019 forever — he keeps accuracy data for a game he never called, and
// has no gen-umpires.mjs shard (that generator always rebuilds fresh from
// the live schedule), failing test/umpire-shards.test.js's invariant.
test('a reassigned game moves to its new umpire instead of duplicating', () => {
  const prev = {
    832019: {
      id: 832019,
      name: 'Glenn Ballangao',
      games: [{ gamePk: 814888, date: '2026-08-09', level: 'AAA', called: 211 }],
    },
  }
  const rows = [
    {
      gamePk: 814888,
      date: '2026-08-09',
      level: 'AAA',
      gameType: 'R',
      umpId: 682501,
      umpName: 'Joe Belangia',
      acc: { called: 211 },
    },
  ]
  const merged = mergeAccuracyRows(prev, rows)
  assert.equal(merged[832019], undefined, 'old umpire should have no ghost entry left')
  assert.ok(merged[682501], 'new umpire should hold the reassigned game')
  assert.equal(merged[682501].games.length, 1)
  assert.equal(merged[682501].games[0].gamePk, 814888)
})

test('an umpire keeps his other games when only one is reassigned away', () => {
  const prev = {
    832019: {
      id: 832019,
      name: 'Glenn Ballangao',
      games: [
        { gamePk: 814888, date: '2026-08-09', level: 'AAA', called: 211 },
        { gamePk: 800001, date: '2026-08-05', level: 'AAA', called: 200 },
      ],
    },
  }
  const rows = [
    {
      gamePk: 814888,
      date: '2026-08-09',
      level: 'AAA',
      gameType: 'R',
      umpId: 682501,
      umpName: 'Joe Belangia',
      acc: { called: 211 },
    },
  ]
  const merged = mergeAccuracyRows(prev, rows)
  assert.equal(merged[832019].games.length, 1)
  assert.equal(merged[832019].games[0].gamePk, 800001)
})

test('a fresh row for an unseen umpire is just added', () => {
  const rows = [
    {
      gamePk: 900001,
      date: '2026-08-11',
      level: 'MLB',
      gameType: 'R',
      umpId: 555,
      umpName: 'New Ump',
      acc: { called: 150 },
    },
  ]
  const merged = mergeAccuracyRows({}, rows)
  assert.equal(merged[555].games.length, 1)
})

test('a shard\'s games come back newest first regardless of merge order', () => {
  const rows = [
    { gamePk: 1, date: '2026-08-01', level: 'MLB', gameType: 'R', umpId: 555, umpName: 'Ump', acc: {} },
    { gamePk: 2, date: '2026-08-10', level: 'MLB', gameType: 'R', umpId: 555, umpName: 'Ump', acc: {} },
  ]
  const merged = mergeAccuracyRows({}, rows)
  assert.equal(merged[555].games[0].gamePk, 2, 'newest game sorts first')
})

// --- the season store (ADR-0086, #1200) ----------------------------------------
// One folder per season. Before this, the merge base was every shard on file,
// so the first 2027 game was added onto the 2026 totals and the summary was
// relabeled 2027 (#1168's "four stores never roll over").

const row = (season, gamePk, umpId, called, correct) => ({
  season,
  gamePk,
  date: `${season}-04-0${gamePk % 9 || 1}`,
  level: 'MLB',
  gameType: 'R',
  umpId,
  umpName: 'Ada Ump',
  acc: { called, correct, expanded: called - correct, squeezed: 0, high: 0, low: 0, inside: 0, outside: 0 },
})
const readIn = (dir, p) => JSON.parse(readFileSync(join(dir, p), 'utf8'))
const filesUnder = (dir) =>
  Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')]))

test('a 2027 game leaves the 2026 totals alone, and 2027 holds only that game', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ump-acc-'))
  await writeAccuracyStore(dir, [row(2026, 1, 7, 150, 140), row(2026, 2, 7, 160, 150)])
  const before = filesUnder(join(dir, '2026'))

  await writeAccuracyStore(dir, [row(2027, 3, 7, 100, 90)])

  assert.deepEqual(filesUnder(join(dir, '2026')), before, '2026 files changed')
  assert.equal(readIn(dir, `2026/${SUMMARY}`).umpires[7].season.games, 2)
  const s27 = readIn(dir, `2027/${SUMMARY}`)
  assert.equal(s27.season, 2027)
  assert.equal(s27.umpires[7].season.games, 1)
  assert.equal(s27.umpires[7].season.called, 100)
  assert.deepEqual(readIn(dir, '2027/7.json').games.map((g) => g.gamePk), [3])
  const index = readIn(dir, 'seasons.json')
  assert.deepEqual([index.seasons, index.current], [[2026, 2027], 2027])
})

test('a run with no scored game writes nothing, not even the index', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ump-acc-'))
  await writeAccuracyStore(dir, [])
  assert.deepEqual(readdirSync(dir), [])
})

test('all/ sums every season from its rows and never averages two rates', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ump-acc-'))
  // 2026: 90/100 over one game. 2027: 280/300 over two. The mean of the two
  // season rates is 0.9167; the combined rate is 370/400 = 0.925.
  await writeAccuracyStore(dir, [row(2026, 1, 7, 100, 90)])
  await writeAccuracyStore(dir, [row(2027, 2, 7, 150, 140), row(2027, 3, 7, 150, 140)])
  const all = readIn(dir, `all/${SUMMARY}`)
  assert.deepEqual(all.seasons, [2026, 2027])
  const s = all.umpires[7].season
  assert.equal(s.games, 3)
  assert.equal(s.called, 400)
  assert.equal(s.correct, 370)
  assert.equal(s.accuracy, 370 / 400)

  // A second run with the same rows does not rewrite it.
  const stamp = all.generatedAt
  await new Promise((r) => setTimeout(r, 5))
  await writeAccuracyStore(dir, [row(2027, 3, 7, 150, 140)])
  assert.equal(readIn(dir, `all/${SUMMARY}`).generatedAt, stamp)
})
