// Unit coverage for the prospect-rank-history generator's pure half
// (scripts/lib/prospect-rank-history.mjs) and for the file it ships
// (public/data/prospect-rank-history.json, issue #1111).
//
// Three promises are pinned here, each one Gary asked for by name:
//   1. The file is the same bytes on every run (no clock inside it).
//   2. Every row keeps its source, and the two sources stay apart.
//   3. Dropping Baseball America removes exactly its four seasons and its
//      credits, and nothing else.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildProspectRankHistory } from '../scripts/lib/prospect-rank-history.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const scratch = join(root, '.scratch', 'top-prospects-history')
const shippedPath = join(root, 'public', 'data', 'prospect-rank-history.json')

const BA = 'baseball-america'
const MLB = 'mlb-pipeline'
const BOTH = [BA, MLB]

const seasons = [
  { season: 2007, status: 'ok', depth: 100 },
  { season: 2008, status: 'ok', depth: 100 },
  { season: 2009, status: 'ok', depth: 50 },
  { season: 2010, status: 'ok', depth: 50 },
]
const rows = [
  { season: 2008, rank: 46, mlbId: 519105, source: BA },
  { season: 2007, rank: 3, mlbId: 111, source: BA },
  { season: 2009, rank: 18, mlbId: 519105, source: MLB },
  { season: 2010, rank: 21, mlbId: 519105, source: MLB },
  { season: 2010, rank: 1, mlbId: 222, source: MLB },
]

const build = (over = {}) => buildProspectRankHistory({ rows, seasons, includeSources: BOTH, ...over })

// ---- the shape --------------------------------------------------------------

test('players are keyed by id, each row is [season, rank, source] in season order', () => {
  const out = build()
  assert.deepEqual(out.players[519105], [
    [2008, 46, BA],
    [2009, 18, MLB],
    [2010, 21, MLB],
  ])
  assert.deepEqual(out.players[222], [[2010, 1, MLB]])
})

test('every row keeps its own source, so a player who crosses sources keeps both', () => {
  const sources = new Set(build().players[519105].map((row) => row[2]))
  assert.deepEqual([...sources].sort(), [BA, MLB])
})

test('the file records how deep each season list ran', () => {
  const out = build()
  assert.equal(out.depths[2008], 100)
  assert.equal(out.depths[2009], 50)
})

test('the sources table names each source, its seasons and its credit lines', () => {
  const { sources } = build()
  assert.deepEqual(sources[BA].seasons, [2007, 2008])
  assert.deepEqual(sources[MLB].seasons, [2009, 2010])
  assert.equal(sources[BA].label, 'Baseball America')
  assert.equal(sources[MLB].label, 'MLB Pipeline')
  assert.ok(sources[MLB].credit.length >= 1)
})

test('the Baseball America credit also credits the Chadwick register for the id join', () => {
  const credit = build().sources[BA].credit.join(' ')
  assert.match(credit, /Baseball America/)
  assert.match(credit, /Chadwick/)
  assert.match(credit, /Attribution License 1\.0/)
})

test('the MLB Pipeline credit does not claim the Chadwick join', () => {
  assert.doesNotMatch(build().sources[MLB].credit.join(' '), /Chadwick/)
})

// ---- byte-identical output --------------------------------------------------

test('the file carries no clock: two builds are the same bytes', () => {
  const a = JSON.stringify(build())
  const b = JSON.stringify(build())
  assert.equal(a, b)
  assert.doesNotMatch(a, /generatedAt|fetchedAt/)
})

test('input order does not change the output bytes', () => {
  const a = JSON.stringify(build())
  const b = JSON.stringify(build({ rows: [...rows].reverse(), seasons: [...seasons].reverse() }))
  assert.equal(a, b)
})

// ---- dropping Baseball America ----------------------------------------------

