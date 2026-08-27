// Joins the four historical contract CSVs (scripts/data/contracts/*.csv) to
// the row-to-player crosswalk that scripts/gen-contracts-identity.mjs wrote,
// and emits the two shapes a surface actually reads:
//
//   public/data/contracts-history/player/{00..99}.json
//     One file per `mlbId % 100` bucket (src/lib/shardKey.js's shardKey100,
//     the same arithmetic src/api/person/contracts.js recomputes from the id
//     alone), so a player page downloads one small shard, never the league.
//     { meta, players: { [mlbId]: [ { rowKey, sourceFile, season, teamId,
//                                     terms, confidence }, ... ] } }
//
//   public/data/contracts-history/terms/{sourceFile}-{bucket}.json
//     bucket = Math.floor(csvRowIndex / 500). A flat
//     { [rowKey]: { season, teamId, terms } } map covering EVERY source row,
//     resolved or not -- the player shards can only carry a row that has a
//     player, and the /admin review queue plus the search index both need the
//     dollar terms of rows that have no id yet. The file IS the rowKey map:
//     no meta key, no wrapper, so a reader can Object.assign several buckets
//     into one lookup.
//
//     `season` and `teamId` ride along rather than living only in the player
//     shard because of the APPENDED row: when an admin override newly assigns
//     a row to a player, that player's shard was written before the override
//     existed and does not carry it, so the terms bucket is the ONLY per-rowKey
//     file the reader fetches for it -- and the override record itself carries
//     neither field. Bare terms would leave an appended row with no season,
//     unable to take part in the reader's season-sorted list at all.
//
// WHY the terms live in the CSVs and only in the CSVs: identity/*.json is a
// crosswalk, deliberately carrying no money at all. This script is the only
// place the two halves meet.
//
// `terms` is a PER-SOURCE object using that source's own column names. There
// is no unified schema on purpose -- an extension's `guarantee`/`aav`, an
// arbitration case's `player_request`/`club_offer` and a salary row's `salary`
// are different facts, and flattening them into one "amount" field would be
// this script inventing a figure. Nothing here is computed, estimated,
// summed or annualized: a cell is passed through as stated, or it is absent.
// ADR-0052 governs the money surfaces and it is a stated-figures rule.
//
// The arbitration source's `note` column is passed through under its own name
// because in 1,440 of 2,420 rows it holds a dollar figure -- one that differs
// from `settled_salary` wherever both are numeric. Its meaning is not
// documented by the source, so it is carried verbatim and NOT interpreted;
// a surface must not label it until someone establishes what it is.
//
// A row is filed under a player only at confidence `exact` or `fuzzy`. Fuzzy
// is trustworthy by ADR-0066's own rule -- `ambiguous`/`unresolved` are the
// two that stay out, and those are exactly the rows the review page queues.
//
// meta carries NO source / sourceUrl / attribution field, unlike the Fever
// shards in public/data/player-contracts/. That omission is deliberate: this
// is Gary's own dataset, so there is no third party to credit.
//
// Run by hand: node scripts/gen-contracts-shards.mjs
// Run scripts/gen-contracts-identity.mjs FIRST -- this script reads its output
// and never re-derives an id itself.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { parseCsv } from './lib/csv.mjs'
import { readJsonOr, writeShards } from './lib/io.js'
import { shardKey100 } from '../src/lib/shardKey.js'

const here = dirname(fileURLToPath(import.meta.url))
const sourceDir = join(here, 'data', 'contracts')
const identityDir = join(here, '..', 'public', 'data', 'contracts-history', 'identity')
const playerDir = join(here, '..', 'public', 'data', 'contracts-history', 'player')
const termsDir = join(here, '..', 'public', 'data', 'contracts-history', 'terms')

// 500 rows a bucket keeps salaries.csv's 27k rows at ~55 files instead of one
// multi-megabyte map, while staying far from the per-row-file end where the
// directory itself becomes the cost.
const BUCKET_SIZE = 500

// Which columns of each source carry the deal: its money, and the term span
// that money is stated over (a guarantee with no year count is unreadable).
// Source order matches gen-contracts-identity.mjs's match order.
const TERM_COLUMNS = {
  extensions: ['years', 'guarantee', 'aav', 'option', 'first_year', 'final_year'],
  arbitration: ['prior_salary', 'player_request', 'club_offer', 'settled_salary', 'note'],
  free_agency: ['years', 'guarantee', 'aav', 'term', 'option', 'opt_out'],
  salaries: ['salary'],
}
const SOURCES = Object.keys(TERM_COLUMNS)

// A cell is a number when it is written as one, a string when it is not, and
// absent when it is blank. The sources mix the three inside a single column --
// arbitration's `club_offer` is a dollar figure on 199 rows and the word
// "non-tendered" on 230 -- and coercing "non-tendered" to 0, or blank to 0,
// would state a figure the source does not. Absent means "not stated".
function cell(value) {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return undefined
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed
}

function termsFor(sourceFile, row) {
  const terms = {}
  for (const column of TERM_COLUMNS[sourceFile]) {
    const value = cell(row[column])
    if (value !== undefined) terms[column] = value
  }
  return terms
}

