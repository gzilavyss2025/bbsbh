// pull.mjs -- ingests MLB.com's HISTORICAL Top Prospects lists
// (https://www.mlb.com/prospects/{year}) into two committed, row-grain
// panels: rows.json (season, rank, mlbId) and seasons.json (per-season
// coverage metadata). Built to unblock a research spike ("what is a
// top-100 prospect ranking worth in career earnings?") that died at its
// premise check: this repo held no prospect ranking older than
// 2026-07-07 (public/data/top-prospects.json is a WEEKLY snapshot of the
// CURRENT list). See docs/prospect-traits.md:300 and
// docs/level-tenure-benchmark.md:91 for where that blocker was first
// recorded.
//
// THIS IS A DIFFERENT PAGE from scripts/fetch-top-prospects.mjs's source.
// That script reads https://www.mlb.com/prospects/stats/top-prospects,
// where the CURRENT list ships as a plain `var data = [...]` JS array with
// a real `playerId` field, and keeps running exactly as it does today --
// nothing here touches it. This page, .../prospects/{year} (one per
// season), is an entirely different, undocumented Next.js data payload;
// see parse.mjs's header for its shape and the two traps in it (HTML-entity
// encoding, and the id living in a `Person:` graph ref, not a field). Do
// not merge these two generators: different URL, different embedded
// format, different cadence (that one's a weekly cron; this one is
// hand-run over a closed set of past seasons, like gen-war-history.mjs).
//
// WHY .scratch/, NOT public/data/: nothing in the shipped app reads this
// yet. It exists to join against the research cohort at
// .scratch/prospect-traits/bio.json (both keyed on real MLBAM id -- no
// name matching, no crosswalk) for a research spike, the same way every
// other .scratch/*/pull.mjs feeds its own diary rather than a page. If a
// future feature wants this on a real route, promote it to a
// scripts/gen-*.mjs + public/data/ per scripts/CLAUDE.md's conventions.
//
// FAIL LOUD, NEVER SHORT. A season whose parsed ranks aren't the
// contiguous range 1..max with no duplicate ranks or ids throws rather
// than writing whatever the regex happened to catch (parse.mjs's
// assertContiguousRanks). A --refetch that comes back with FEWER rows
// than the season already on disk throws rather than overwriting a good
// season with a worse one. Both are this generator's answer to a failure
// this program has already hit once: a short write that "looks plausible"
// and nothing downstream ever catches (W1's missing-stint cache).
//
// CACHING AND --refetch. Once a season is written with status "ok" or
// "unavailable" it is treated as settled -- both are immutable in
// practice (a completed year's published ranking doesn't change; 2005-
// 2008's empty shell has stayed empty across repeated live checks) -- and
// a plain re-run skips re-fetching it, which is what lets adding a newly
// completed year later cost one request instead of twenty. --refetch
// bypasses that for EVERY year below, unconditionally: without it, a bug
// caught in this parser after the fact (not just "the season wasn't over
// yet") would sit silently cached forever and a plain re-run would still
// report success. Named for what it does -- force a refetch -- rather
// than gen-trade-deadline.mjs's --force, which only unfreezes a season
// that plain calendar time has since completed; this data's cache can go
// stale for a reason the calendar can't fix.
//
// POLITENESS. Years fetch strictly SEQUENTIALLY with a delay between
// requests and a real User-Agent, never in parallel -- this is a single
// editorial page on mlb.com, not the documented statsapi.mlb.com the rest
// of the app hits freely. One retry on a connect/timeout error; any other
// failure (a bad HTTP status, or a non-empty page whose shape doesn't
// parse for a year known to carry real data) throws immediately rather
// than silently recording the year as unavailable.
//
// Run by hand: node .scratch/top-prospects-history/pull.mjs [--refetch]
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeJsonAtomic } from '../../scripts/lib/io.js'
import { parseRankedEntries, assertContiguousRanks } from './parse.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROWS_PATH = join(here, 'rows.json')
const SEASONS_PATH = join(here, 'seasons.json')

const UA = 'bbsbh-top-prospects-history/0.1 (baseball scorebook research ingester; historical top-prospect lists)'
const DELAY_MS = 1200
const FETCH_TIMEOUT_MS = 15000

// The verified window. 2005-2008 are fetched and re-confirmed on every
// full run (not assumed) to return a real, live-confirmed empty shell --
// HTTP 200, no RankedPlayerEntity matches -- a genuine absence, recorded
// explicitly rather than omitted, so a reader can see the window starts at
// 2009 instead of silently starting the array there. FIRST_EXPECTED_YEAR
// is where real coverage begins; a year at or after it that comes back
// empty is treated as a page-shape break, not a known gap, and throws.
// LAST_YEAR stops at the last completed season this program's sourcing
// pass verified against a live response -- bump it, verified the same
// way, once a newer season is checked.
const FIRST_YEAR = 2005
const FIRST_EXPECTED_YEAR = 2009
const LAST_YEAR = 2024

