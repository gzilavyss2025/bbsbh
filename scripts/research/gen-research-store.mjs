// Builds the /research store (#2234): one pitch-level month shard per month of a
// season, from Baseball Savant's daily pitch CSV, plus `index.json`. Layout:
// src/api/research/shard.js. Reader: src/api/research/store.js.
//
// WHERE IT LIVES. Vercel Blob, outside git (Gary, 2026-11-02), under `research/v1/`.
// Without --upload the files land in --out only (a local fixture for `npm run dev`
// with VITE_RESEARCH_STORE pointed at it).
//
// BEFORE TODAY ONLY. A day is read only if it is before today in US Pacific, so the
// store never holds a game in progress (the spray rule; ADR-0095's guarantee).
//
// WHAT RUNS IT. The nightly cron (update-nightly-data.yml, `--recent --upload --stamp`):
// it rebuilds the month or two its trailing 3 days fall in, WHOLE, since a shard holds
// only what a run fetched. By hand, .github/workflows/research-store.yml rebuilds any
// months (a backfill).
//
// A MONTH ONLY GROWS. A rebuilt month with fewer pitches than the index has for it is
// not uploaded (Savant answers a late or broken day with a 200 and fewer rows), and the
// run exits 1 so the step goes red. `--force` uploads it anyway.
//
// THE STAMP. `--stamp=<file>` writes { generatedAt, through } there AFTER the index
// upload, so check-data-freshness.mjs sees a run that reached Blob, not one that only
// started. The page does not read it; it reads index.json.
//
//   node scripts/research/gen-research-store.mjs --season=2026                 # every month so far
//   node scripts/research/gen-research-store.mjs --season=2026 --months=06     # one month
//   node scripts/research/gen-research-store.mjs --recent --upload             # the nightly window
//   node scripts/research/gen-research-store.mjs --season=2026 --upload        # and put it in Blob
//   node scripts/research/gen-research-store.mjs --months=06 --first-days=3    # first 3 days only (a quick fixture)

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs, strOpt } from '../lib/args.mjs'
import { withRetry } from '../lib/net/retry.mjs'
import { csvObjects } from '../lib/savant.mjs'
import { getPeople } from '../lib/statsapi.mjs'
import { fetchSeasonInPlay } from '../lib/time/season-in-play.mjs'
import { SAVANT_DAY_CAP, mergeIndex, monthDays, recentMonths, savantDayUrl, seasonMonths, shrinkReason } from '../lib/research/store.mjs'
import { baseballToday } from '../../src/lib/time/standingsDates.js'
import { decodePlateAppearances, encodeMonth } from '../../src/api/research/shard.js'

const PREFIX = 'research/v1/'
const SPACING_MS = 400

const args = parseArgs(process.argv.slice(2))
const today = baseballToday()
const season = args.recent ? null : Number(strOpt(args, 'season') ?? (await fetchSeasonInPlay()))
const targets = args.recent
  ? recentMonths(today)
  : (strOpt(args, 'months')?.split(',') ?? seasonMonths(season, today)).map((month) => ({ season, month }))
const maxDays = Number(strOpt(args, 'first-days')) || Infinity
const force = Boolean(args.force)
const stampFile = strOpt(args, 'stamp')
const out = strOpt(args, 'out') ?? join(tmpdir(), 'research-store')
const upload = Boolean(args.upload)

async function fetchDay(day) {
  const text = await withRetry(
    async () => {
      const res = await fetch(savantDayUrl(day), { signal: AbortSignal.timeout(60_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.text()
    },
    { label: `savant ${day}` },
  )
  const rows = csvObjects(text)
  if (rows.length >= SAVANT_DAY_CAP) throw new Error(`savant ${day}: ${rows.length} rows, the cap`)
  return rows
}

async function namesFor(rows) {
  const ids = [...new Set(rows.flatMap((r) => [r.batter, r.pitcher]).filter(Boolean).map(Number))].sort((a, b) => a - b)
  const people = await getPeople(ids, { fields: 'people,id,fullName', onError: (e) => console.error(`people: ${e.message}`) })
  return Object.fromEntries(people.map((p) => [p.id, p.fullName]))
}

let put = null
let index = null
if (upload) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('--upload needs BLOB_READ_WRITE_TOKEN')
  const blob = await import('@vercel/blob')
  put = (path, body) => blob.put(PREFIX + path, body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 3600 })
  // The public URL is CDN-cached for an hour (cacheControlMaxAge), and a stale index
  // merged and written back would drop a month. A query the CDN has not seen asks the
  // origin. (Inference: Blob's CDN keys on the query string; checked on the first run.)
  const found = (await blob.list({ prefix: `${PREFIX}index.json` })).blobs[0]
  if (found) index = await (await fetch(`${found.url}?t=${Date.now()}`, { cache: 'no-store' })).json()
} else {
  index = await readFile(join(out, 'index.json'), 'utf8').then(JSON.parse, () => null)
}

let refused = 0
let changed = 0
for (const { season, month } of targets) {
  const days = monthDays(season, month, today).slice(0, maxDays)
  if (!days.length) continue
  const rows = []
  for (const day of days) {
    const got = await fetchDay(day)
    console.log(`${day}: ${got.length} rows`)
    rows.push(...got)
    await sleep(SPACING_MS)
  }
  if (!rows.length) {
    console.log(`${season}-${month}: no games, nothing written`)
    continue
  }
  const shard = encodeMonth(rows, { season, month, names: await namesFor(rows) })
  const body = JSON.stringify(shard)
  const pas = decodePlateAppearances(shard).length
  console.log(`${season}-${month}: ${shard.cols.g.length} pitches, ${pas} PAs, ${(body.length / 1e6).toFixed(1)} MB raw, ${(gzipSync(body).length / 1e6).toFixed(2)} MB gzip`)
  const shrink = shrinkReason(index?.seasons?.[season]?.months?.[month], shard.cols.g.length)
  if (shrink && !force) {
    console.error(`${season}-${month}: NOT written: ${shrink}. Rerun later, or pass --force.`)
    refused++
    continue
  }
  await mkdir(join(out, String(season)), { recursive: true })
  await writeFile(join(out, String(season), `${month}.json`), body)
  if (put) console.log(`uploaded ${(await put(`${season}/${month}.json`, body)).url}`)
  index = mergeIndex(index, season, month, shard, pas, new Date().toISOString())
  changed++
}

// Nothing rebuilt (no games in the window, or every month refused): leave the index
// and the stamp alone, so a stale stamp says so.
if (index && changed) {
  const body = JSON.stringify(index)
  await mkdir(out, { recursive: true })
  await writeFile(join(out, 'index.json'), body)
  if (put) console.log(`uploaded ${(await put('index.json', body)).url}`)
  if (stampFile) {
    const through = Object.values(index.seasons).flatMap((x) => Object.values(x.months).map((m) => m.through)).sort().at(-1)
    await writeFile(stampFile, `${JSON.stringify({ generatedAt: index.built, through }, null, 2)}\n`)
  }
}
if (refused) process.exit(1)
