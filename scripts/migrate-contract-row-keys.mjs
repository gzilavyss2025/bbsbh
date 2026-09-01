// Moves the ADR-0067 contract-identity overrides from the old POSITIONAL rowKey
// (`salaries#24340` — row 24340 of salaries.csv) to the CONTENT key a row
// carries now (`salaries#3f0c7a1e58d4b269`, ADR-0069).
//
// These are live, human-made decisions. A reviewer sat down and said "this row
// is Vicente Padilla, not whoever the matcher picked". There is no rebuild that
// can recreate them and no second copy anywhere. So this script is written to
// be READ before it is run:
//
//   * It is a DRY RUN unless you pass --apply. The dry run writes nothing.
//   * It prints, for every override, the old key, the row and player that key
//     resolves to now, the new key, and the player the new key resolves to.
//   * A correction it cannot map is REPORTED and left alone. It is never
//     dropped, never guessed at, and --apply refuses to run while one is
//     outstanding unless you say so in as many words.
//   * `correctedBy` and `correctedAt` are copied VERBATIM. That is why the
//     write goes to Redis directly and not through PATCH /api/contract-identity:
//     mergeOverrides re-stamps both fields with the caller's own identity, which
//     would erase who actually made each decision and when.
//
// THE MAPPING, and its one assumption. A positional key means "row N of this
// file as it stood when the override was written". This script reads row N of
// the file as it stands NOW. If the CSV has not changed since, that is the same
// row and the migration is exact. If rows were added or removed in between, it
// is not, and no amount of care here can recover the original — that
// irreversibility is the whole reason the key stopped being positional. What
// this script can do is show the evidence and refuse to guess, which is what
// the cross-check below is for.
//
// THE CROSS-CHECK. An override says who a row really belongs to, so the name on
// the CSV row and the name of the corrected player should be recognisably the
// same man. A reviewer correcting a misspelling ("Padillia, Vicente" ->
// Vicente Padilla) leaves a near match. A shifted key leaves an unrelated name,
// which is exactly the shape the incident behind ADR-0069 produced: the probe
// that found it read `salaries#24340` as "Giles, Marcus" against a CSV row for
// "Hernandez, Adrian". Every override whose two names do not resemble each
// other is flagged for a human, not migrated on this script's say-so.
//
// Usage:
//   node scripts/migrate-contract-row-keys.mjs                 # dry run
//   node scripts/migrate-contract-row-keys.mjs --receipt=x.json # dry run + receipt
//   node scripts/migrate-contract-row-keys.mjs --apply          # writes
//
// Flags:
//   --apply              Perform the write. Without it nothing is written.
//   --receipt=PATH       Write the full old->new plan as JSON. Written on a dry
//                        run too, and required reading before an --apply.
//   --source=api|redis   Where to read the current overrides from. Defaults to
//                        redis when credentials are set, api otherwise.
//   --base=URL           Origin for --source=api. Defaults to the production
//                        site.
//   --allow-flagged      Migrate rows whose two names do not resemble each
//                        other. Read every one of them first.
//   --skip-unmappable    Migrate everything mappable and leave the rest in
//                        place under their old keys.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

import { parseArgs } from './lib/args.mjs'
import { parseCsv } from './lib/csv.mjs'
import { nameSimilarity } from './lib/contract-identity-match.mjs'
import { readJsonOr } from './lib/io.js'
import {
  CONTENT_ROW_KEY_RE,
  CONTRACT_SOURCES,
  LEGACY_ROW_KEY_RE,
  contractRowKeys,
} from './lib/contract-row-key.mjs'
import { getRedis, redisConfigFromEnv } from '../api/_lib/redis.js'

const here = dirname(fileURLToPath(import.meta.url))
const sourceDir = join(here, 'data', 'contracts')
const poolDir = join(here, '..', 'public', 'data', 'contracts-history', 'season-players')
const identityDir = join(here, '..', 'public', 'data', 'contracts-history', 'identity')

const OVERRIDES_KEY = 'contracts:identity:overrides'
const DEFAULT_BASE = 'https://www.tallybb.com'

