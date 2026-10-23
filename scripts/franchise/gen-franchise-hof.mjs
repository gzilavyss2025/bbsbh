// Writes public/data/franchise-hof/{teamId}.json: for each of the 30 MLB clubs, the Hall of Famers
// "inducted as" that club (the club on the plaque) and the ones who "also played here", with the
// seasons they did (#2597). Keyed by the CURRENT team id, so 158 holds the 1969 Pilots too.
// Reader: src/api/history/franchiseHof.js. The pure half: scripts/lib/franchise/hof.mjs.
//
// Sources: GET /api/v1/awards/MLBHOF/recipients (the induction year and the club on the plaque),
// then one GET /api/v1/people/{id}?hydrate=stats(group=[hitting,pitching],type=[yearByYear]) a
// recipient (about 355 calls, paced six at a time) for the clubs and seasons he played.
//
// HAND-RUN: `node scripts/franchise/gen-franchise-hof.mjs`. Re-run after each induction (late July).
// Any failed call aborts the run (strict). The files carry no clock, so a re-run on the same feeds
// writes the same bytes.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_MLB_TEAM_IDS } from '../../src/lib/teams.js'
import { writeShards } from '../lib/io.js'
import { getJson } from '../lib/statsapi.mjs'
import { mapConcurrent } from '../lib/concurrency.mjs'
import { buildHof, inducteesFrom } from '../lib/franchise/hof.mjs'

const outDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'public', 'data', 'franchise-hof')

const recipients = inducteesFrom((await getJson('/api/v1/awards/MLBHOF/recipients')).awards)
const people = await mapConcurrent(
  recipients,
  6,
  async (r) => (await getJson(`/api/v1/people/${r.id}?hydrate=stats(group=[hitting,pitching],type=[yearByYear])`)).people?.[0],
  { strict: true },
)
const careers = new Map(recipients.map((r, i) => [r.id, people[i]]))

const hof = buildHof({ recipients, careers, clubIds: ALL_MLB_TEAM_IDS })
await writeShards(outDir, ALL_MLB_TEAM_IDS.map((id) => [id, hof.get(id)]))

const noClub = recipients.filter((r) => !ALL_MLB_TEAM_IDS.includes(r.teamId))
const noStats = recipients.filter((r) => !people[recipients.indexOf(r)]?.stats?.length)
console.log(`franchise-hof: ${recipients.length} recipients, ${noClub.length} with no current club on the plaque (${recipients.filter((r) => r.teamId == null).length} with no team), ${noStats.length} with no playing stats`)
console.log(`inducted as: ${[...hof.values()].reduce((n, c) => n + c.inductedAs.length, 0)}, also played: ${[...hof.values()].reduce((n, c) => n + c.alsoPlayed.length, 0)}`)
