// pull-ba.mjs -- fills the 2005-2008 gap in rows.json / seasons.json from a
// SECOND source, because pull.mjs's source (MLB Pipeline's /prospects/{year}
// page) has no ranked list before 2009 -- confirmed live, recorded in
// seasons.json as status "unavailable" for those four years, and left that
// way (this script does not touch pull.mjs, parse.mjs, or their fixture).
//
// SOURCE 1 -- the rankings. A third-party CSV transcription of Baseball
// America's preseason top-100 lists, 1990-2020, 100 rows/year:
//   github.com/feralad/rostercrunch, path "Final Datasets/ba_1990_2020_top_
//   100_preseason_prospect_rankings_id_debut_updates_may_2024.csv" (the
//   space in "Final Datasets" MUST stay percent-encoded as %20 in the URL --
//   an unencoded space breaks the request).
//   LICENCE: none declared. No LICENSE file, no terms in the README. The
//   rankings under it are Baseball America editorial content. The repository
//   owner (not this script) decided to use it anyway -- this file records
//   that provenance, it does not argue it, and rows built from it are never
//   described as licensed or public domain.
//
// SOURCE 2 -- the id crosswalk. The CSV's ID column is a RETROSHEET id
// ("hilla001"), not the MLBAM integer id every other row in rows.json
// carries, and there is no name-matching step here at all -- the join is a
// straight key_retro -> key_mlbam lookup against the Chadwick Bureau
// register (github.com/chadwickbureau/register, branch master,
// data/people-0.csv .. people-9.csv, people-a.csv .. people-f.csv -- 16
// files, each with its OWN header row). LICENCE: Open Data Commons
// Attribution License 1.0 -- a real, separate, more permissive licence from
// source 1's "none declared"; the two are recorded separately in seasons.json
// and must not be blurred into one line.
//
// FOUR TRAPS, each already hit once while building this script:
//   1. YEAR is a date string ("2005-01-01"), not a number. Comparing it to
//      2005 directly matches nothing -- take the first 4 characters.
//   2. POSITION_1..5 are numeric scorekeeping codes (1 = pitcher, 2 =
//      catcher, ...), not letters. Unused here (rows.json carries no
//      position), noted so nobody adds a "RHP"/"LHP" string filter later.
//   3. ID === 'NA' is the literal two-character string "NA", not a blank
//      cell -- it means the man never reached the majors (Retrosheet only
//      covers MLB games, so a non-debuting man has no Retrosheet id to give
//      him). That is real information, not dirty data: those rows are
//      EXCLUDED from rows.json (a null-mlbId row would break "no mlbId is
//      duplicated" style checks for no benefit) but never silently dropped
//      -- every one is written to ba-non-debuts.json with the season, BA
//      rank, name and team so a reader can find them.
//   4. Concatenating the 16 Chadwick files naively leaves 15 stray header
//      rows sitting in the data. This script parses each file separately
//      (its own header, its own rows) and never concatenates the raw text,
//      which sidesteps the trap rather than filtering it out after.
//
// FAIL LOUD. The expected join rate for 2005-2008 (measured before this
// script existed) is 375 of 375 non-'NA' rows -- zero tolerance, no
// configurable threshold. A single unresolved retro id throws, naming it,
// rather than writing a partial year (see the `unresolved.length > 0` check
// in main()).
//
// Run by hand: node .scratch/top-prospects-history/pull-ba.mjs
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeJsonAtomic, readJsonOr } from '../../scripts/lib/io.js'
import { parseCsv } from '../../scripts/lib/csv.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROWS_PATH = join(here, 'rows.json')
const SEASONS_PATH = join(here, 'seasons.json')
const NON_DEBUTS_PATH = join(here, 'ba-non-debuts.json')

const BA_CSV_URL =
  'https://raw.githubusercontent.com/feralad/rostercrunch/main/Final%20Datasets/ba_1990_2020_top_100_preseason_prospect_rankings_id_debut_updates_may_2024.csv'
const BA_SOURCE_REPO = 'github.com/feralad/rostercrunch'
const BA_SOURCE_PATH =
  'Final Datasets/ba_1990_2020_top_100_preseason_prospect_rankings_id_debut_updates_may_2024.csv'

const CHADWICK_BASE = 'https://raw.githubusercontent.com/chadwickbureau/register/master/data/people-'
const CHADWICK_SUFFIXES = [...'0123456789abcdef']

const YEARS = [2005, 2006, 2007, 2008]
const EXISTING_SOURCE = 'mlb-pipeline'
const NEW_SOURCE = 'baseball-america'

const UA = 'bbsbh-top-prospects-history/0.1 (baseball scorebook research ingester; historical top-prospect lists)'
const FETCH_TIMEOUT_MS = 20000

