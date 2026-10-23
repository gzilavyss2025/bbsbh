import { staticJsonBy } from '../staticJson.js'

// A club's Hall of Famers, from public/data/franchise-hof/{teamId}.json (hand-run
// scripts/franchise/gen-franchise-hof.mjs, #2597). Two groups:
//   inductedAs:  [{ id, name, year }]           the club on the plaque (awards/MLBHOF/recipients)
//   alsoPlayed:  [{ id, name, year, seasons }]  played for the club, inducted as another club or
//                                               none; `seasons` are the years on this club
// `year` is the induction year. A player inducted as a club is not repeated in its alsoPlayed.
// A club keeps its team id across a move, so 158 holds the 1969 Pilots. MLB clubs only: a MiLB id
// has no file and reads empty.
const load = staticJsonBy((id) => `/data/franchise-hof/${id}.json`, {
  fallback: { inductedAs: [], alsoPlayed: [] },
})

export async function hallOfFamersFor(teamId) {
  const d = await load(teamId)
  return { inductedAs: d.inductedAs ?? [], alsoPlayed: d.alsoPlayed ?? [] }
}
