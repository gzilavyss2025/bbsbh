// Regenerates public/data/level-lines.json: for the season in play, each
// level's qualified OPS and ERA as 101 percentile cut points (MLB, AAA, AA,
// A+, A, Rk). The trade card's "By level" sort ranks a player's line against
// his own level with them (src/lib/trade/levelPct.js).
//
// Why a build-time file: one level's full season splits are ~865 KB
// (measured 2026-11-18, AA hitting, 830 players); twelve of them is ~10 MB
// for a page that needs ~6 KB of cut points.
//
// The floor is prospect-trend's (40 PA, 30 outs) and the values are MLB's
// printed OPS and ERA, both through scripts/lib/prospectPercentile.mjs.
// Nightly, in the structural data block of update-nightly-data.yml (12
// requests). Run by hand: node scripts/trade/gen-level-lines.mjs
import { join } from 'node:path'
import { writeJsonAtomic } from '../lib/io.js'
import { getJson } from '../lib/statsapi.mjs'
import { fetchSeasonInPlay } from '../lib/time/season-in-play.mjs'
import { qualifiedMetrics } from '../lib/prospectPercentile.mjs'
import { cutPoints, LEVEL_OF_SPORT } from '../../src/lib/trade/levelPct.js'

const out = join(import.meta.dirname, '..', '..', 'public', 'data', 'level-lines.json')
const season = await fetchSeasonInPlay()

const levels = {}
for (const sportId of Object.keys(LEVEL_OF_SPORT)) {
  const row = {}
  for (const group of ['hitting', 'pitching']) {
    const data = await getJson(`/api/v1/stats?stats=season&group=${group}&season=${season}&sportId=${sportId}&playerPool=all&limit=5000`)
    const cuts = cutPoints(qualifiedMetrics(data.stats?.[0]?.splits ?? [], group))
    if (cuts) row[group === 'hitting' ? 'ops' : 'era'] = cuts.map((v) => Number(v.toFixed(group === 'hitting' ? 3 : 2)))
  }
  if (Object.keys(row).length) levels[sportId] = row
  console.log(`${LEVEL_OF_SPORT[sportId]}: ${Object.keys(row).join(', ') || 'no qualified lines'}`)
}

// A season with no qualified lines yet (before Opening Day) keeps last run's file.
if (!Object.keys(levels).length) {
  console.log('level-lines: no level had qualified lines; kept the file on disk')
} else {
  await writeJsonAtomic(out, { generatedAt: new Date().toISOString(), season, levels })
  console.log(`level-lines: ${Object.keys(levels).length} levels for ${season}`)
}
