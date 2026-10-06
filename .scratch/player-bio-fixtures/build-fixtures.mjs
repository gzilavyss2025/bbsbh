// Rebuilds test/fixtures/player-bio/*.json from the live Stats API (checked
// 2026-10-06). Run: node .scratch/player-bio-fixtures/build-fixtures.mjs
// Each file keeps only the person fields the bio selectors read. The search
// file keeps only the fields searchPeople reads.
import { mkdirSync, writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const OUT = new URL('../../test/fixtures/player-bio/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const get = getJson
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]))

const PEOPLE = { yelich: 592885, gray: 543243, aaron: 110001 }
for (const [name, id] of Object.entries(PEOPLE)) {
  const { people } = await get(`/api/v1/people/${id}?hydrate=currentTeam,team,draft,rosterEntries,education`)
  const keys = ['id', 'fullName', 'nickName', 'birthCity', 'birthStateProvince', 'birthCountry', 'education']
  writeFileSync(new URL(`${name}.json`, OUT), JSON.stringify(pick(people[0], keys), null, 2) + '\n')
}

const { people } = await get('/api/v1/people/search?names=will%20smith&hydrate=currentTeam')
const keys = ['id', 'fullName', 'active', 'mlbDebutDate', 'lastPlayedDate']
writeFileSync(
  new URL('search-will-smith.json', OUT),
  JSON.stringify(people.map((p) => ({ ...pick(p, keys), primaryPosition: pick(p.primaryPosition ?? {}, ['abbreviation', 'code']) })), null, 2) + '\n',
)
