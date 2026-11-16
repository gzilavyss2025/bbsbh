import { staticJsonBy } from '../staticJson.js'

// A club's best runs of 162 and 154 games in a row by one player, from
// public/data/club-stretch/{teamId}.json (hand-run scripts/franchise/gen-club-stretch.mjs):
//   { through, firstSeason, boards: { 162: { hr: rows, h, rbi, sb, avg, ops }, 154: { ... } } }
//   row: { id, name, team, first, last, value }   (team: the club's name of the time;
//   value: printed as the card prints it, "62" or ".352")
// Top ten, one row per player. A run counts his games played and ends when he plays for
// another club. MLB clubs only: any other id reads empty.
// Pitching (group 'pitching'): public/data/club-stretch-pitching/{teamId}.json, the same shape
// with boards { 32: { era, whip, k, kbb }, 65: { ... } } (32 starts, 65 relief outings).
const fallback = { through: null, firstSeason: null, boards: {} }
const loaders = {
  hitting: staticJsonBy((id) => `/data/club-stretch/${id}.json`, { fallback }),
  pitching: staticJsonBy((id) => `/data/club-stretch-pitching/${id}.json`, { fallback }),
}

export async function clubStretch(teamId, group = 'hitting') {
  const d = await (loaders[group] ?? loaders.hitting)(teamId)
  return { through: d.through ?? null, firstSeason: d.firstSeason ?? null, boards: d.boards ?? {} }
}