// Verdicts. Only `ok` and `flagged` carry a new key; the rest carry none, and
// the summary counts every one of them so nothing leaves this script unaccounted
// for.
const OK = 'ok'
const FLAGGED = 'flagged'
const ALREADY = 'already-content-keyed'
const UNKNOWN_SOURCE = 'unmappable: unknown source file'
const OUT_OF_RANGE = 'unmappable: row index past the end of the CSV'
const BAD_SHAPE = 'unmappable: unrecognised key shape'
const COLLISION = 'unmappable: the new key is already taken by a different override'
const NOT_IN_CROSSWALK = 'unmappable: the new key is in no crosswalk file -- regenerate first'

// ---------------------------------------------------------------- name checks

// THE THRESHOLD, and why it is the matcher's own scorer rather than a new one.
// nameSimilarity is what scripts/lib/contract-identity-match.mjs already uses to
// decide whether two names are the same man: it strips diacritics, forgives a
// generational suffix, knows the nickname pairs, and falls back to an edit
// distance scaled by name length. Reusing it means this cross-check agrees with
// the pipeline by construction instead of drifting from it.
//
// Measured against the real store: all 162 overrides score 0.875 or better,
// including the 49 that correct a misspelling in the source. The lowest is
// "Palmiero, Rafael" against Rafael Palmeiro at 0.875; LoDuca/Lo Duca,
// DeLosSantos/De Los Santos, Padillia/Padilla, Jiminez/Jimenez and
// Chrstiansen/Christiansen all sit above it. Two unrelated names score far
// below: the pair the original incident produced, "Giles, Marcus" against
// "Hernandez, Adrian", scores 0.235. The threshold sits in that gap.
const SAME_PERSON_SCORE = 0.8

function looksLikeSamePerson(csvName, idName) {
  return nameSimilarity(csvName, idName) >= SAME_PERSON_SCORE
}

// --------------------------------------------------------------- loading data

async function loadSources() {
  const sources = {}
  for (const source of CONTRACT_SOURCES) {
    const rows = parseCsv(await readFile(join(sourceDir, `${source}.csv`), 'utf8'))
    // The crosswalk is read as well as the CSV, so the report can resolve the
    // NEW key independently rather than asserting where it lands. If the static
    // files are stale relative to the CSVs, that shows up here as a key in no
    // crosswalk file, and the migration stops rather than writing keys no
    // reader can join.
    const crosswalk = await readJsonOr(join(identityDir, `${source}.json`), null)
    if (!crosswalk) {
      throw new Error(`Missing identity/${source}.json -- run scripts/gen-contracts-identity.mjs first`)
    }
    sources[source] = {
      rows,
      keys: contractRowKeys(source, rows),
      crosswalk: new Map(crosswalk.map((row) => [row.rowKey, row])),
    }
  }
  return sources
}

// id -> "Last, First", from the season pools gen-contracts-season-players.mjs
// wrote. Only used to print a name beside an id and to run the cross-check.
async function loadNames() {
  const names = new Map()
  for (let season = 1991; season <= 2026; season++) {
    const pool = await readJsonOr(join(poolDir, `${season}.json`), null)
    if (!pool) continue
    for (const person of pool) if (!names.has(person.id)) names.set(person.id, person.lastFirstName)
  }
  return names
}

function hashFromReply(reply) {
  if (!reply || typeof reply !== 'object') return {}
  if (!Array.isArray(reply)) return reply
  const out = {}
  for (let i = 0; i + 1 < reply.length; i += 2) out[String(reply[i])] = reply[i + 1]
  return out
}

async function loadOverridesFromRedis(redis) {
  const stored = hashFromReply(await redis.hgetall(OVERRIDES_KEY))
  const out = {}
  for (const [key, raw] of Object.entries(stored)) {
    // Parsed here, not sanitized: this script must SEE a malformed record to
    // report it, where the endpoint's job is to refuse to serve one.
    if (typeof raw !== 'string') {
      out[key] = raw
      continue
    }
    try {
      out[key] = JSON.parse(raw)
    } catch {
      out[key] = { __unparseable: raw }
    }
  }
  return out
}

async function loadOverridesFromApi(base) {
  const res = await fetch(`${base}/api/contract-identity`, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`GET ${base}/api/contract-identity answered ${res.status}`)
  return (await res.json())?.overrides ?? {}
}

// ------------------------------------------------------------------- planning

