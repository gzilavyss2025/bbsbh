// The historical-contract rowKey: what it names, what it must not lose, and
// the join between the generator that writes a bucket and the reader that
// recomputes that bucket's name.
//
// WHY THIS FILE EXISTS. A rowKey used to be a row's POSITION in its source CSV,
// so `salaries#24340` meant "row 24340" and nothing more. Twenty-three rows
// were once removed from salaries.csv. The row counts reconciled, lint exited
// 0, and 3,447 unit tests passed — while every 2000–2004 salary row, 3,014 of
// them, pointed at the wrong person, and the ADR-0067 corrections a human had
// saved in Redis pointed at strangers. Nothing in the suite compared the
// crosswalk's row count to the CSV's. An adversarial review caught it.
//
// So the first test below is the one that was missing, and it is asserted
// rather than merely true: the crosswalk holds exactly one row per source row,
// and every key in it is the key that row's own content mints.
//
// These run against the REAL CSVs in scripts/data/contracts/ and the REAL
// generated files in public/data/contracts-history/, never a fixture. A fixture
// would prove the key function self-consistent and would have proved nothing
// about the incident.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parseCsv } from '../scripts/lib/csv.mjs'
import {
  CONTRACT_SOURCES,
  KEY_COLUMNS,
  contractRowKeys,
  rowSortValue,
} from '../scripts/lib/contract-row-key.mjs'
import { TERMS_BUCKET_COUNT, termsBucketKey } from '../src/lib/shardKey.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV_DIR = join(__dirname, '..', 'scripts', 'data', 'contracts')
const OUT_DIR = join(__dirname, '..', 'public', 'data', 'contracts-history')

const csv = (source) => parseCsv(readFileSync(join(CSV_DIR, `${source}.csv`), 'utf8'))
const json = (...parts) => JSON.parse(readFileSync(join(OUT_DIR, ...parts), 'utf8'))

const ROWS = Object.fromEntries(CONTRACT_SOURCES.map((source) => [source, csv(source)]))
const KEYS = Object.fromEntries(
  CONTRACT_SOURCES.map((source) => [source, contractRowKeys(source, ROWS[source])]),
)

// ------------------------------------------------- the missing reconciliation

test('the crosswalk holds exactly one row per source CSV row', () => {
  for (const source of CONTRACT_SOURCES) {
    const crosswalk = json('identity', `${source}.json`)
    assert.equal(
      crosswalk.length,
      ROWS[source].length,
      `${source}: crosswalk has ${crosswalk.length} rows, ${source}.csv has ${ROWS[source].length}`,
    )
  }
})

test('every crosswalk rowKey is the key its own CSV row mints', () => {
  for (const source of CONTRACT_SOURCES) {
    const crosswalk = json('identity', `${source}.json`)
    assert.deepEqual(
      crosswalk.map((row) => row.rowKey),
      KEYS[source],
      `${source}: the crosswalk names rows the current CSV does not mint — regenerate, and read the migration script before you do`,
    )
  }
})

test('the search index holds exactly one row per source CSV row', () => {
  const index = json('search-index.json')
  const expected = CONTRACT_SOURCES.reduce((total, source) => total + ROWS[source].length, 0)
  assert.equal(index.length, expected)
  for (const source of CONTRACT_SOURCES) {
    assert.equal(index.filter((row) => row.sourceFile === source).length, ROWS[source].length)
  }
})

test('the terms buckets hold exactly one entry per source CSV row', () => {
  const seen = new Set()
  for (const file of readdirSync(join(OUT_DIR, 'terms'))) {
    for (const rowKey of Object.keys(json('terms', file))) {
      assert.ok(!seen.has(rowKey), `${rowKey} appears in more than one terms bucket`)
      seen.add(rowKey)
    }
  }
  for (const source of CONTRACT_SOURCES) {
    for (const key of KEYS[source]) {
      assert.ok(seen.has(key), `${source}: ${key} has no terms entry`)
    }
  }
  assert.equal(seen.size, CONTRACT_SOURCES.reduce((n, s) => n + ROWS[s].length, 0))
})

// ------------------------------------------------------------- the key itself

