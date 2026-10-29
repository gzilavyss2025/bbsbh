import { staticJson } from '../staticJson.js'

// A club's retired numbers, from public/data/retired-numbers.json (hand-curated, #2598): the MLB API
// has none (teams/{id}?hydrate=retiredNumbers is null). Every entry is
// { number, name, role, year, source, checked }: `role` is player, manager, executive or other,
// `year` the year the club retired it (null when its source gives none), `source` the page it was
// read from and `checked` the day. Jackie Robinson's 42, retired by MLB in 1997, is one `league`
// entry rather than thirty club ones. A MiLB id, a missing file or an unknown club reads no numbers.
const load = staticJson('/data/retired-numbers.json', { fallback: { league: [], clubs: {} } })

export async function retiredNumbersFor(teamId) {
  const d = await load()
  return { numbers: d.clubs?.[teamId]?.numbers ?? [], league: d.league ?? [] }
}
