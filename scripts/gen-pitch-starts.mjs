// Hand-run, NOT on the nightly cron: fills one earlier season of the per-start pitch store
// (public/data/pitch-arsenal-starts/{season}/), the one the Game Log's pitch-mix bar reads (ADR-0111).
// History does not change, so there is no SQLite and no frozen dump (gen-pitch-arsenal.mjs keeps 2026).
//   node scripts/gen-pitch-starts.mjs --season=2020            # sweep; run again to resume
//   node scripts/gen-pitch-starts.mjs --season=2020 --verify   # the gate that puts the season in seasons.json
// MLB only. The shards hold the same numbers foldStarts and mphBuckets give from the database.
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getJson } from './lib/statsapi.mjs'
import { bucketsOf, readJsonOr, writeSeasons, writeShards } from './lib/io.js'
import { parseArgs } from './lib/args.mjs'
import { POSTSEASON_GAME_TYPES } from './lib/records/postseason.mjs'
import { aggregateGamePitchTypes } from './gen-pitch-arsenal.mjs'
import { PITCH_TYPES } from '../src/lib/pitch/pitchTypes.js'
import { shardKey100 } from '../src/lib/shardKey.js'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'pitch-arsenal-starts')
const CHECKPOINT_EVERY = 100
const CONCURRENCY = 8
const KNOWN = new Set(PITCH_TYPES.map((t) => t.code))

// --- pure parts (exported for tests) -----------------------------------------

// One feed to `{ pit: { pitcherId: { code: n } }, mph: { pitcherId: { code: tenths } } }`. The stands are
// added together; a code with no speed gets no mph entry. Codes sorted, as the database orders them.
export function rowsOfFeed(feed) {
  const pit = {}
  const mph = {}
  for (const [id, p] of aggregateGamePitchTypes(feed)) {
    const sums = {}
    for (const [key, t] of p.types) {
      const s = (sums[key.split(':')[0]] ??= { n: 0, vSum: 0, vN: 0 })
      s.n += t.pitches
      s.vSum += t.velocitySum
      s.vN += t.velocityN
    }
    for (const code of Object.keys(sums).sort()) {
      const { n, vSum, vN } = sums[code]
      ;(pit[id] ??= {})[code] = n
      if (vN) (mph[id] ??= {})[code] = Math.round((vSum / vN) * 10)
    }
  }
  return { pit, mph }
}

export function addGame(store, gamePk, { pit, mph }) {
  for (const [part, rows] of [['pit', pit], ['mph', mph]]) {
    for (const [id, codes] of Object.entries(rows)) ((store[part][id] ??= {})[gamePk] = codes)
  }
}

const gamesOf = (store) => new Set(Object.values(store.pit).flatMap(Object.keys))

// Resume: the games the store does not hold yet.
export const pendingGames = (pks, store) => pks.filter((pk) => !gamesOf(store).has(String(pk)))

// The same entries writeStarts gives: the mix shards, then the speed shards named NN.mph.
export const shardsOf = (season, { pit, mph }) => [
  ...bucketsOf({ season }, pit, {}),
  ...bucketsOf({ season }, mph, {}, 'mph').map(([k, b]) => [`${k}.mph`, b]),
]

// Check 1: at least 99% of the season's Final games have a row.
export function coverageVerdict(pks, store) {
  const have = gamesOf(store)
  const missing = pks.filter((pk) => !have.has(String(pk)))
  return { ok: pks.length > 0 && (pks.length - missing.length) * 100 >= pks.length * 99, total: pks.length, missing: missing.slice(0, 20) }
}

// Check 2: `pairs` is `[{ stored, box }]`, one per pitcher and game.
export function boxVerdict(pairs) {
  const near = pairs.filter((p) => Math.abs(p.stored - p.box) <= 3).length
  const sum = (k) => pairs.reduce((a, p) => a + p[k], 0)
  const pairsOk = near * 100 >= pairs.length * 95
  const totalOk = Math.abs(sum('stored') - sum('box')) * 100 <= sum('box')
  return { ok: pairs.length > 0 && pairsOk && totalOk, pairsOk, totalOk, near, n: pairs.length, stored: sum('stored'), box: sum('box') }
}

// Check 3: `counts` is `{ code: pitches }`. Unknown codes fail only above 2% of all pitches.
export function codesVerdict(counts) {
  const unknown = Object.fromEntries(Object.entries(counts).filter(([c]) => !KNOWN.has(c)))
  const sum = (o) => Object.values(o).reduce((a, n) => a + n, 0)
  return { ok: sum(unknown) * 100 <= sum(counts) * 2, unknown }
}

