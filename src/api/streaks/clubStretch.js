import { staticJsonBy } from '../staticJson.js'

// A club's best runs of 162 and 154 games in a row by one player, from
// public/data/club-stretch/{teamId}.json (hand-run scripts/franchise/gen-club-stretch.mjs):
//   { through, firstSeason, boards: { 162: { hr: rows, h, rbi, sb, avg, ops }, 154: { ... } } }
//   row: { id, name, team, first, last, value }   (team: the club's name of the time;
//   value: printed as the card prints it, "62" or ".352")
// Top ten, one row per player. A run counts his games played and ends when he plays for
// another club. MLB clubs only: any other id reads empty.
const load = staticJsonBy((id) => `/data/club-stretch/${id}.json`, {
  fallback: { through: null, firstSeason: null, boards: {} },
})

export async function clubStretch(teamId) {
  const d = await load(teamId)
  return { through: d.through ?? null, firstSeason: d.firstSeason ?? null, boards: d.boards ?? {} }
}
