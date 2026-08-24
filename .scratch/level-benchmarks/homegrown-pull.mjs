// Step 3 of the homegrown-dependence spike: the DEPENDENCE panel itself.
//
//   For org X in season S, homegrownShare = the fraction of X's MLB playing
//   time contributed by players homegrown to X.
//
// Playing time is plate appearances for hitters and batters-faced for pitchers,
// summed and shared separately as well as pooled. Batters faced rather than
// innings pitched because it is the pitcher's analogue of a plate appearance --
// one unit per batter, on the same scale as the hitting side, so a pooled share
// is a share of confrontations rather than a sum of two different units.
//
// TWO THINGS THIS PULL HAS TO GET RIGHT:
//
//  1. playerPool=all IS MANDATORY. /api/v1/stats silently applies a
//     qualification floor without it -- 239 rows against 1,562 for one AAA
//     season, measured in perf-pull.mjs. A qualification floor here would
//     delete exactly the marginal players a dependence share is about. This
//     reuses src/api/statsLevels.js's fetchTeamSeasonStats, which already
//     passes it (the perf-pull.mjs precedent for importing src/api/ into a
//     plain Node script).
//  2. THE COST IS THE PLAYER SWEEP, NOT THE STATS. The stat lines are 1,200
//     calls. Resolving first-pro-org for every player who ever took an MLB
//     plate appearance in the span is six calls EACH, and there are thousands
//     of them. Run with `--scope` to stop after the stat pull and print the
//     distinct-player count before committing to that.
//
// Writes homegrown-panel.json (+ caches teamstats-cache.json, milb-mlb-cache.json).
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mapConcurrent } from '../../scripts/lib/concurrency.mjs'
import { fetchTeamSeasonStats } from '../../src/api/statsLevels.js'
import { here, cached, buildOrgMap, sweepMilbSeasons, firstProOrg, COMMISSIONER_ORG_ID } from './homegrown-lib.mjs'

const SEASON_MIN = 2004
const SEASON_MAX = 2023
const seasons = Array.from({ length: SEASON_MAX - SEASON_MIN + 1 }, (_, i) => SEASON_MIN + i)
const scopeOnly = process.argv.includes('--scope')

const context = JSON.parse(await (await import('node:fs/promises')).readFile(join(here, 'context-panel.json'), 'utf8'))
const orgIds = context.orgIds

// --- MLB team-season stat lines ---------------------------------------------
const teamStats = await cached('teamstats-cache.json', async () => {
  const jobs = []
  for (const orgId of orgIds) for (const season of seasons) for (const group of ['hitting', 'pitching']) jobs.push({ orgId, season, group })
  console.log(`pulling MLB team-season stat lines (${jobs.length} calls, playerPool=all)...`)
  const out = {}
  let done = 0
  await mapConcurrent(jobs, 8, async ({ orgId, season, group }) => {
    const splits = await fetchTeamSeasonStats(orgId, group, season)
    out[`${orgId}:${season}:${group}`] = splits
      .filter((s) => s.player?.id)
      .map((s) => ({
        id: s.player.id,
        // plate appearances for a hitter, batters faced for a pitcher
        vol: group === 'hitting' ? Number(s.stat?.plateAppearances ?? 0) : Number(s.stat?.battersFaced ?? 0),
      }))
      .filter((r) => r.vol > 0)
    if (++done % 200 === 0) console.log(`  ${done}/${jobs.length}`)
  })
  return out
})
const statCells = Object.keys(teamStats).length
console.log(`team-season stat cells: ${statCells}`)

const allPlayerIds = new Set()
let totalRows = 0
for (const rows of Object.values(teamStats)) {
  totalRows += rows.length
  for (const r of rows) allPlayerIds.add(r.id)
}
console.log(`player-team-season rows: ${totalRows}`)
console.log(`DISTINCT MLB players ${SEASON_MIN}-${SEASON_MAX}: ${allPlayerIds.size}`)
console.log(`  -> first-pro-org sweep cost: ${allPlayerIds.size} players x 6 calls = ${allPlayerIds.size * 6} requests`)
if (scopeOnly) {
  console.log('\n--scope: stopping before the player sweep.')
  process.exit(0)
}

// --- first-pro-org for the whole MLB population ------------------------------
// The org map has to reach back further than the cohort's: a 2004 MLB season
// includes players whose first professional season was in the mid-1980s.
const orgMap = await buildOrgMap({ seasonMin: 1984, seasonMax: SEASON_MAX, cacheName: 'orgmap-wide.json' })
console.log(`org map loaded: ${orgMap.size} (team,season) entries`)

