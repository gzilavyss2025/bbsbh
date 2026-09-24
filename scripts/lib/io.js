// Shared, crash-safe IO helpers for the gen-*.mjs generators.
//
// Two failure modes these guard against, both flagged in review:
//
// 1. Truncated writes. A direct writeFile(out, JSON.stringify(...)) is not
//    atomic — a process killed mid-write leaves an invalid, half-written file
//    committed. writeJsonAtomic writes a sibling temp file then rename()s it
//    over the target; rename is atomic on POSIX, so a reader (or the next run)
//    only ever sees the complete old file or the complete new one.
//
// 2. Swallow-all "first run" catches. Several append-only archives do
//    `try { prev = JSON.parse(await readFile(out)) } catch { /* first run */ }`,
//    which treats ANY failure — including a corrupt/unparseable committed file —
//    as "no archive yet" and then rebuilds from only the trailing window,
//    silently discarding months of history. readJsonOr returns the fallback
//    ONLY for a genuinely-absent file (ENOENT) and rethrows everything else, so
//    a corrupt file aborts the run loudly instead of quietly truncating.

import { readFile, writeFile, rename, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'

// Read + parse JSON, returning `fallback` only when the file does not exist.
// Any other error (parse failure, permission, corrupt file) is rethrown.
export async function readJsonOr(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}

// Atomically write `data` as JSON to `path`. Ensures the parent dir exists,
// writes to `${path}.tmp`, then renames over `path`. `space` matches
// JSON.stringify's third arg (pass 2 for pretty output, omit for compact).
export async function writeJsonAtomic(path, data, space) {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  const body = space === undefined ? JSON.stringify(data) : JSON.stringify(data, null, space)
  await writeFile(tmp, body)
  await rename(tmp, path)
}

// Write one JSON file per entry into `dir`, then delete any *.json the run did
// NOT write. For a dataset whose readers each want a single record — one
// umpire, one matchup, one club — shipping the league in one file makes every
// visit pay for the whole set, and these files grow all season.
//
// FULL REBUILDS ONLY. The sweep is what keeps a shard from outliving the thing
// it describes (last season's umpire, a matchup that has fallen out of the
// window), and an append-only job would use it to delete everything it merely
// didn't touch this run.
export async function writeShards(dir, entries) {
  const kept = new Set()
  for (const [name, body] of entries) {
    await writeJsonAtomic(join(dir, `${name}.json`), body)
    kept.add(`${name}.json`)
  }
  let swept = 0
  for (const f of await readdir(dir).catch(() => [])) {
    if (!f.endsWith('.json') || kept.has(f)) continue
    await rm(join(dir, f))
    swept++
  }
  return { written: kept.size, swept }
}

// writeShards, plus an index.json in `dir` that carries the run's timestamp.
//
// A DIRECTORY dataset is invisible to the data-freshness guard unless it stamps
// itself this way: check-data-freshness.mjs reads a directory's index.json and
// nothing else, so a bucket set without one cannot be checked for age at all,
// and counts against that script's UNSTAMPED_BUDGET instead. glove-target/
// landed with no index on 2026-09-10, put the count one over the budget, and
// turned the nightly job red for three nights while every generator inside it
// kept working correctly.
//
// The stamp goes in ONE file, never in each shard. A per-shard `generatedAt`
// dirties all 30-150 committed shards on a night when not one record changed —
// the churn team-records/, milb-alumni/ and schedule-shape/ stay unstamped to
// avoid, recorded at UNSTAMPED_BUDGET.
//
// The index is written as an ENTRY of the same run, not after it. Written
// after, the NEXT run's sweep finds a *.json it did not write, deletes it and
// reports a phantom swept shard every night; written as an entry, it is in
// `kept` and the swept count stays true. `written` still counts shards only.
export async function writeShardsWithStamp(dir, entries, meta = {}) {
  const stamp = ['index', { generatedAt: new Date().toISOString(), ...meta }]
  const { written, swept } = await writeShards(dir, [...entries, stamp])
  return { written: written - 1, swept }
}

// --- season stores (ADR-0086) ------------------------------------------------
//
// A SEASON STORE KEEPS EVERY SEASON. Its files live in one folder per season,
// `<store>/<season>/…`, beside a `<store>/seasons.json` index that names the
// seasons on file and the one the app serves (`current`). A run writes ONLY
// its own season's folder, so a completed season is frozen: the new year can
// neither delete it nor empty it.
//
// `current` is the latest season WITH DATA. On January 1 the new season has no
// game yet, so the generator writes nothing and the index keeps pointing at
// last season until the new season's first game lands. That is the whole fix
// for the umpire pages and the spray card going blank all winter.

export const seasonsIndexPath = (storeDir) => join(storeDir, 'seasons.json')

export async function readSeasons(storeDir) {
  return readJsonOr(seasonsIndexPath(storeDir), { seasons: [], current: null })
}

// Pure: the index after a run that WROTE data for `season`. A run with no data
// does not call this, and leaves the index as it is.
export function seasonsAfter(prev, season) {
  const seasons = [...new Set([...(prev?.seasons ?? []), season])].sort((a, b) => a - b)
  return { seasons, current: seasons[seasons.length - 1] }
}

// Writes the index only when it changes, so a normal night does not dirty it
// with a new stamp.
export async function writeSeasons(storeDir, season) {
  const prev = await readSeasons(storeDir)
  const next = seasonsAfter(prev, season)
  if (prev.current !== next.current || prev.seasons?.join() !== next.seasons.join()) {
    await writeJsonAtomic(seasonsIndexPath(storeDir), { ...next, generatedAt: new Date().toISOString() })
  }
  return next
}