// --- IO ----------------------------------------------------------------------

async function readStore(dir) {
  const store = { pit: {}, mph: {} }
  for (const f of await readdir(dir).catch(() => [])) {
    const part = f.endsWith('.mph.json') ? 'mph' : /^\d\d\.json$/.test(f) ? 'pit' : null
    if (part) Object.assign(store[part], (await readJsonOr(join(dir, f), {}))[part])
  }
  return store
}

async function finalGames(season) {
  const url = `/api/v1/schedule?sportId=1&startDate=${season}-01-01&endDate=${season}-12-31&gameType=R,${POSTSEASON_GAME_TYPES}`
  const pks = []
  for (const d of (await getJson(url)).dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.status?.abstractGameState === 'Final' && d.date === g.officialDate && Number(g.season) === season) pks.push(g.gamePk)
    }
  }
  return pks
}

async function sweep(season, dir, store, pks) {
  const queue = pendingGames(pks, store)
  const failed = []
  let done = 0
  console.log(`${season}: ${pks.length} Final games, ${queue.length} to fetch`)
  const worker = async () => {
    for (let pk; (pk = queue.shift()) !== undefined;) {
      try {
        addGame(store, pk, rowsOfFeed(await getJson(`/api/v1.1/game/${pk}/feed/live`)))
      } catch (err) {
        console.error(`gamePk ${pk}: ${err.message}`)
        failed.push(pk)
      }
      if (++done % CHECKPOINT_EVERY === 0) {
        console.log(`${done} fetched, writing shards...`)
        await writeShards(dir, shardsOf(season, store))
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  if (Object.keys(store.pit).length) await writeShards(dir, shardsOf(season, store))
  if (failed.length) {
    console.error(`${failed.length} games failed, run the same command again: ${failed.join(',')}`)
    process.exitCode = 1
  }
}

async function verify(season, dir, store, pks) {
  const fails = []
  const cov = coverageVerdict(pks, store)
  if (!cov.ok) fails.push(`coverage: ${cov.total - cov.missing.length}/${cov.total} (first missing: ${cov.missing.join(',')})`)

  const sample = pks.filter((_, i) => i % Math.max(1, Math.floor(pks.length / 40)) === 0).slice(0, 40)
  const pairs = []
  for (const pk of sample) {
    const box = await getJson(`/api/v1/game/${pk}/boxscore`)
    for (const side of ['away', 'home']) {
      for (const pl of Object.values(box.teams?.[side]?.players ?? {})) {
        const n = pl.stats?.pitching?.numberOfPitches
        if (n > 0) pairs.push({ stored: Object.values(store.pit[pl.person.id]?.[pk] ?? {}).reduce((a, x) => a + x, 0), box: n })
      }
    }
  }
  const box = boxVerdict(pairs)
  if (!box.ok) fails.push(`box: ${box.near}/${box.n} pairs within 3 (need 95%), totals ${box.stored} vs ${box.box} (need 1%)`)

  const counts = {}
  for (const games of Object.values(store.pit)) for (const codes of Object.values(games)) for (const [c, n] of Object.entries(codes)) counts[c] = (counts[c] ?? 0) + n
  const codes = codesVerdict(counts)
  for (const [c, n] of Object.entries(codes.unknown)) console.log(`unknown code ${c}: ${n} pitches`)
  if (!codes.ok) fails.push('codes: unknown codes pass 2% of all pitches')

  for (const f of (await readdir(dir)).filter((x) => x.endsWith('.json'))) {
    const part = f.endsWith('.mph.json') ? 'mph' : 'pit'
    const bytes = (await stat(join(dir, f))).size
    if (bytes >= 60 * 1024) fails.push(`shards: ${f} is ${bytes} bytes`)
    for (const id of Object.keys(JSON.parse(await readFile(join(dir, f), 'utf8'))[part])) {
      if (shardKey100(id) !== f.slice(0, 2)) fails.push(`shards: ${id} is in ${f}`)
    }
  }

  console.log(`${season} verify ${fails.length ? 'FAILED' : 'passed'}: ${cov.total - cov.missing.length}/${cov.total} games, box ${box.near}/${box.n} pairs, ${box.stored} vs ${box.box} pitches, ${Object.keys(codes.unknown).length} unknown codes`)
  for (const f of fails) console.error(f)
  if (fails.length) process.exitCode = 1
  else await writeSeasons(outDir, season)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const season = Number(args.season)
  if (!season) throw new Error('--season=YYYY is required')
  const dir = join(outDir, String(season))
  const store = await readStore(dir)
  const pks = await finalGames(season)
  await (args.verify ? verify : sweep)(season, dir, store, pks)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
