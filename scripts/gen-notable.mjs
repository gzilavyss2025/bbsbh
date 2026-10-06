// Regenerates public/data/notable/{nohitters,cycles,tripleplays}.json: the games behind
// the "Notable games" shelf (D4 in .scratch/old-games/decisions.md, ADR-0101 DRAFT).
// A no-hitter, a cycle and a triple play, from the MLB Stats API alone: every row has a
// gamePk, so a row opens its game with no join. AL and NL games only (D6); the regular
// season and the postseason (D13).
//
// THIS WRITES DATA ONLY. No reader in src/ and no page reads these files yet (ADR-0076
// lets a dataset ship before its surface). A score is in a row on purpose (D5), so the
// reader must sit behind the shelf's labelled door (ADR-0081), never on a slate card.
//
// WHAT RUNS IT. The full history (1901 to now) is a hand run:
//   node scripts/gen-notable.mjs --from=1901 --to=2025
// The nightly cron runs it with no flags, which sweeps only the season in play
// (lib/time/season-in-play.mjs) so the callout never says "first since 2019" after a
// triple play in May. A season costs about 50 calls.
//   node scripts/gen-notable.mjs --season=2025       # one season (also: --season 2025)
//   node scripts/gen-notable.mjs --from=1950 --to=1960
//   node scripts/gen-notable.mjs --season=1956 --out=DIR   # write to DIR: a measuring run
// Nightly: .github/workflows/update-nightly-data.yml
//
// EACH RUN REPLACES EVERY ROW OF EACH SEASON IT SWEPT, in all three files, and keeps
// every other season (lib/notable/merge.mjs says why: a corrected upstream row must not
// leave a ghost row). It writes after each season, so an interrupted history run keeps
// what it finished. A season with no games writes nothing.
//
// scripts/notable-seed.json holds the hand-seeded additions (D3): a feat the API misses,
// such as the 2023-08-18 triple play that only the box score text holds. The generator
// merges it and the output is never edited by hand.
//
// NO generatedAt. Each file's `coverage` block is its own clock: the seasons swept, the
// date the data runs through, the leagues and the game types (check-data-freshness.mjs).
//
// All logic a test must reach is in scripts/lib/notable/; this file RUNS on import.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from './lib/args.mjs'
import { readJsonOr } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'
import { normalizeArgv, seasonsFromArgs, unknownFlags } from './lib/notable/cli.mjs'
import {
  KINDS, applySeed, emptyDoc, mergeCoverage, mergeRows, serializeDoc,
} from './lib/notable/merge.mjs'
import { sweepSeason } from './lib/notable/sweep.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILES = { nohitters: 'nohitters.json', cycles: 'cycles.json', tripleplays: 'tripleplays.json' }

const parsed = parseArgs(normalizeArgv(process.argv.slice(2)))
const stray = unknownFlags(parsed)
if (stray.length) throw new Error(`unknown flag: --${stray.join(', --')}`)
if (parsed.out === true) throw new Error('--out takes a folder: --out=DIR')
const outDir = parsed.out ? resolve(parsed.out) : join(root, 'public', 'data', 'notable')
// The season in play is the default, and it costs one call: ask only when a flag leaves
// the last season open. Otherwise the calendar year is the cap on what a flag may name.
const lastIsOpen = parsed.season === undefined && parsed.to === undefined
const inPlay = lastIsOpen ? await fetchSeasonInPlay() : new Date().getUTCFullYear()
const seasons = seasonsFromArgs(parsed, inPlay)

// The cost of the run, counted at the one door every call goes through. Bytes are the
// re-serialised JSON (compact), a little under the wire size.
const cost = { calls: 0, bytes: 0 }
const get = async (path) => {
  const body = await getJson(path)
  cost.calls += 1
  cost.bytes += JSON.stringify(body).length
  return body
}

const seed = (await readJsonOr(join(root, 'scripts', 'notable-seed.json'), {})) ?? {}
const docs = {}
for (const kind of KINDS) {
  const prev = await readJsonOr(join(outDir, FILES[kind]), null)
  docs[kind] = prev?.coverage && Array.isArray(prev.rows) ? prev : emptyDoc()
}

async function write(kind) {
  const path = join(outDir, FILES[kind])
  await mkdir(dirname(path), { recursive: true })
  await writeFile(`${path}.tmp`, serializeDoc(docs[kind]))
  await rename(`${path}.tmp`, path)
}

console.log(`Notable games: ${seasons.length > 1 ? `${seasons[0]} to ${seasons.at(-1)}` : seasons[0]} -> ${outDir}`)
for (const season of seasons) {
  const swept = await sweepSeason(get, season)
  if (!swept) {
    console.log(`  ${season}: no games, nothing written`)
    continue
  }
  const gameMaps = new Map([[season, swept.gameMap]])
  const counts = []
  for (const kind of KINDS) {
    const merged = mergeRows(kind, docs[kind].rows, [season], swept.rows[kind])
    const { rows, applied } = applySeed(kind, merged, seed[kind], gameMaps)
    docs[kind] = { coverage: mergeCoverage(docs[kind].coverage, [season], swept.through), rows }
    await write(kind)
    counts.push(`${swept.rows[kind].length + applied} ${kind}`)
  }
  console.log(`  ${season}: ${counts.join(', ')} (through ${swept.through})`)
}

for (const kind of KINDS) {
  const waiting = (seed[kind] ?? []).filter((s) => !docs[kind].coverage.seasons.includes(s.season))
  if (waiting.length) console.log(`  seed rows waiting for an unswept season, ${kind}: ${waiting.map((s) => `${s.gamePk} (${s.season})`).join(', ')}`)
}
console.log(`Done. ${cost.calls} calls, about ${(cost.bytes / 1e6).toFixed(2)} MB of JSON.`)