async function readJsonOr(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchYearPage(year, attempt = 1) {
  const url = `https://www.mlb.com/prospects/${year}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return await res.text()
  } catch (err) {
    const timedOut = err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.code === 'ETIMEDOUT'
    if (attempt === 1 && timedOut) {
      console.log(`  ${year}: connect timeout, retrying once...`)
      return fetchYearPage(year, 2)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// Fetches and validates one season. Returns { status, depth, rowCount,
// entries, note }. Throws for any outcome this program has no established
// explanation for -- see this file's header -- rather than returning a
// "failed" status that a caller might write anyway.
async function pullYear(year) {
  const html = await fetchYearPage(year)
  const entries = parseRankedEntries(html)

  if (entries.length === 0) {
    if (year >= FIRST_EXPECTED_YEAR) {
      throw new Error(
        `${year}: expected a real ranked list (>= ${FIRST_EXPECTED_YEAR}) but parsed zero entries -- ` +
          `page shape may have changed; see parse.mjs. Refusing to record this as "unavailable".`,
      )
    }
    return {
      status: 'unavailable',
      depth: null,
      rowCount: 0,
      entries: [],
      note:
        `HTTP 200, ${html.length} bytes, zero RankedPlayerEntity matches -- a real empty shell, ` +
        `confirmed live, not a fetch or parse failure. MLB Pipeline's Top Prospects page has no ` +
        `ranked list before ${FIRST_EXPECTED_YEAR}.`,
    }
  }

  const depth = assertContiguousRanks(entries, year)
  let note = `${depth} ranks retrieved, contiguous 1..${depth}, no duplicate ranks or ids.`
  if (depth !== 100 && depth !== 50) {
    note += ` Non-round depth -- confirmed NOT a parsing gap by the contiguity check above; MLB simply published ${depth} names this year.`
  }
  return { status: 'ok', depth, rowCount: entries.length, entries, note }
}

async function main() {
  const refetch = process.argv.includes('--refetch')
  const priorSeasons = await readJsonOr(SEASONS_PATH, [])
  const priorRows = await readJsonOr(ROWS_PATH, [])
  const priorByYear = new Map(priorSeasons.map((s) => [s.season, s]))

  const seasons = []
  const rows = []
  let fetchedCount = 0
  let skippedCount = 0

  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const prior = priorByYear.get(year)
    const settled = prior && (prior.status === 'ok' || prior.status === 'unavailable')

    if (settled && !refetch) {
      seasons.push(prior)
      if (prior.status === 'ok') rows.push(...priorRows.filter((r) => r.season === year))
      skippedCount++
      console.log(`${year}: cached (${prior.status}, ${prior.rowCount} rows) -- pass --refetch to re-check`)
      continue
    }

    if (fetchedCount > 0) await sleep(DELAY_MS)
    console.log(`${year}: fetching https://www.mlb.com/prospects/${year} ...`)
    const result = await pullYear(year)
    fetchedCount++

    if (prior && prior.status === 'ok' && result.rowCount < prior.rowCount) {
      throw new Error(
        `${year}: refetch returned FEWER rows than the committed season (${result.rowCount} < ${prior.rowCount}) -- ` +
          `refusing to overwrite a good season with a shorter one. Investigate before re-running.`,
      )
    }

    seasons.push({
      season: year,
      status: result.status,
      depth: result.depth,
      rowCount: result.rowCount,
      fetchedAt: new Date().toISOString(),
      note: result.note,
    })
    for (const e of result.entries) rows.push({ season: year, rank: e.rank, mlbId: e.mlbId })
    console.log(`${year}: ${result.status} (${result.rowCount} rows${result.depth ? `, depth ${result.depth}` : ''})`)
  }

  rows.sort((a, b) => a.season - b.season || a.rank - b.rank)
  seasons.sort((a, b) => a.season - b.season)

  await writeJsonAtomic(ROWS_PATH, rows, 2)
  await writeJsonAtomic(SEASONS_PATH, seasons, 2)

  const distinctPlayers = new Set(rows.map((r) => r.mlbId)).size
  console.log(
    `\nwrote ${rows.length} rows (${distinctPlayers} distinct players) across ${seasons.length} seasons to ` +
      `${ROWS_PATH} + ${SEASONS_PATH} (${fetchedCount} fetched, ${skippedCount} cached this run; pass --refetch to force every year)`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('pull.mjs failed:', err.message)
    process.exit(1)
  })
}
