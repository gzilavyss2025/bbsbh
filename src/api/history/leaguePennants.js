import { staticJson } from '../staticJson.js'

// A club's league pennants, from public/data/league-pennants.json (hand-run
// scripts/gen-league-pennants.mjs): one row per World Series berth (the current season's once both LCS are decided), 1903 to the current
// season, with the name, club label and abbreviation of THAT year. The
// file starts in 1903, so the 1901-02 AL and the early NL pennants are not in it.
// Finished seasons, no game. A club with none, a MiLB id, or a
// missing file reads [].

const load = staticJson('/data/league-pennants.json', { fallback: { through: null, teams: {} } })

// Pure: a club's rows newest first, each tagged with its club's id.
export function pennantsList(file, teamId) {
  return (file?.teams?.[teamId] ?? []).map((p) => ({ ...p, teamId: Number(teamId) })).sort((a, b) => b.season - a.season)
}

// Pure: on a dated page (`asOfSeason`) the page's own season and later ones are left out,
// because that pennant may not be won yet. The player page's band follows the same rule.
export const pennantsBefore = (rows, asOfSeason) => (asOfSeason ? rows.filter((p) => p.season < asOfSeason) : rows)

export async function pennantsFor(teamId) {
  return pennantsList(await load(), teamId)
}

// The whole file, for a caller that matches many clubs at once (a player's seasons).
export const pennantFile = load
