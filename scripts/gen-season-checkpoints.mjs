// Season checkpoints (#1855): every MLB player-season's cumulative line at each
// checkpoint (every 10 games for a hitter, every 10 innings for a pitcher), and the
// league tails the player page's hot and cold callouts are ranked against.
//
// Two outputs:
// - scripts/data/season-checkpoints/{season}.json — the raw store, one file per season:
//   { season, hitting: { [id]: { n: name, f: final, c: [line at 10, 20, …] } }, pitching }
//   with each line packed in `src/api/hotcold/line.js`'s field order. Not shipped: it is
//   the input the tails are derived from, and the history-line slice (#1855 slice 3)
//   searches it for past players who were close at the same checkpoint.
// - public/data/season-checkpoints/tails.json — what the page reads: for each role and
//   checkpoint, the pool size and 101 quantiles of each stat in `STATS`, over the pooled
//   seasons. 124 KB.
// - public/data/season-checkpoints/extremes/{role}-{checkpoint|full}.json — the outer 3% of
//   each side of each stat at that checkpoint (`full`: the final lines of the seasons that
//   reached FULL_SEASON), as [value, id, season, name] rows, so the page can
//   say exactly how many past seasons were further out and list them. The page reads one
//   file per callout, only when one shows.
//
// THE WINDOW is the last SEASONS completed regular seasons (Gary, 2026-10-20: ten). The
// line math is imported from the app (`src/api/hotcold/line.js`), never copied, so the
// generator and the rule fold a season the same way.
//
// HAND-RUN, once a year after the regular season ends: a completed season's game logs
// do not change, and the current season is not pooled. A season already on file is not
// fetched again; `--refresh` refetches every season in the window.
//   node scripts/gen-season-checkpoints.mjs [--refresh] [--last=2026]
// The pure half (the window, the tails) is lib/season-checkpoints/tails.mjs.
//
// COST. statsapi's /people endpoint takes many ids and hydrates each one's game log, so
// a season is two leaderboard calls plus about 60 batched calls. A full ten-season
// backfill is about 650 requests.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import { chunk, mapConcurrent } from './lib/concurrency.mjs'
import { foldSeason, pack } from '../src/api/hotcold/line.js'
import { ROLES, buildExtremes, buildTails, lastCompletedSeason } from './lib/season-checkpoints/tails.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const rawDir = join(here, 'data', 'season-checkpoints')
const outDir = join(here, '..', 'public', 'data', 'season-checkpoints')
const outPath = join(outDir, 'tails.json')

const SEASONS = 10
const BATCH = 25

async function playerIds(role, season) {
  const json = await getJson(
    `/api/v1/stats?stats=season&group=${role}&season=${season}&sportId=1&gameType=R&playerPool=ALL&limit=5000`,
  )
  return [...new Set((json.stats?.[0]?.splits ?? []).map((s) => s.player?.id).filter(Boolean))]
}

async function fetchRole(role, season) {
  const ids = await playerIds(role, season)
  const out = {}
  const batches = chunk(ids, BATCH)
  await mapConcurrent(batches, 4, async (batch) => {
    const json = await getJson(
      `/api/v1/people?personIds=${batch.join(',')}` +
        `&hydrate=stats(group=[${role}],type=[gameLog],season=${season},sportId=1,gameType=[R])`,
    )
    for (const person of json.people ?? []) {
      const rows = (person.stats ?? []).find((s) => s.group?.displayName === role)?.splits ?? []
      if (!rows.length) continue
      const { final, checkpoints } = foldSeason(role, rows)
      const c = Object.keys(checkpoints).map(Number).sort((a, b) => a - b).map((k) => pack(role, checkpoints[k]))
      out[person.id] = { n: person.fullName, f: pack(role, final), c }
    }
  }, { strict: true })
  console.log(`${season} ${role}: ${ids.length} players, ${Object.keys(out).length} with a game log`)
  return out
}

async function lastSeason() {
  const arg = process.argv.find((a) => a.startsWith('--last='))
  if (arg) return Number(arg.slice(7))
  const todayIso = new Date().toISOString().slice(0, 10)
  const json = await getJson(
    `/api/v1/seasons?sportId=1&season=${todayIso.slice(0, 4)}&fields=seasons,seasonId,regularSeasonEndDate`,
  )
  return lastCompletedSeason(todayIso, json?.seasons?.[0] ?? null)
}

async function main() {
  const refresh = process.argv.includes('--refresh')
  const last = await lastSeason()
  const seasons = Array.from({ length: SEASONS }, (_, i) => last - SEASONS + 1 + i)
  const rawBySeason = {}
  for (const season of seasons) {
    const path = join(rawDir, `${season}.json`)
    if (!refresh && existsSync(path)) {
      rawBySeason[season] = await readJsonOr(path, null)
      continue
    }
    const raw = { season }
    for (const role of ROLES) raw[role] = await fetchRole(role, season)
    await writeJsonAtomic(path, raw)
    rawBySeason[season] = raw
  }
  await writeJsonAtomic(outPath, { generatedAt: new Date().toISOString(), seasons, ...buildTails(rawBySeason) })
  const extremes = buildExtremes(rawBySeason)
  let files = 0
  for (const [role, byCheckpoint] of Object.entries(extremes)) {
    for (const [checkpoint, stats] of Object.entries(byCheckpoint)) {
      await writeJsonAtomic(join(outDir, 'extremes', `${role}-${checkpoint}.json`), { seasons, stats })
      files++
    }
  }
  console.log(`wrote ${outPath} and ${files} extremes files (${seasons[0]}–${last})`)
}

await main()
