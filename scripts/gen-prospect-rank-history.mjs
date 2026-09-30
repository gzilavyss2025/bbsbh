// gen-prospect-rank-history.mjs -- promotes the finished research pull in
// .scratch/top-prospects-history/ (rows.json + seasons.json) to the one static
// file a player page reads: public/data/prospect-rank-history.json (#1111).
//
// HAND-RUN, NOT ON A CRON, and it stays that way. 2005-2024 does not change.
// Only the current season moves, and top-prospects.json (weekly) already
// carries that. Run it once when a new season is added to the pull:
//
//   node scripts/gen-prospect-rank-history.mjs
//
// The output has no timestamp, so a re-run with the same input rewrites the
// same bytes and shows no diff. `--out <path>` writes somewhere else (the test
// uses it to prove that).
//
// TO DROP BASEBALL AMERICA (2005-2008), delete 'baseball-america' from
// INCLUDE_SOURCES below and re-run. Its rows, seasons, depths and credit lines
// (the Chadwick id-join credit too) leave the file, the player page needs no
// change, and MLB Pipeline's 2009-2024 stays as it was. Why that switch exists:
// the 2005-2008 rankings come from a third-party CSV transcription with no
// declared licence, and Gary chose to ship them on 2026-09-24 knowing that
// (issue #1111). seasons.json holds the full provenance.
//
// NOT SHIPPED: .scratch/top-prospects-history/ba-non-debuts.json. Those players
// never reached the majors, so Retrosheet and Chadwick gave them no MLBAM id,
// and an entry with no id cannot join a player page.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'
import { buildProspectRankHistory } from './lib/prospect-rank-history.mjs'

// The sources that ship. Remove an entry to drop that source everywhere.
const INCLUDE_SOURCES = ['baseball-america', 'mlb-pipeline']

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pullDir = join(root, '.scratch', 'top-prospects-history')

const outArg = process.argv.indexOf('--out')
const out = outArg > 0 ? process.argv[outArg + 1] : join(root, 'public', 'data', 'prospect-rank-history.json')

const rows = JSON.parse(await readFile(join(pullDir, 'rows.json'), 'utf8'))
const seasons = JSON.parse(await readFile(join(pullDir, 'seasons.json'), 'utf8'))

const history = buildProspectRankHistory({ rows, seasons, includeSources: INCLUDE_SOURCES })
await writeJsonAtomic(out, history)

const players = Object.keys(history.players).length
const count = Object.values(history.players).reduce((n, list) => n + list.length, 0)
console.log(`prospect-rank-history: ${count} rows, ${players} players -> ${out}`)
