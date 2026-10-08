// Rebuilds the records test/crawl-parity.test.js reads (#1779) from the live
// Stats API, with the crawler's own hydrate. Run:
// node .scratch/player-bio-fixtures/build-crawl-fixtures.mjs
// Each file keeps only the fields the bio page and the crawler body read.
import { writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const OUT = new URL('../../test/fixtures/player-bio/', import.meta.url)
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]))
const write = (name, v) => writeFileSync(new URL(`${name}.json`, OUT), JSON.stringify(v, null, 2) + '\n')

const PERSON = [
  'id', 'fullName', 'active', 'currentAge', 'birthDate', 'deathDate', 'primaryNumber', 'height', 'weight',
  'birthCity', 'birthStateProvince', 'birthCountry', 'mlbDebutDate',
]
const PEOPLE = { canada: 665489, rodriguez: 655889, gill: 114794, 'aaron-deceased': 110001 }
for (const [name, id] of Object.entries(PEOPLE)) {
  const { people } = await getJson(`/api/v1/people/${id}?hydrate=currentTeam,stats(type=season),rosterEntries`)
  const p = people[0]
  write(name, {
    ...pick(p, PERSON),
    primaryPosition: pick(p.primaryPosition ?? {}, ['abbreviation', 'name']),
    batSide: pick(p.batSide ?? {}, ['description']),
    pitchHand: pick(p.pitchHand ?? {}, ['description']),
    currentTeam: pick(p.currentTeam ?? {}, ['id', 'name']),
    rosterEntries: (p.rosterEntries ?? []).map((e) => ({
      startDate: e.startDate,
      endDate: e.endDate,
      status: pick(e.status ?? {}, ['code']),
      team: pick(e.team ?? {}, ['id', 'name', 'parentOrgId']),
    })),
    stats: [],
  })
}

for (const [name, id] of Object.entries({ 'club-kia': 1190, 'club-dodgers': 119 })) {
  const { teams } = await getJson(`/api/v1/teams/${id}`)
  const t = teams[0]
  write(name, {
    ...pick(t, ['id', 'name', 'locationName', 'firstYearOfPlay']),
    venue: pick(t.venue ?? {}, ['id', 'name']),
    league: pick(t.league ?? {}, ['name']),
    division: pick(t.division ?? {}, ['name']),
    sport: pick(t.sport ?? {}, ['id']),
  })
}
