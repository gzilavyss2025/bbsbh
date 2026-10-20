import { staticJsonBy } from '../staticJson.js'
import { shardKey100 } from '../../lib/shardKey.js'

// Umpire history for the seasons before Tally's own umpire files (umpires.js, from
// 2023). Reads public/data/umpire-history/{NN}.json, which scripts/gen-umpire-history.mjs
// builds BY HAND from the Stats API schedule, 2000 to the season before the first one
// umpires.js holds. The files never hold a season umpires.js covers.
//
// SPOILER FOOTING: spoiler-FREE. Every game here is a past season's, ended long ago;
// a career line is not a score (ADR-0034).
//
// THE SHARD: { firstSeason, throughSeason, umpires: { id: { name, seasons, record } } }.
// A season row is [season, HP, 1B, 2B, 3B, LF, RF]. `record` is { teamId: [wins, losses] }
// in the games the umpire worked at home plate.
const fetchShard = staticJsonBy((key) => `/data/umpire-history/${key}.json`, { fallback: null })
const ROLES = ['HP', '1B', '2B', '3B', 'LF', 'RF']

const entryOf = async (umpireId) => {
  const shard = await fetchShard(shardKey100(umpireId))
  return { shard, entry: shard?.umpires?.[umpireId] ?? null }
}

// -> [{ season, games, byRole: { HP, 1B, 2B, 3B, LF, RF } }], oldest first; [] when missing.
export async function careerSeasons(umpireId) {
  const { entry } = await entryOf(umpireId)
  return (entry?.seasons ?? []).map(([season, ...counts]) => ({
    season,
    games: counts.reduce((a, b) => a + b, 0),
    byRole: Object.fromEntries(ROLES.map((r, i) => [r, counts[i] ?? 0])),
  }))
}

// -> { wins, losses, throughSeason }, or null when the club has no decided game with
// this umpire at home plate.
export async function recordWith(umpireId, teamId) {
  const { shard, entry } = await entryOf(umpireId)
  const row = entry?.record?.[teamId]
  return row ? { wins: row[0], losses: row[1], throughSeason: shard.throughSeason } : null
}
