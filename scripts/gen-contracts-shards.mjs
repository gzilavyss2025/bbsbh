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
//     bucket = src/lib/shardKey.js's termsBucketKey, a slice of the rowKey's
//     own content hash. A flat
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
import { shardKey100, termsBucketKey, TERMS_BUCKET_COUNT } from '../src/lib/shardKey.js'
import { contractRowKeys, rowSortValue } from './lib/contract-row-key.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const sourceDir = join(here, 'data', 'contracts')
const identityDir = join(here, '..', 'public', 'data', 'contracts-history', 'identity')
const playerDir = join(here, '..', 'public', 'data', 'contracts-history', 'player')
const termsDir = join(here, '..', 'public', 'data', 'contracts-history', 'terms')

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

// Newest deal first, which is the order every money surface wants, and the
// order a reader inherits: src/api/contractsHistory.js re-sorts on season
// alone, and a stable sort leaves everything below season exactly as this
// comparator left it. So THIS is the display order.
//
// Below season sits the row's own content -- the newer signing, the larger
// figure (contract-row-key.mjs's rowSortValue). It used to be the rowKey's
// numeric index, which a content key does not have. Reaching for the index
// anyway would not have failed loudly: `Number()` of a hash is NaN, and the
// language reads a NaN comparator result as "these two are equal", so 220 rows
// across 110 player-seasons would have quietly reordered with every test still
// green. rowKey is the last tie-break, so a re-run stays byte-identical even
// where two rows state the same figure.
function compareRows(a, b) {
  const seasonA = Number.isFinite(a.season) ? a.season : -Infinity
  const seasonB = Number.isFinite(b.season) ? b.season : -Infinity
  if (seasonA !== seasonB) return seasonB - seasonA
  if (a.sourceFile !== b.sourceFile) return a.sourceFile < b.sourceFile ? -1 : 1
  if (a.sortValue !== b.sortValue) return b.sortValue - a.sortValue
  return a.rowKey < b.rowKey ? -1 : a.rowKey > b.rowKey ? 1 : 0
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
    // Recomputed from the CSV, never read off the crosswalk, so the two can
    // never quietly disagree about which row is which: if the CSV changed
    // since gen-contracts-identity.mjs last ran, the join misses and the
    // orphan warning below names it.
    const rowKeys = contractRowKeys(sourceFile, csvRows)
    const identity = await loadIdentity(sourceFile)
    const counts = { exact: 0, fuzzy: 0, ambiguous: 0, unresolved: 0 }

    for (let i = 0; i < csvRows.length; i++) {
      const rowKey = rowKeys[i]
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

      // A key this script just minted must always name a bucket. If it does
      // not, the writer and the reader have drifted apart, and shipping the
      // file anyway would hide a row's money behind a name no reader computes.
      const bucketName = termsBucketKey(rowKey)
      if (!bucketName) throw new Error(`No terms bucket for rowKey "${rowKey}" -- src/lib/shardKey.js and the key minter disagree`)
      if (!buckets.has(bucketName)) buckets.set(bucketName, {})
      buckets.get(bucketName)[rowKey] = { season, teamId, terms }

      if (!ident) continue
      counts[ident.confidence] = (counts[ident.confidence] ?? 0) + 1
      const trustworthy = ident.confidence === 'exact' || ident.confidence === 'fuzzy'
      if (!trustworthy || ident.mlbId == null) continue

      const id = String(ident.mlbId)
      if (!players.has(id)) players.set(id, [])
      // `sortValue` orders the list below and is stripped before writing --
      // it is derivable from the CSV and has no reader.
      players.get(id).push({ rowKey, sourceFile, season, teamId, terms, confidence: ident.confidence, sortValue: rowSortValue(sourceFile, csvRows[i]) })
      filedRows++
    }

    totalRows += csvRows.length
    perSource.push({ sourceFile, rows: csvRows.length, counts })
  }

  for (const rows of players.values()) {
    rows.sort(compareRows)
    for (const row of rows) delete row.sortValue
  }

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
  const bucketPlan = Object.entries(TERMS_BUCKET_COUNT)
    .map(([source, count]) => `${source} ${count}`)
    .join(', ')
  console.log(
    `Wrote ${termResult.written} term buckets (swept ${termResult.swept}): ` +
      `${totalRows} rows over ${bucketPlan} -> public/data/contracts-history/terms/`,
  )
}

await main()
