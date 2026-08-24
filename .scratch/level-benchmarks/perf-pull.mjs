// Follow-up to the adversarial review's section 5 ("in-level performance"
// confound, named but not measured). raw.json only carries the 3,061-player
// DEBUT cohort's own stat lines — using it alone to build a performance
// percentile would rank cohort players only against each other, a
// survivorship-biased pool (everyone in it eventually reached the majors).
// A true percentile needs the FULL population at each (level, season).
//
// The MLB stats "leaders" endpoint (`/api/v1/stats?stats=season&group=...`)
// looks like it returns that, but it silently applies a qualification floor
// (min PA/IP) unless `playerPool=all` is passed — checked directly: AAA 2015
// hitting returns 239 "qualified" rows by default vs. 1,562 with
// `playerPool=all` (min PA 0). Reuses `fetchLevelSeasonStats` from
// `src/api/statsLevels.js` (already used by `gen-minors-leaders.mjs`), which
// already passes `playerPool=all` — not a new pull technique, just applied
// across every (level, season) this cohort's fixed durations actually touch.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchLevelSeasonStats } from '../../src/api/statsLevels.js'

const here = dirname(fileURLToPath(import.meta.url))
const dates = JSON.parse(await readFile(join(here, 'dates.json'), 'utf8'))
const findings = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
const disputedIds = new Set(findings.validation.disagree.map((d) => d.playerId))

const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }
const pairs = new Set()
for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId) || d.days <= 0) continue
  pairs.add(`${LEVEL_SPORT[d.level]}:${d.season}`)
}
console.log(`pulling ${pairs.size} (sportId,season) pairs x 2 groups = ${pairs.size * 2} calls`)

const pool = {} // `${sportId}:${season}:${group}` -> [{playerId, stat}]
let cursor = [...pairs]
async function worker() {
  while (cursor.length) {
    const key = cursor.shift()
    const [sportId, season] = key.split(':').map(Number)
    for (const group of ['hitting', 'pitching']) {
      const splits = await fetchLevelSeasonStats(sportId, group, season)
      pool[`${key}:${group}`] = splits.map((s) => ({
        playerId: s.player?.id,
        ops: s.stat?.ops != null ? Number(s.stat.ops) : null,
        plateAppearances: s.stat?.plateAppearances ?? 0,
        era: s.stat?.era != null ? Number(s.stat.era) : null,
        inningsPitched: s.stat?.inningsPitched != null ? Number(s.stat.inningsPitched) : 0,
      }))
    }
    process.stdout.write('.')
  }
}
await Promise.all(Array.from({ length: 6 }, worker))
console.log('\ndone')

const totalHitters = Object.entries(pool).filter(([k]) => k.endsWith(':hitting')).reduce((s, [, v]) => s + v.length, 0)
const totalPitchers = Object.entries(pool).filter(([k]) => k.endsWith(':pitching')).reduce((s, [, v]) => s + v.length, 0)
console.log(`pool sizes: ${totalHitters} hitter-seasons, ${totalPitchers} pitcher-seasons across ${pairs.size} level-seasons`)

await writeFile(join(here, 'perf-pool.json'), JSON.stringify(pool))
console.log('wrote perf-pool.json')
