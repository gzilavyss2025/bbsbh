// Minimal statsapi pull to compute an org-season "incumbent depth" covariate
// that mirrors docs/price-the-blockage.md's own measure (job.depth from
// incumbentAt() in .scratch/blockage/build.mjs), aggregated to org-season
// grain instead of per-stay.
//
// price-the-blockage.md's own stays.json/mlb-cache.json/milb-field-cache.json
// are gitignored and not present in a fresh worktree (verified: absent here),
// so this spike needs its own copy of the same two pulls, restricted to what
// the DEPTH measure actually needs (hitters only):
//   - MLB fielding splits, group=fielding, sportId=1, 2009-2023 (15 calls) —
//     "who else started games at this position for the parent club."
//   - Triple-A fielding splits, group=fielding, sportId=11, 2009-2023
//     (15 calls) — "what position was the prospect playing at Triple-A."
// No hitting/pitching group pull, and no pitcher rotation/bullpen job: the
// published depth term this spike tests against (confound.mjs's "Men already
// sharing the job" OR 0.689, p=0.0113) is the hitters-only model, so this
// covariate only needs the hitting side. 30 requests total.
//
// Run: node .scratch/team-success/pull-fielding-for-depth.mjs
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MLB_CACHE = join(__dirname, 'mlb-field-cache.json')
const MILB_CACHE = join(__dirname, 'milb-field-cache.json')

const SEASON_MIN = 2009
const SEASON_MAX = 2023

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.json()
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)))
    }
  }
}

function rowsFrom(json) {
  const splits = json?.stats?.[0]?.splits || []
  return splits.map((s) => ({
    p: s.player?.id,
    t: s.team?.id,
    pos: s.position?.abbreviation,
    gs: s.stat?.gamesStarted ?? 0,
    g: s.stat?.games ?? s.stat?.gamesPlayed ?? 0,
  }))
}

async function pull(cachePath, sportId) {
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
  for (let season = SEASON_MIN; season <= SEASON_MAX; season += 1) {
    const key = `${season}`
    if (cache[key]) continue
    const url =
      `https://statsapi.mlb.com/api/v1/stats?stats=season&group=fielding` +
      `&season=${season}&sportId=${sportId}&gameType=R&playerPool=All&limit=9000`
    const json = await get(url)
    const total = json?.stats?.[0]?.totalSplits
    const rows = rowsFrom(json)
    cache[key] = rows
    console.log(`sportId=${sportId} season=${season}  splits=${rows.length}/${total}`)
    writeFileSync(cachePath, JSON.stringify(cache))
    await new Promise((res) => setTimeout(res, 200))
  }
  return cache
}

console.log('Pulling MLB fielding (sportId=1)...')
await pull(MLB_CACHE, 1)
console.log('Pulling Triple-A fielding (sportId=11)...')
await pull(MILB_CACHE, 11)
console.log('done')