function planOne(rowKey, override, sources, names, claimed) {
  const csvNameOf = (row) => row?.player ?? ''
  const idName = override?.mlbId == null ? null : (names.get(override.mlbId) ?? null)

  if (CONTENT_ROW_KEY_RE.test(rowKey)) {
    return { rowKey, verdict: ALREADY, newKey: null, override, idName }
  }

  const legacy = LEGACY_ROW_KEY_RE.exec(rowKey)
  if (!legacy) return { rowKey, verdict: BAD_SHAPE, newKey: null, override, idName }

  const [, sourceFile, digits] = legacy
  const source = sources[sourceFile]
  if (!source) return { rowKey, verdict: UNKNOWN_SOURCE, newKey: null, override, idName }

  const index = Number(digits)
  if (!(index >= 0 && index < source.rows.length)) {
    return {
      rowKey,
      verdict: OUT_OF_RANGE,
      newKey: null,
      override,
      idName,
      detail: `index ${index}, ${sourceFile}.csv has ${source.rows.length} rows`,
    }
  }

  const row = source.rows[index]
  const newKey = source.keys[index]
  const csvName = csvNameOf(row)

  if (claimed.has(newKey)) {
    return { rowKey, verdict: COLLISION, newKey, override, idName, row, csvName }
  }

  const resolved = source.crosswalk.get(newKey)
  if (!resolved) {
    return { rowKey, verdict: NOT_IN_CROSSWALK, newKey, override, idName, row, csvName }
  }

  // A dismissed row carries no id, so there is no name to check it against. It
  // is mapped on row position alone, and the report says so rather than
  // implying a confirmation it did not get.
  const checkable = override?.mlbId != null && idName != null
  const verdict = !checkable || looksLikeSamePerson(csvName, idName) ? OK : FLAGGED
  return { rowKey, verdict, newKey, override, idName, row, csvName, checkable, resolved }
}

function plan(overrides, sources, names) {
  const claimed = new Set()
  const entries = []
  // Sorted so two runs print the same order and a receipt diffs cleanly.
  for (const rowKey of Object.keys(overrides).sort()) {
    const entry = planOne(rowKey, overrides[rowKey], sources, names, claimed)
    if (entry.newKey && (entry.verdict === OK || entry.verdict === FLAGGED)) claimed.add(entry.newKey)
    entries.push(entry)
  }
  return entries
}

// -------------------------------------------------------------------- report

function describeRow(row, sourceFile) {
  if (!row) return '(no row)'
  const season = row.year ?? row.season ?? row.signed_date?.slice(0, 4) ?? '?'
  const money = row.salary ?? row.guarantee ?? row.settled_salary ?? ''
  return `${sourceFile} ${season} "${row.player}"${money ? ` ${money}` : ''}`
}

function report(entries) {
  console.log(`Read ${entries.length} stored overrides.\n`)
  for (const entry of entries) {
    const sourceFile = entry.rowKey.split('#')[0]
    const who = entry.override?.mlbId == null
      ? entry.override?.dismissed
        ? 'dismissed, no id'
        : 'no id'
      : `${entry.override.mlbId} "${entry.idName ?? 'name not in the season pools'}"`

    if (entry.verdict === OK || entry.verdict === FLAGGED) {
      const mark = entry.verdict === OK ? ' ' : '!'
      console.log(`${mark} ${entry.rowKey}`)
      console.log(`    now  ${describeRow(entry.row, sourceFile)}`)
      console.log(`    ->   ${entry.newKey}`)
      // Read back through the regenerated crosswalk, not restated from the CSV
      // row above: this line is the independent confirmation that the new key
      // lands on the row the old key named.
      console.log(
        `    then ${sourceFile} ${entry.resolved.season} "${entry.resolved.rawName}"` +
          ` -- matcher says ${entry.resolved.mlbId ?? 'no id'} (${entry.resolved.confidence})`,
      )
      console.log(`    correction: ${who}${entry.checkable === false ? '  (no id to cross-check)' : ''}`)
      if (entry.verdict === FLAGGED) {
        console.log(`    FLAGGED: "${entry.csvName}" and "${entry.idName}" are not recognisably the same man`)
      }
    } else {
      console.log(`X ${entry.rowKey}`)
      console.log(`    ${entry.verdict}${entry.detail ? ` — ${entry.detail}` : ''}`)
      console.log(`    correction: ${who} — LEFT IN PLACE, nothing was changed`)
    }
    console.log('')
  }

  const counts = {}
  for (const entry of entries) counts[entry.verdict] = (counts[entry.verdict] ?? 0) + 1
  console.log('Summary')
  for (const [verdict, n] of Object.entries(counts).sort()) console.log(`  ${n}  ${verdict}`)
  return counts
}