const ids = [...allPlayerIds]
const milbCache = await cached('milb-mlb-cache.json', async () => {
  console.log(`sweeping all six MiLB levels x both groups for ${ids.length} players (6 calls each)...`)
  const out = {}
  let done = 0
  await mapConcurrent(ids, 12, async (id) => {
    out[id] = await sweepMilbSeasons(id)
    if (++done % 500 === 0) console.log(`  ${done}/${ids.length}`)
  })
  return out
})
console.log(`minor-league rows cached for ${Object.keys(milbCache).length} players`)

const homeOrgOf = new Map()
const unresolvedReasons = { noMilbRecord: 0, noOrgForEntryClub: 0, commissioner: 0 }
let resolvedCount = 0
for (const id of ids) {
  const got = firstProOrg(milbCache[id], (k) => orgMap.get(k))
  if (!got) {
    if (milbCache[id]?.length) unresolvedReasons.noOrgForEntryClub++
    else unresolvedReasons.noMilbRecord++
    continue
  }
  if (got.orgId === COMMISSIONER_ORG_ID) {
    unresolvedReasons.commissioner++
    continue
  }
  homeOrgOf.set(id, got.orgId)
  resolvedCount++
}
console.log(`\nfirst-pro-org resolved: ${resolvedCount} of ${ids.length} (${((resolvedCount / ids.length) * 100).toFixed(1)}%)`)
console.log('unresolved breakdown:', JSON.stringify(unresolvedReasons))

// --- the dependence panel ----------------------------------------------------
// A row is one (org, season). `unresolvedVol` is playing time by a player whose
// entry org could not be resolved -- it is EXCLUDED from both numerator and
// denominator rather than counted as not-homegrown, so the share is a share of
// the playing time the rule can actually speak about. The excluded fraction is
// reported per row so a reader can see where it is large.
const panel = []
for (const orgId of orgIds) {
  for (const season of seasons) {
    const acc = { hitting: { own: 0, other: 0, unk: 0 }, pitching: { own: 0, other: 0, unk: 0 } }
    for (const group of ['hitting', 'pitching']) {
      for (const r of teamStats[`${orgId}:${season}:${group}`] ?? []) {
        const home = homeOrgOf.get(r.id)
        if (home === undefined) acc[group].unk += r.vol
        else if (home === orgId) acc[group].own += r.vol
        else acc[group].other += r.vol
      }
    }
    const hitKnown = acc.hitting.own + acc.hitting.other
    const pitKnown = acc.pitching.own + acc.pitching.other
    const allKnown = hitKnown + pitKnown
    const allVol = allKnown + acc.hitting.unk + acc.pitching.unk
    if (!allKnown) continue
    panel.push({
      orgId,
      season,
      homegrownShare: (acc.hitting.own + acc.pitching.own) / allKnown,
      homegrownShareHit: hitKnown ? acc.hitting.own / hitKnown : null,
      homegrownSharePit: pitKnown ? acc.pitching.own / pitKnown : null,
      knownVol: allKnown,
      unresolvedVolFrac: allVol ? (allVol - allKnown) / allVol : 0,
      winPct: context.standings[`${orgId}:${season}`]?.winPct ?? null,
      attendanceAvgHome: context.attendance[`${orgId}:${season}`]?.avgHome ?? null,
    })
  }
}
console.log(`\npanel rows: ${panel.length} org-seasons`)
const shares = panel.map((p) => p.homegrownShare).sort((a, b) => a - b)
const unkFracs = panel.map((p) => p.unresolvedVolFrac).sort((a, b) => a - b)
const q = (arr, f) => arr[Math.min(arr.length - 1, Math.floor(arr.length * f))]
console.log(`homegrownShare: min ${shares[0].toFixed(3)}, p25 ${q(shares, 0.25).toFixed(3)}, median ${q(shares, 0.5).toFixed(3)}, p75 ${q(shares, 0.75).toFixed(3)}, max ${shares[shares.length - 1].toFixed(3)}`)
console.log(`unresolved playing-time fraction: median ${q(unkFracs, 0.5).toFixed(4)}, p95 ${q(unkFracs, 0.95).toFixed(4)}, max ${unkFracs[unkFracs.length - 1].toFixed(4)}`)

await writeFile(
  join(here, 'homegrown-panel.json'),
  JSON.stringify(
    {
      meta: {
        seasonMin: SEASON_MIN,
        seasonMax: SEASON_MAX,
        distinctMlbPlayers: ids.length,
        firstProOrgResolved: resolvedCount,
        unresolvedReasons,
        panelRows: panel.length,
      },
      panel,
    },
    null,
    2,
  ),
)
console.log('wrote homegrown-panel.json')
