// Pulls the two level pools that .scratch/level-benchmarks/perf-pool.json lacks:
// sportId 14 (A) and 16 (Rookie), seasons 2009-2019, hitting and pitching. sportId 16 also holds the
// Dominican Summer League (800 of 1,662 hitters in 2019), so a second pool, key '16us', keeps only the two US
// complex leagues, the spec's "Rk / complex": Arizona League (id 121) and Gulf Coast League (id 124).
// League ids checked against /api/v1/teams?sportId=16&season=2019 on 2026-10-07.
// perf-pool.json already holds sportId 11/12/13 for the same seasons.
// Output: $OVR_CACHE/pool-extra.json (default /tmp/ovr-cache). Not committed.
// Run: node .scratch/ovr/pull-pools.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fetchLevelSeasonStats } from '../../src/api/statsLevels.js'
import { getJson } from '../../src/api/statsapi.js'

const cache = process.env.OVR_CACHE || join(tmpdir(), 'ovr-cache')
mkdirSync(cache, { recursive: true })
const out = {}
const keys = []
for (const sportId of [14, 16, '16us']) for (let s = 2009; s <= 2019; s++) for (const g of ['hitting', 'pitching']) keys.push([sportId, s, g])
let i = 0
async function worker() {
  while (i < keys.length) {
    const [sportId, season, group] = keys[i++]
    const splits = sportId === '16us'
      ? ((await getJson(`/api/v1/stats?stats=season&group=${group}&season=${season}&sportId=16&leagueIds=121,124&playerPool=all&limit=5000`)).stats?.[0]?.splits ?? [])
      : await fetchLevelSeasonStats(sportId, group, season)
    out[`${sportId}:${season}:${group}`] = splits.map((x) => ({
      playerId: x.player?.id,
      ops: x.stat?.ops != null ? Number(x.stat.ops) : null,
      plateAppearances: x.stat?.plateAppearances ?? 0,
      era: x.stat?.era != null ? Number(x.stat.era) : null,
      inningsPitched: x.stat?.inningsPitched != null ? Number(x.stat.inningsPitched) : 0,
    }))
    process.stdout.write('.')
  }
}
await Promise.all(Array.from({ length: 4 }, worker))
for (const k of Object.keys(out).sort()) console.log(k, out[k].length)
writeFileSync(join(cache, 'pool-extra.json'), JSON.stringify(out))
console.log('wrote', join(cache, 'pool-extra.json'))
