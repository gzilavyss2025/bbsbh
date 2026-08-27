// Flattens the four crosswalk files scripts/gen-contracts-identity.mjs wrote
// into ONE lookup list over every historical contract row:
//
//   public/data/contracts-history/search-index.json
//     [ { rowKey, sourceFile, rawName, season, rawTeamCode, mlbId,
//         confidence }, ... ]
//
// Seven fields, and specifically NOT `candidates` -- the near-miss candidate
// list is what makes identity/salaries.json 8 MB on its own, and it is only
// ever read by the /admin review queue, which already has pending.json. A
// name search wants the name, the year, the club and the id it resolved to.
//
// The array is FLAT and in crosswalk order (extensions, arbitration,
// free_agency, salaries; row order within each), not grouped by player or by
// name. A row with no id -- `ambiguous` or `unresolved` -- is still listed,
// carrying mlbId null: an unresolved row is a real contract that still needs
// to be findable by the name the source printed, and its `confidence` is what
// tells a caller not to trust a join through it.
//
// Carries no dollar terms. Those live only in the CSVs and in the
// terms/ buckets scripts/gen-contracts-shards.mjs writes, keyed on the same
// rowKey this file returns.
//
// Run by hand: node scripts/gen-contracts-search-index.mjs
// Run scripts/gen-contracts-identity.mjs FIRST -- this file is a projection of
// its output and derives nothing of its own.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stat } from 'node:fs/promises'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'

const here = dirname(fileURLToPath(import.meta.url))
const identityDir = join(here, '..', 'public', 'data', 'contracts-history', 'identity')
const outPath = join(here, '..', 'public', 'data', 'contracts-history', 'search-index.json')

const SOURCES = ['extensions', 'arbitration', 'free_agency', 'salaries']

async function loadIdentity(sourceFile) {
  const rows = await readJsonOr(join(identityDir, `${sourceFile}.json`), null)
  if (!rows) {
    throw new Error(
      `Missing ${sourceFile}.json in ${identityDir} -- run scripts/gen-contracts-identity.mjs first`,
    )
  }
  return rows
}

async function main() {
  const index = []
  for (const sourceFile of SOURCES) {
    const rows = await loadIdentity(sourceFile)
    for (const row of rows) {
      index.push({
        rowKey: row.rowKey,
        sourceFile: row.sourceFile,
        rawName: row.rawName,
        season: row.season,
        // Already a resolved teamId in the crosswalk, or null where the source
        // carries no usable club (every salaries row has no club column at all).
        rawTeamCode: row.rawTeamCode ?? null,
        mlbId: row.mlbId ?? null,
        confidence: row.confidence,
      })
    }
    console.log(`  ${sourceFile}: ${rows.length} rows`)
  }

  await writeJsonAtomic(outPath, index)

  const { size } = await stat(outPath)
  const resolved = index.filter((row) => row.mlbId != null).length
  const named = new Set(index.map((row) => row.rawName)).size
  console.log(
    `\nWrote search-index.json: ${index.length} rows, ${named} distinct raw names, ` +
      `${resolved} carrying an mlbId (${((100 * resolved) / index.length).toFixed(1)}%)`,
  )
  console.log(`  ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`)
}

await main()
