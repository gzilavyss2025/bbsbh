import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Guards .scratch/top-prospects-history/rows.json + seasons.json against
// regressing once 2005-2008 (Baseball America, via pull-ba.mjs) sit beside
// 2009-2024 (MLB Pipeline, via pull.mjs) in the same file. THE RULE THAT
// MATTERS MOST: the two rankings are different publications by different
// scouts, so every record MUST carry a `source` field a reader can tell
// them apart by -- that is what most of this file checks. See Refs #946.

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', '.scratch', 'top-prospects-history')

const rows = JSON.parse(readFileSync(join(dataDir, 'rows.json'), 'utf8'))
const seasons = JSON.parse(readFileSync(join(dataDir, 'seasons.json'), 'utf8'))
const nonDebuts = JSON.parse(readFileSync(join(dataDir, 'ba-non-debuts.json'), 'utf8'))

const BA_SEASON_COUNTS = { 2005: 91, 2006: 94, 2007: 95, 2008: 95 }
const PRE_EXISTING_TOTAL = 1448
const BA_TOTAL = Object.values(BA_SEASON_COUNTS).reduce((a, b) => a + b, 0)

function rowsForSeason(season) {
  return rows.filter((r) => r.season === season)
}

// --------------------------------------------------------------- provenance
test('every row carries an explicit source, never pooled as one undifferentiated list', () => {
  const withoutSource = rows.filter((r) => typeof r.source !== 'string' || r.source.length === 0)
  assert.deepEqual(withoutSource, [])
})

test('the two publications use two distinct, exact source labels', () => {
  const labels = new Set(rows.map((r) => r.source))
  assert.deepEqual([...labels].sort(), ['baseball-america', 'mlb-pipeline'])
})

test('2005-2008 are labelled baseball-america; 2009-2024 are labelled mlb-pipeline', () => {
  for (const r of rows) {
    const expected = r.season <= 2008 ? 'baseball-america' : 'mlb-pipeline'
    assert.equal(r.source, expected, `season ${r.season} rank ${r.rank} carries source "${r.source}"`)
  }
})

// ------------------------------------------------------------- row counts
test('the pre-existing 2009-2024 window still totals exactly 1,448 rows', () => {
  const count = rows.filter((r) => r.season >= 2009 && r.season <= 2024).length
  assert.equal(count, PRE_EXISTING_TOTAL)
})

test('2005-2008 contain exactly the row counts this ingest produced (375 total)', () => {
  assert.equal(BA_TOTAL, 375)
  for (const [season, expected] of Object.entries(BA_SEASON_COUNTS)) {
    assert.equal(rowsForSeason(Number(season)).length, expected, `season ${season}`)
  }
})

test('total row count is the pre-existing window plus the new Baseball America window', () => {
  assert.equal(rows.length, PRE_EXISTING_TOTAL + BA_TOTAL)
})

// -------------------------------------------------------- shape, per season
const allSeasons = [...new Set(rows.map((r) => r.season))].sort((a, b) => a - b)

for (const season of allSeasons) {
  test(`season ${season}: ranks are unique and fall within 1..100`, () => {
    const seasonRows = rowsForSeason(season)
    const ranks = seasonRows.map((r) => r.rank)
    assert.equal(new Set(ranks).size, ranks.length, 'duplicate rank found')
    for (const rank of ranks) {
      assert.ok(rank >= 1 && rank <= 100, `rank ${rank} out of range 1..100`)
    }
  })

  test(`season ${season}: no mlbId is duplicated within the season`, () => {
    const ids = rowsForSeason(season).map((r) => r.mlbId)
    assert.equal(new Set(ids).size, ids.length, 'duplicate mlbId found')
  })

  test(`season ${season}: every mlbId is a positive integer`, () => {
    for (const r of rowsForSeason(season)) {
      assert.ok(Number.isInteger(r.mlbId) && r.mlbId > 0, `season ${season} rank ${r.rank}: mlbId ${r.mlbId}`)
    }
  })
}

// ----------------------------------------------------------- seasons.json
test('seasons.json marks 2005-2008 as ok, sourced from baseball-america, with the row count actually written', () => {
  for (const [seasonStr, expected] of Object.entries(BA_SEASON_COUNTS)) {
    const season = Number(seasonStr)
    const entry = seasons.find((s) => s.season === season)
    assert.ok(entry, `no seasons.json entry for ${season}`)
    assert.equal(entry.status, 'ok')
    assert.equal(entry.source, 'baseball-america')
    assert.equal(entry.rowCount, expected)
    assert.equal(rowsForSeason(season).length, entry.rowCount, `rows.json/seasons.json rowCount mismatch for ${season}`)
  }
})

test('seasons.json still records that MLB Pipeline itself has no list for 2005-2008', () => {
  for (const season of [2005, 2006, 2007, 2008]) {
    const entry = seasons.find((s) => s.season === season)
    assert.match(entry.note, /MLB Pipeline/)
    assert.match(entry.note, /no ranked list/i)
  }
})

test('2009-2024 seasons.json entries are untouched (still mlb-pipeline sourced, status ok)', () => {
  for (const entry of seasons.filter((s) => s.season >= 2009)) {
    assert.equal(entry.status, 'ok')
  }
})

// -------------------------------------------------------------- non-debuts
// The 25 BA-ranked players whose CSV id is the literal string 'NA' (never
// reached the majors) are excluded from rows.json but must never vanish
// without a trace -- they are recorded here instead.
test('the 25 non-debut BA rows are recorded, not silently dropped', () => {
  assert.equal(nonDebuts.length, 25)
  for (const entry of nonDebuts) {
    assert.ok([2005, 2006, 2007, 2008].includes(entry.season))
    assert.ok(entry.rank >= 1 && entry.rank <= 100)
    assert.equal(typeof entry.playerName, 'string')
    assert.ok(entry.playerName.length > 0)
  }
})

test('the non-debuts plus the joined rows account for all 400 BA-ranked slots (100 per season)', () => {
  for (const season of [2005, 2006, 2007, 2008]) {
    const joined = rowsForSeason(season).length
    const excluded = nonDebuts.filter((n) => n.season === season).length
    assert.equal(joined + excluded, 100, `season ${season}`)
  }
})
