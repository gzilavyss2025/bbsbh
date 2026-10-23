import { staticJsonBy } from '../staticJson.js'

// A club's all-time leaders, from public/data/franchise-leaders/{teamId}.json (hand-run
// scripts/franchise/gen-franchise-leaders.mjs, #2596). Regular season only, the feed's top ten
// with ties kept (a list can run past ten), 26 categories in two groups:
//   career: { homeRuns: [{ rank, id, name, value }], ... }
//   season: { homeRuns: [{ rank, id, name, value, season }], ... }
// `value` is a string as the feed writes it (".298", "3.10"). Keys are the feed's category names,
// except the pitcher's strikeouts, which is `pitchingStrikeouts` (`strikeouts` is the batter's).
// A club keeps its team id across a move, so 158 holds the 1969 Pilots too. MLB clubs only: a MiLB
// id has no file and reads empty. `through` is the season the run was made after.
const load = staticJsonBy((id) => `/data/franchise-leaders/${id}.json`, {
  fallback: { through: null, career: {}, season: {} },
})

export async function franchiseLeaders(teamId) {
  const d = await load(teamId)
  return { through: d.through ?? null, career: d.career ?? {}, season: d.season ?? {} }
}