test('every row of every source file takes a distinct key', () => {
  const everywhere = new Set()
  for (const source of CONTRACT_SOURCES) {
    const keys = KEYS[source]
    assert.equal(
      new Set(keys).size,
      keys.length,
      `${source}: ${keys.length - new Set(keys).size} rows share a key with another row`,
    )
    for (const key of keys) everywhere.add(key)
  }
  // salaries.csv is the file the incident happened in and the one the duplicate
  // groups live in, so its own count is stated rather than left implied.
  assert.equal(ROWS.salaries.length, 27349)
  assert.equal(new Set(KEYS.salaries).size, 27349)
  assert.equal(everywhere.size, 36366)
})

test('two men who share a name and a season take two keys', () => {
  // docs/contracts-data-caveats.md, anomaly 1: 35 of salaries.csv's 88
  // duplicate (year, player) pairs are two DIFFERENT men. Merging them would
  // delete a player from the league and attribute his money to somebody else,
  // so the key has to separate them from content alone.
  const groups = new Map()
  ROWS.salaries.forEach((row, i) => {
    const pair = `${row.year}|${row.player}`
    if (!groups.has(pair)) groups.set(pair, [])
    groups.get(pair).push(i)
  })
  const duplicated = [...groups.values()].filter((rows) => rows.length > 1)
  assert.equal(duplicated.length, 88)

  for (const rows of duplicated) {
    const keys = rows.map((i) => KEYS.salaries[i])
    assert.equal(new Set(keys).size, keys.length, `a duplicate (year, player) group shares a key: ${keys}`)
  }

  // Two named cases from that document, each confirmed there against the
  // season-player pools: a pitcher and a catcher both called Will Smith, and a
  // centre fielder and a starter both called Chris Young.
  const named = (year, player) =>
    ROWS.salaries
      .map((row, i) => ({ row, key: KEYS.salaries[i] }))
      .filter(({ row }) => row.year === String(year) && row.player === player)

  for (const [year, player] of [[2022, 'Smith, Will'], [2011, 'Young, Chris']]) {
    const both = named(year, player)
    assert.equal(both.length, 2)
    assert.notEqual(both[0].key, both[1].key)
    // And the crosswalk sends the two keys to two different men.
    const crosswalk = new Map(json('identity', 'salaries.json').map((r) => [r.rowKey, r]))
    const ids = both.map(({ key }) => crosswalk.get(key)?.mlbId)
    assert.ok(ids.every((id) => id != null), `${player} ${year}: a row resolved to no id`)
    assert.notEqual(ids[0], ids[1], `${player} ${year}: both rows resolved to the same man`)
  }
})

test('the same man in four files takes four keys', () => {
  // The key is scoped per source file, so a salary row and an extension row for
  // one person stay two different facts about two different deals. Asserted
  // over every name the four files share rather than one chosen player, so the
  // test cannot pass by picking a lucky one.
  const firstRowByName = CONTRACT_SOURCES.map((source) => {
    const byName = new Map()
    ROWS[source].forEach((row, i) => {
      if (!byName.has(row.player)) byName.set(row.player, KEYS[source][i])
    })
    return byName
  })
  const inAllFour = [...firstRowByName[0].keys()].filter((name) =>
    firstRowByName.every((byName) => byName.has(name)),
  )
  // 63 names appear in all four files today. The floor is a long way below
  // that, so this asserts the test has something to chew on without pinning a
  // count that moves whenever a source export is refreshed.
  assert.ok(inAllFour.length > 25, `only ${inAllFour.length} names appear in all four files`)
  for (const name of inAllFour) {
    const keys = firstRowByName.map((byName) => byName.get(name))
    assert.equal(new Set(keys).size, 4, `${name}: the four files do not give four keys`)
  }
})

test('removing a row leaves the keys of all other rows alone', () => {
  // THE PROPERTY THE POSITIONAL KEY DID NOT HAVE, asserted directly. Row 100 of
  // salaries.csv is not one of the 27 verbatim-duplicate pairs, so nothing
  // depends on it but itself.
  const without = ROWS.salaries.filter((_, i) => i !== 100)
  const after = contractRowKeys('salaries', without)
  const before = KEYS.salaries.filter((_, i) => i !== 100)
  assert.deepEqual(after, before)
})

test('an edit outside the key columns leaves the key alone', () => {
  // A repair to a cell the key does not cover must not orphan an ADR-0067
  // correction. `mls` is outside the salaries key for exactly this reason.
  const edited = ROWS.salaries.map((row, i) => (i === 200 ? { ...row, mls: '9.999' } : row))
  assert.deepEqual(contractRowKeys('salaries', edited), KEYS.salaries)
  assert.ok(!KEY_COLUMNS.salaries.includes('mls'))
})