async function fetchText(url, attempt = 1) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return await res.text()
  } catch (err) {
    const timedOut = err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.code === 'ETIMEDOUT'
    if (attempt === 1 && timedOut) {
      console.log(`  retrying once after a connect timeout: ${url}`)
      return fetchText(url, 2)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// Builds the retro -> mlbam map from all 16 Chadwick files, parsed one at a
// time (trap 4 above). Throws if a file's header is missing either column,
// or if a row's key_mlbam does not parse as a positive integer.
async function buildRetroToMlbamMap() {
  const map = new Map()
  let pairCount = 0
  for (const suffix of CHADWICK_SUFFIXES) {
    const url = `${CHADWICK_BASE}${suffix}.csv`
    console.log(`  fetching ${url} ...`)
    const text = await fetchText(url)
    const rows = parseCsv(text)
    if (rows.length === 0) throw new Error(`${url}: parsed zero rows`)
    if (!('key_retro' in rows[0]) || !('key_mlbam' in rows[0])) {
      throw new Error(`${url}: missing key_retro or key_mlbam column -- register schema may have changed`)
    }
    for (const row of rows) {
      const retro = row.key_retro
      const mlbamRaw = row.key_mlbam
      if (!retro || !mlbamRaw) continue
      const mlbam = Number(mlbamRaw)
      if (!Number.isInteger(mlbam) || mlbam <= 0) {
        throw new Error(`${url}: key_mlbam "${mlbamRaw}" for key_retro "${retro}" is not a positive integer`)
      }
      map.set(retro, mlbam)
      pairCount++
    }
  }
  console.log(`  ${pairCount} retro->mlbam pairs read, ${map.size} distinct retro ids`)
  return map
}

// Parses the BA CSV and returns only the 2005-2008 rows (trap 1: YEAR is a
// date string), validated to be exactly 100 rows per year with ranks 1..100,
// no duplicate ranks -- the shape this script was built against.
function loadBaWindowRows(csvText) {
  const rows = parseCsv(csvText)
  if (rows.length === 0) throw new Error('BA CSV parsed to zero rows')
  const window = rows.filter((r) => {
    const year = Number(r.YEAR.slice(0, 4))
    return YEARS.includes(year)
  })

  const byYear = new Map()
  for (const r of window) {
    const year = Number(r.YEAR.slice(0, 4))
    if (!byYear.has(year)) byYear.set(year, [])
    byYear.get(year).push(r)
  }
  for (const year of YEARS) {
    const yearRows = byYear.get(year) ?? []
    if (yearRows.length !== 100) {
      throw new Error(`BA CSV ${year}: expected 100 rows, found ${yearRows.length} -- source shape may have changed`)
    }
    const ranks = yearRows.map((r) => Number(r.PROSPECT_RANK)).sort((a, b) => a - b)
    for (let i = 0; i < 100; i++) {
      if (ranks[i] !== i + 1) {
        throw new Error(`BA CSV ${year}: ranks are not the contiguous set 1..100 (source shape may have changed)`)
      }
    }
  }
  return window
}

async function main() {
  console.log(`fetching BA rankings: ${BA_CSV_URL}`)
  const baCsvText = await fetchText(BA_CSV_URL)
  const windowRows = loadBaWindowRows(baCsvText)
  console.log(`  ${windowRows.length} rows across ${YEARS.join(', ')}`)

  console.log('fetching Chadwick register (16 files)...')
  const retroToMlbam = await buildRetroToMlbamMap()

  const nonDebuts = []
  const unresolved = []
  const joinedBySeason = new Map(YEARS.map((y) => [y, []]))

  for (const row of windowRows) {
    const season = Number(row.YEAR.slice(0, 4))
    const rank = Number(row.PROSPECT_RANK)
    const retroId = row.ID

    if (retroId === 'NA') {
      // trap 3: a literal "NA" id, not a blank cell -- the man never
      // reached the majors. Recorded, never silently dropped.
      nonDebuts.push({
        season,
        rank,
        playerName: row.PLAYER_NAME,
        team: row.TEAM,
        note: "Baseball America ranked this player, but BA id is 'NA' -- Retrosheet (and this join) has no id for him because he never appeared in a major league game.",
      })
      continue
    }

    const mlbId = retroToMlbam.get(retroId)
    if (mlbId === undefined) {
      unresolved.push(`${retroId} (${row.PLAYER_NAME}, ${season})`)
      continue
    }
    joinedBySeason.get(season).push({ season, rank, mlbId, source: NEW_SOURCE })
  }

  const nonNaCount = windowRows.length - nonDebuts.length
  const joinedCount = [...joinedBySeason.values()].reduce((n, arr) => n + arr.length, 0)

  if (unresolved.length > 0) {
    throw new Error(
      `${unresolved.length} of ${nonNaCount} non-'NA' rows failed to join against the Chadwick register ` +
        `(expected 375 of 375). Unresolved retro ids: ${unresolved.join('; ')}`,
    )
  }
  if (joinedCount !== nonNaCount) {
    throw new Error(`join accounting mismatch: ${joinedCount} joined but ${nonNaCount} non-'NA' rows`)
  }
  console.log(`join rate: ${joinedCount} of ${nonNaCount} non-'NA' rows resolved (expected 375 of 375)`)

  // Guard against a duplicate mlbId landing twice in the same season (would
  // silently double-count a player -- fail loud instead).
  for (const [season, list] of joinedBySeason) {
    const ids = list.map((r) => r.mlbId)
    if (new Set(ids).size !== ids.length) {
      throw new Error(`season ${season}: a joined mlbId appears more than once`)
    }
  }

  // ---- rows.json: tag every existing row with its source, then append ----
  const priorRows = await readJsonOr(ROWS_PATH, [])
  if (priorRows.some((r) => YEARS.includes(r.season))) {
    throw new Error('rows.json already has 2005-2008 rows -- refusing to duplicate them. Remove them by hand first.')
  }
  const existingRowsTagged = priorRows.map((r) => ({ ...r, source: EXISTING_SOURCE }))
  const newRows = YEARS.flatMap((y) => joinedBySeason.get(y)).sort((a, b) => a.season - b.season || a.rank - b.rank)

  // Verify the mechanical rewrite kept every pre-existing season/rank/mlbId
  // untouched -- the one thing this script must never change.
  for (let i = 0; i < priorRows.length; i++) {
    const before = priorRows[i]
    const after = existingRowsTagged[i]
    if (before.season !== after.season || before.rank !== after.rank || before.mlbId !== after.mlbId) {
      throw new Error(`existing row ${i} changed during the source-tagging rewrite -- refusing to write`)
    }
  }

  const allRows = [...existingRowsTagged, ...newRows]
  await writeJsonAtomic(ROWS_PATH, allRows, 2)

  // ---- seasons.json: replace the 4 "unavailable" entries ----
  const priorSeasons = await readJsonOr(SEASONS_PATH, [])
  const retrievedAt = new Date().toISOString()
  const rowCountBySeason = new Map(YEARS.map((y) => [y, joinedBySeason.get(y).length]))
  const naCountBySeason = new Map(YEARS.map((y) => [y, nonDebuts.filter((n) => n.season === y).length]))

  const seasons = priorSeasons.map((s) => {
    if (!YEARS.includes(s.season)) return s
    const rowCount = rowCountBySeason.get(s.season)
    const naCount = naCountBySeason.get(s.season)
    return {
      season: s.season,
      status: 'ok',
      depth: 100,
      rowCount,
      source: NEW_SOURCE,
      fetchedAt: retrievedAt,
      note:
        `MLB Pipeline still has no ranked list for this season (HTTP 200, real empty shell, ` +
        `confirmed live -- see the original note this replaces). Filled instead from a third-party ` +
        `CSV transcription of Baseball America's preseason top-100 list: ${BA_SOURCE_REPO}, ` +
        `"${BA_SOURCE_PATH}", retrieved ${retrievedAt}. That CSV declares NO licence (no LICENSE ` +
        `file, no terms in its README) -- these ${rowCount} rows are Baseball America editorial ` +
        `content used without a declared licence, by deliberate choice, not because it is public ` +
        `domain. BA ranked 100 players; ${naCount} of them carry no Retrosheet id because they never ` +
        `reached the majors, and are excluded here but recorded in ba-non-debuts.json, not dropped ` +
        `silently. The other ${rowCount} joined to an MLBAM id via the Chadwick Bureau register ` +
        `(github.com/chadwickbureau/register, Open Data Commons Attribution License 1.0) at a 100% ` +
        `join rate (${rowCount} of ${rowCount}).`,
    }
  })
  await writeJsonAtomic(SEASONS_PATH, seasons, 2)

  // ---- ba-non-debuts.json: the 25 excluded rows, never silently dropped ----
  nonDebuts.sort((a, b) => a.season - b.season || a.rank - b.rank)
  await writeJsonAtomic(NON_DEBUTS_PATH, nonDebuts, 2)

  console.log('\nwrote:')
  for (const y of YEARS) {
    console.log(`  ${y}: ${rowCountBySeason.get(y)} rows (${naCountBySeason.get(y)} non-debuts excluded, see ba-non-debuts.json)`)
  }
  console.log(`  ${allRows.length} total rows in ${ROWS_PATH}`)
  console.log(`  ${nonDebuts.length} total non-debuts in ${NON_DEBUTS_PATH}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('pull-ba.mjs failed:', err.message)
    process.exit(1)
  })
}
