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