// --------------------------------------------- the writer/reader bucket join

test('a terms bucket holds only rows whose key names that bucket', () => {
  // src/lib/shardKey.js's own header: the generator files a row under a name
  // the reader recomputes from the rowKey alone, and two copies that drift are
  // a row whose money can never be found. This asserts they have not drifted,
  // against the files actually shipped.
  const files = readdirSync(join(OUT_DIR, 'terms'))
  assert.ok(files.length > 0)
  for (const file of files) {
    const expected = basename(file, '.json')
    for (const rowKey of Object.keys(json('terms', file))) {
      assert.equal(termsBucketKey(rowKey), expected, `${rowKey} sits in ${expected} but names ${termsBucketKey(rowKey)}`)
    }
  }
})

test('terms buckets stay near 500 rows a file', () => {
  // The divisors in TERMS_BUCKET_COUNT are stated, not derived, so a source
  // file that grows past this shape has to be noticed here. Fix it by raising
  // that source's count and regenerating — never by widening this band.
  const sizes = new Map()
  for (const source of CONTRACT_SOURCES) {
    for (const key of KEYS[source]) {
      const bucket = termsBucketKey(key)
      sizes.set(bucket, (sizes.get(bucket) ?? 0) + 1)
    }
  }
  for (const [bucket, size] of sizes) {
    assert.ok(size >= 200 && size <= 900, `terms bucket ${bucket} holds ${size} rows`)
  }
  assert.equal(sizes.size, Object.values(TERMS_BUCKET_COUNT).reduce((a, b) => a + b, 0))
  assert.equal(TERMS_BUCKET_COUNT.salaries, 56)
})

test('termsBucketKey answers null rather than guessing a bucket', () => {
  // A legacy positional key names no bucket, because the buckets are built
  // under content keys. Null says so; a number computed from '24340' would send
  // the reader to a real file that cannot hold it.
  assert.equal(termsBucketKey('salaries#24340'), null)
  assert.equal(termsBucketKey('nonsense'), null)
  assert.equal(termsBucketKey(''), null)
  assert.equal(termsBucketKey(undefined), null)
  assert.equal(termsBucketKey('unknown_file#0123456789abcdef'), null)
  assert.match(termsBucketKey(KEYS.salaries[0]), /^salaries-\d+$/)
})

// ---------------------------------------------------------- the display order

test('a player list reads newest season first, then largest figure first', () => {
  // The order the generator writes IS the order a reader shows:
  // src/api/contractsHistory.js re-sorts on season alone, and a stable sort
  // leaves everything below season where this put it. A content key carries no
  // order of its own, so if this ever regresses it regresses silently.
  for (const shardName of readdirSync(join(OUT_DIR, 'player'))) {
    const shard = json('player', shardName)
    for (const [id, rows] of Object.entries(shard.players)) {
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1]
        const row = rows[i]
        assert.ok(prev.season >= row.season, `player ${id}: season ${prev.season} listed before ${row.season}`)
      }
    }
  }
})

test('Roy Halladay 2010 lists the roster salary before the obligation row', () => {
  // docs/contracts-data-caveats.md names this pair: his own row carries the
  // full $15,750,000, and a second, position-less row carries Toronto's
  // $6,000,000 share of it. Two rows, one season, one source file — which means
  // the tie-break decides what a reader sees first, and the larger stated
  // figure is the deal.
  const shard = json('player', '80.json')
  const rows = shard.players['136880'].filter((row) => row.season === 2010)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].terms.salary, 15750000)
  assert.equal(rows[1].terms.salary, 6000000)
})

test('a row that states no figure sorts last, never as zero', () => {
  assert.equal(rowSortValue('salaries', { salary: '5000000' }), 5000000)
  assert.equal(rowSortValue('salaries', { salary: '' }), -Infinity)
  assert.equal(rowSortValue('salaries', { salary: 'forfeited' }), -Infinity)
  assert.equal(rowSortValue('salaries', {}), -Infinity)
  // extensions order on the signing date, the only source that carries one.
  assert.ok(
    rowSortValue('extensions', { signed_date: '2009-11-05' }) >
      rowSortValue('extensions', { signed_date: '2002-02-18' }),
  )
  assert.equal(rowSortValue('extensions', { signed_date: '' }), -Infinity)
})
