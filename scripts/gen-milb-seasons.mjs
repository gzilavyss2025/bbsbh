// Regenerates public/data/milb-seasons/{NN}.json: each player's minor-league season
// lines for 2021-2025 at AAA, AA, A+ and A (sportId 11-14), bucketed on `personId % 100`.
// The career rating (docs/ovr-rating.md, "Career rating") blends them in at a discount.
// Reader: src/api/milbSeasons.js. Row shape and the parse rules: scripts/lib/milb/seasons.mjs.
//
// HAND-RUN, NOT a cron: a finished minor-league season never changes, so run it once a
// year to fold in the season that just ended (bump SEASONS in the lib). Expect about 40
// pool calls and about 25 batch calls, about 30 MB in all. That is bulk use of statsapi
// (the MLB terms allow "individual, non-commercial, non-bulk use"), which is why it is
// a yearly hand run and not a nightly or a client-direct read.
//
// Two passes. (1) Per level-season, the full pool (fetchLevelSeasonStats) gives the
// OPS or ERA population the percentile is ranked in, with prospectPercentile.mjs's math
// and floor (40 PA, 30 outs), the same as prospect-trend.json. (2) The players, batched
// by level through /people?personIds=...&hydrate=stats(type=[yearByYear],sportId=N).
// The URL caps near 7,000 characters: 1,200 ids fail, so BATCH stays well under.
//
// Players: everyone with a career in war.json, plus the Top 100 in top-prospects.json.
// Run by hand: node scripts/gen-milb-seasons.mjs
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchLevelSeasonStats } from '../src/api/statsLevels.js'
import { milbShardKey, packRow } from '../src/api/milbSeasons.js'
import { mapConcurrent } from './lib/concurrency.mjs'
import { writeShards } from './lib/io.js'
import { qualifiedMetrics } from './lib/prospectPercentile.mjs'
import { SEASONS, SPORT_IDS, populationKeyOf, rowsFor, uniqueIds } from './lib/milb/seasons.mjs'
import { getJson } from './lib/statsapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const data = join(here, '..', 'public', 'data')
const outDir = join(data, 'milb-seasons')

const BATCH = 300 // ids per call
const CONCURRENCY = 2 // the throttle
const GROUPS = ['hitting', 'pitching']
const FIELDS = 'people,id,stats,group,displayName,splits,season,stat,plateAppearances,ops,outs,era,team,id'

const readJson = async (name) => JSON.parse(await readFile(join(data, name), 'utf8'))
const [war, top] = await Promise.all([readJson('war.json'), readJson('top-prospects.json')])
const ids = uniqueIds(Object.keys(war.bat), Object.keys(war.pit), top.players.map((p) => p.playerId))
console.log(`${ids.length} players`)

// Pass 1: one pool per level, season and group. An empty pool is a failed call
// (fetchLevelSeasonStats degrades to []), and it would write null percentiles, so stop.
const pools = new Map()
const poolJobs = SPORT_IDS.flatMap((sid) => SEASONS.flatMap((s) => GROUPS.map((g) => [sid, s, g])))
await mapConcurrent(
  poolJobs,
  CONCURRENCY,
  async ([sid, season, group]) => {
    const splits = await fetchLevelSeasonStats(sid, group, season)
    if (!splits.length) throw new Error(`empty pool: sportId ${sid} ${season} ${group}`)
    pools.set(populationKeyOf(sid, season, group), qualifiedMetrics(splits, group))
  },
  { strict: true },
)

// Pass 2: the players' lines, one batch per level.
const batches = []
for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH))
const calls = SPORT_IDS.flatMap((sid) => batches.map((chunk) => [sid, chunk]))
const hydrate = (sid) => encodeURIComponent(`stats(group=[hitting,pitching],type=[yearByYear],sportId=${sid})`)
const results = await mapConcurrent(
  calls,
  CONCURRENCY,
  async ([sid, chunk]) => {
    const json = await getJson(`/api/v1/people?personIds=${chunk.join(',')}&hydrate=${hydrate(sid)}&fields=${FIELDS}`)
    return (json.people ?? []).map((p) => [p.id, rowsFor(p, sid, pools)])
  },
  { strict: true },
)

const players = new Map() // personId -> rows
for (const [id, rows] of results.flat()) {
  if (rows.length) players.set(id, [...(players.get(id) ?? []), ...rows])
}
const buckets = new Map() // shard key -> { personId: packed rows }
for (const [id, rows] of players) {
  rows.sort((a, b) => a.season - b.season || a.sport - b.sport || a.group.localeCompare(b.group))
  const key = milbShardKey(id)
  if (!buckets.has(key)) buckets.set(key, {})
  buckets.get(key)[id] = rows.map(packRow)
}

const generatedAt = new Date().toISOString()
const { written } = await writeShards(
  outDir,
  [...buckets].map(([key, shard]) => [key, { generatedAt, seasons: SEASONS, players: shard }]),
)
console.log(`wrote ${written} shards, ${players.size} players, to ${outDir}`)
