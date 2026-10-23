// Writes public/data/franchise-leaders/{teamId}.json: each of the 30 MLB clubs' career and
// single-season leaders in 26 categories, regular season only, the feed's top ten with ties kept
// (#2596). Keyed by the CURRENT team id, so 158 holds the 1969 Pilots too. Reader:
// src/api/history/franchiseLeaders.js. The pure half: scripts/lib/franchise/leaders.mjs.
//
// Source: GET /api/v1/stats/leaders?leaderCategories={c}&statType=career|statsSingleSeason
//   &teamId={id}&statGroup=hitting|pitching&leaderGameTypes=R&limit=10
// 26 categories x 2 types x 30 clubs, about 1,560 calls, paced six at a time. Do NOT use
// teams/{id}/leaders: it ignores statType and returns the current season.
//
// HAND-RUN: `node scripts/franchise/gen-franchise-leaders.mjs [--through 2025]`. The feed cannot
// be cut by season, so a run made mid-season holds that season so far; run it after the regular
// season ends. `--through` is the season the run was made after, written into each file (default:
// this year from October on, else last year). Any failed call aborts the run (strict). The files
// carry no clock, so a re-run on the same feed writes the same bytes.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_MLB_TEAM_IDS } from '../../src/lib/teams.js'
import { writeShards } from '../lib/io.js'
import { getJson } from '../lib/statsapi.mjs'
import { mapConcurrent } from '../lib/concurrency.mjs'
import { CATEGORIES, STAT_TYPES, buildClubLeaders } from '../lib/franchise/leaders.mjs'

const outDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'public', 'data', 'franchise-leaders')
const now = new Date()
const flag = process.argv.indexOf('--through')
const through = flag > 0 ? Number(process.argv[flag + 1]) : now.getUTCFullYear() - (now.getUTCMonth() >= 9 ? 0 : 1)
if (!Number.isInteger(through) || through < 1901) throw new Error(`bad --through: ${through}`)

const jobs = ALL_MLB_TEAM_IDS.flatMap((teamId) =>
  Object.keys(STAT_TYPES).flatMap((type) => CATEGORIES.map((c) => ({ teamId, type, ...c }))),
)
const answers = await mapConcurrent(
  jobs,
  6,
  async (j) => ({
    ...j,
    leagueLeaders: (
      await getJson(
        `/api/v1/stats/leaders?leaderCategories=${j.category}&statType=${STAT_TYPES[j.type]}&teamId=${j.teamId}&statGroup=${j.group}&leaderGameTypes=R&limit=10`,
      )
    ).leagueLeaders,
  }),
  { strict: true },
)

await writeShards(
  outDir,
  ALL_MLB_TEAM_IDS.map((teamId) => [teamId, buildClubLeaders({ teamId, through, answers: answers.filter((a) => a.teamId === teamId) })]),
)
console.log(`franchise-leaders: ${ALL_MLB_TEAM_IDS.length} clubs, ${jobs.length} calls, through ${through}`)