// Newest deal first, which is the order every money surface wants. rowKey is
// the last tie-break so a re-run is byte-identical: two rows of the same
// source and season otherwise sort by whatever the join happened to yield.
function rowIndex(rowKey) {
  return Number(rowKey.slice(rowKey.indexOf('#') + 1))
}
function compareRows(a, b) {
  const seasonA = Number.isFinite(a.season) ? a.season : -Infinity
  const seasonB = Number.isFinite(b.season) ? b.season : -Infinity
  if (seasonA !== seasonB) return seasonB - seasonA
  if (a.sourceFile !== b.sourceFile) return a.sourceFile < b.sourceFile ? -1 : 1
  return rowIndex(a.rowKey) - rowIndex(b.rowKey)
}

async function loadIdentity(sourceFile) {
  const rows = await readJsonOr(join(identityDir, `${sourceFile}.json`), null)
  if (!rows) {
    throw new Error(
      `Missing ${sourceFile}.json in ${identityDir} -- run scripts/gen-contracts-identity.mjs first`,
    )
  }
  return new Map(rows.map((row) => [row.rowKey, row]))
}

async function main() {
  const players = new Map() // mlbId -> row[]
  const buckets = new Map() // `${sourceFile}-${bucket}` -> { [rowKey]: terms }
  const perSource = []
  const orphans = []
  let totalRows = 0
  let filedRows = 0

  for (const sourceFile of SOURCES) {
    const csvRows = parseCsv(await readFile(join(sourceDir, `${sourceFile}.csv`), 'utf8'))
    const identity = await loadIdentity(sourceFile)
    const counts = { exact: 0, fuzzy: 0, ambiguous: 0, unresolved: 0 }

    for (let i = 0; i < csvRows.length; i++) {
      const rowKey = `${sourceFile}#${i}`
      const terms = termsFor(sourceFile, csvRows[i])
      const ident = identity.get(rowKey)
      if (!ident) orphans.push(rowKey)

      // The crosswalk's `rawTeamCode` is already a resolved teamId (or null
      // where the source carries no usable club -- every salaries row, and the
      // handful of free-agency rows whose old club had left MLB). No team is
      // ever inferred here; team-keyed output is out of scope. Both fields are
      // the SAME values the player-shard row below carries, computed once so
      // the two shapes can never disagree about a row.
      const season = ident?.season ?? null
      const teamId = ident?.rawTeamCode ?? null

      const bucketName = `${sourceFile}-${Math.floor(i / BUCKET_SIZE)}`
      if (!buckets.has(bucketName)) buckets.set(bucketName, {})
      buckets.get(bucketName)[rowKey] = { season, teamId, terms }

      if (!ident) continue
      counts[ident.confidence] = (counts[ident.confidence] ?? 0) + 1
      const trustworthy = ident.confidence === 'exact' || ident.confidence === 'fuzzy'
      if (!trustworthy || ident.mlbId == null) continue

      const id = String(ident.mlbId)
      if (!players.has(id)) players.set(id, [])
      players.get(id).push({ rowKey, sourceFile, season, teamId, terms, confidence: ident.confidence })
      filedRows++
    }

    totalRows += csvRows.length
    perSource.push({ sourceFile, rows: csvRows.length, counts })
  }

  for (const rows of players.values()) rows.sort(compareRows)

  const generatedAt = new Date().toISOString()
  const shards = new Map() // shardKey -> { [mlbId]: row[] }
  for (const [id, rows] of players) {
    const key = shardKey100(id)
    if (!shards.has(key)) shards.set(key, {})
    shards.get(key)[id] = rows
  }

  const playerEntries = [...shards.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, byPlayer]) => {
      const bySource = {}
      let rows = 0
      for (const list of Object.values(byPlayer)) {
        rows += list.length
        for (const row of list) bySource[row.sourceFile] = (bySource[row.sourceFile] ?? 0) + 1
      }
      return [key, { meta: { generatedAt, shard: key, players: Object.keys(byPlayer).length, rows, bySource }, players: byPlayer }]
    })

  const termEntries = [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))

  const playerResult = await writeShards(playerDir, playerEntries)
  const termResult = await writeShards(termsDir, termEntries)

  console.log('Row-to-player join:')
  for (const { sourceFile, rows, counts } of perSource) {
    const pct = (n) => ((100 * n) / rows).toFixed(1)
    const filed = counts.exact + counts.fuzzy
    console.log(
      `  ${sourceFile}: ${rows} rows -- filed ${filed} (${pct(filed)}%: exact ${counts.exact}, fuzzy ${counts.fuzzy}), ` +
        `held back ${counts.ambiguous + counts.unresolved} (ambiguous ${counts.ambiguous}, unresolved ${counts.unresolved})`,
    )
  }
  if (orphans.length > 0) {
    console.log(`  WARNING: ${orphans.length} CSV rows have no crosswalk entry (e.g. ${orphans.slice(0, 3).join(', ')})`)
    console.log('  -- the CSVs and identity/*.json disagree on row count; re-run gen-contracts-identity.mjs')
  }

  console.log(
    `\nWrote ${playerResult.written} player shards (swept ${playerResult.swept}): ` +
      `${players.size} players, ${filedRows} rows -> public/data/contracts-history/player/`,
  )
  console.log(
    `Wrote ${termResult.written} term buckets (swept ${termResult.swept}): ` +
      `${totalRows} rows, ${BUCKET_SIZE} per bucket -> public/data/contracts-history/terms/`,
  )
}

await main()
