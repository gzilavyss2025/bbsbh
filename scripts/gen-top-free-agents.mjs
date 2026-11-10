// Regenerates public/data/top-free-agents.json — the MLB offseason home page's
// "Top free agents" block (src/components/offseason/TopFreeAgents.jsx): six
// unsigned major leaguers per group (SP, RP, CL, C, IF, OF, DH; the pitcher
// roles from freeAgentRole) and across all of them, by WAR, each with the player hover card's four season stats.
//
// Nightly, after WAR (it reads the war.json that step wrote). A player who
// signed since the last run drops out of the pool, so the next best moves up
// into his slot. The class is the season war.json is for: no WAR, no ranking,
// so a mismatched or missing war.json writes empty groups (the block hides)
// rather than an alphabetical "top".
//
// All the ranking and card logic is the app's own (src/api/free-agents/
// freeAgents.js), imported rather than copied (docs/scripts/generators.md).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeJsonAtomic } from './lib/io.js'
import { getJson, getPeople } from './lib/statsapi.mjs'
import { freeAgentRole, readClass, statsByPerson, topByGroup, topCard } from '../src/api/free-agents/freeAgents.js'

const here = import.meta.dirname
const out = join(here, '..', 'public', 'data', 'top-free-agents.json')
const war = JSON.parse(await readFile(join(here, '..', 'public', 'data', 'war.json'), 'utf8'))
const season = Number(war.season)

const rows = await readClass(season, { get: getJson, war })
// Stats for the whole unsigned pool, season and career: a pitcher's role
// (SP/RP/CL) has to be known before he can be ranked inside it.
const unsigned = rows.filter((r) => !r.signed && !r.minor)
const season_ = encodeURIComponent(`stats(group=[hitting,pitching],type=season,season=${season})`)
// Career for pitchers only, read for career saves and nothing else. A second
// call: the API answers 400 to two stats() hydrates on one request.
const career = encodeURIComponent('stats(group=pitching,type=career)')
const [seasonRows, careerRows] = await Promise.all([
  getPeople(unsigned.map((r) => r.id), { hydrate: season_ }),
  getPeople(unsigned.filter((r) => r.isPitcher).map((r) => r.id), { hydrate: career }),
])
const people = statsByPerson(seasonRows)
for (const [id, c] of Object.entries(statsByPerson(careerRows))) {
  if (people[id] && c.pitchingCareer) people[id].pitchingCareer = c.pitchingCareer
}
const ranked = rows.map((r) =>
  r.isPitcher ? { ...r, group: freeAgentRole(people[r.id]?.pitching, people[r.id]?.pitchingCareer) } : r,
)
const top = topByGroup(ranked)

// Only what a card draws: no notes, deals or WAR (WAR orders, never shows).
const card = (r) => {
  const c = topCard(r, people[r.id])
  return { id: c.id, name: c.name, first: c.first, last: c.last, pos: r.isPitcher ? r.group : c.pos, teamId: c.teamId, fields: c.fields }
}
const groups = Object.fromEntries(Object.entries(top).map(([g, list]) => [g, list.map(card)]))

await writeJsonAtomic(out, { generatedAt: new Date().toISOString(), season, groups })
console.log(`top-free-agents: ${season}, ${new Set(Object.values(groups).flat().map((c) => c.id)).size} players across ${Object.keys(groups).length} groups`)