test('dropping baseball-america removes exactly its rows and its credit', () => {
  const both = build()
  const mlbOnly = build({ includeSources: [MLB] })
  assert.equal(mlbOnly.sources[BA], undefined)
  assert.deepEqual(Object.keys(mlbOnly.depths).map(Number), [2009, 2010])
  assert.deepEqual(mlbOnly.players[519105], [
    [2009, 18, MLB],
    [2010, 21, MLB],
  ])
  // A player whose only rows were Baseball America is gone entirely.
  assert.equal(mlbOnly.players[111], undefined)
  // The MLB Pipeline rows, credit and depths are untouched.
  assert.deepEqual(mlbOnly.sources[MLB], both.sources[MLB])
  for (const id of [222]) assert.deepEqual(mlbOnly.players[id], both.players[id])
  assert.doesNotMatch(JSON.stringify(mlbOnly), /Baseball America|Chadwick|baseball-america/)
})

// ---- fail loud ---------------------------------------------------------------

test('a row from a source with no credit is refused, never shipped uncredited', () => {
  assert.throws(
    () => buildProspectRankHistory({ rows: [{ season: 2009, rank: 1, mlbId: 1, source: 'mystery' }], seasons, includeSources: ['mystery'] }),
    /credit/i,
  )
})

test('a duplicate season for one player is refused', () => {
  const dup = [...rows, { season: 2009, rank: 30, mlbId: 519105, source: MLB }]
  assert.throws(() => build({ rows: dup }), /duplicate/i)
})

test('a rank deeper than the season list is refused', () => {
  const deep = [...rows, { season: 2009, rank: 51, mlbId: 9, source: MLB }]
  assert.throws(() => build({ rows: deep }), /depth|rank/i)
})

test('a row in a season the pull metadata does not list is refused', () => {
  const stray = [...rows, { season: 1999, rank: 1, mlbId: 9, source: MLB }]
  assert.throws(() => build({ rows: stray }), /season/i)
})

// ---- the real data ------------------------------------------------------------

const realRows = JSON.parse(readFileSync(join(scratch, 'rows.json'), 'utf8'))
const realSeasons = JSON.parse(readFileSync(join(scratch, 'seasons.json'), 'utf8'))

test('the shipped file is exactly what the generator builds from the research pull', () => {
  const expected = JSON.stringify(
    buildProspectRankHistory({ rows: realRows, seasons: realSeasons, includeSources: BOTH }),
  )
  assert.equal(readFileSync(shippedPath, 'utf8'), expected)
})

test('the shipped file covers all 1,823 rows across 982 players', () => {
  const shipped = JSON.parse(readFileSync(shippedPath, 'utf8'))
  const players = Object.values(shipped.players)
  assert.equal(players.length, 982)
  assert.equal(players.reduce((n, list) => n + list.length, 0), 1823)
  assert.deepEqual(shipped.sources[BA].seasons, [2005, 2008])
  assert.deepEqual(shipped.sources[MLB].seasons, [2009, 2024])
})

test('the shipped file keeps the two sources apart and the join credit with the older one', () => {
  const shipped = JSON.parse(readFileSync(shippedPath, 'utf8'))
  for (const list of Object.values(shipped.players)) {
    for (const [season, , source] of list) {
      assert.equal(source, season <= 2008 ? BA : MLB)
    }
  }
  assert.match(shipped.sources[BA].credit.join(' '), /Chadwick/)
  assert.doesNotMatch(shipped.sources[MLB].credit.join(' '), /Chadwick/)
})

test('the shipped file stays small enough for the one page that opens it', () => {
  assert.ok(readFileSync(shippedPath).length < 120_000)
})

test('running the generator twice writes identical bytes, equal to the shipped file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rank-history-'))
  try {
    const one = join(dir, 'one.json')
    const two = join(dir, 'two.json')
    const script = join(root, 'scripts', 'gen-prospect-rank-history.mjs')
    execFileSync(process.execPath, [script, '--out', one], { stdio: 'ignore' })
    execFileSync(process.execPath, [script, '--out', two], { stdio: 'ignore' })
    const a = readFileSync(one)
    assert.ok(a.equals(readFileSync(two)))
    assert.ok(a.equals(readFileSync(shippedPath)))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