// ---------------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apply = args.apply === true
  const configured = redisConfigFromEnv() != null
  const from = args.source ?? (configured ? 'redis' : 'api')

  if (from !== 'redis' && from !== 'api') throw new Error(`--source must be "redis" or "api", got "${from}"`)
  if (apply && from !== 'redis') {
    throw new Error('--apply needs --source=redis and Redis credentials: the public endpoint cannot write.')
  }

  const redis = from === 'redis' ? getRedis({ automaticDeserialization: false }) : null
  if (from === 'redis' && !redis) {
    throw new Error(
      'No Redis credentials in the environment. Set UPSTASH_REDIS_REST_URL/TOKEN (or the KV_REST_API_* pair), or pass --source=api for a read-only dry run.',
    )
  }

  const base = args.base ?? DEFAULT_BASE
  console.log(`Reading overrides from ${from === 'redis' ? 'Redis' : `${base}/api/contract-identity`}`)
  if (from === 'api') {
    console.log('  NOTE: the public endpoint only serves keys its validator recognises. A malformed')
    console.log('  record would be invisible here. Re-run with --source=redis before applying.\n')
  }

  const overrides = from === 'redis' ? await loadOverridesFromRedis(redis) : await loadOverridesFromApi(base)
  const [sources, names] = await Promise.all([loadSources(), loadNames()])
  const entries = plan(overrides, sources, names)
  const counts = report(entries)

  if (args.receipt) {
    await writeFile(
      String(args.receipt),
      `${JSON.stringify(
        entries.map((e) => ({
          oldKey: e.rowKey,
          newKey: e.newKey,
          verdict: e.verdict,
          csvName: e.csvName ?? null,
          correctedTo: e.override?.mlbId ?? null,
          correctedToName: e.idName ?? null,
          value: e.override ?? null,
        })),
        null,
        2,
      )}\n`,
      'utf8',
    )
    console.log(`\nReceipt -> ${args.receipt}`)
  }

  const flagged = entries.filter((e) => e.verdict === FLAGGED)
  const unmappable = entries.filter(
    (e) => e.verdict !== OK && e.verdict !== FLAGGED && e.verdict !== ALREADY,
  )

  if (!apply) {
    console.log('\nDRY RUN — nothing was written. Re-run with --apply to migrate.')
    if (flagged.length) console.log(`Read the ${flagged.length} flagged row(s) above first.`)
    return
  }

  if (flagged.length && args['allow-flagged'] !== true) {
    throw new Error(
      `${flagged.length} override(s) are flagged: the corrected player does not resemble the row's name. Read them, then re-run with --allow-flagged if they are right.`,
    )
  }
  if (unmappable.length && args['skip-unmappable'] !== true) {
    throw new Error(
      `${unmappable.length} override(s) cannot be mapped and would stay under their old keys. Re-run with --skip-unmappable to migrate the rest and leave them in place.`,
    )
  }

  const movable = entries.filter((e) => e.newKey && (e.verdict === OK || e.verdict === FLAGGED))
  if (movable.length === 0) {
    console.log('\nNothing to migrate.')
    return
  }

  // One transaction: every new key written and every old key removed together,
  // so an interrupted run cannot leave a correction under neither name.
  const toStore = Object.fromEntries(movable.map((e) => [e.newKey, JSON.stringify(e.override)]))
  const toDelete = movable.map((e) => e.rowKey)
  const tx = redis.multi()
  tx.hset(OVERRIDES_KEY, toStore)
  tx.hdel(OVERRIDES_KEY, ...toDelete)
  await tx.exec()

  console.log(`\nMigrated ${movable.length} override(s).`)
  console.log(`  written under content keys: ${movable.length}`)
  console.log(`  old positional keys removed: ${toDelete.length}`)
  if (unmappable.length) console.log(`  left in place, unmapped: ${unmappable.length}`)
  console.log(`\n${counts[ALREADY] ?? 0} override(s) were already content-keyed and were not touched.`)
}

await main()
