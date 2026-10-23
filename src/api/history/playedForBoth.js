import { staticJsonBy } from '../staticJson.js'
import { matchupKey } from '../formerTeammates.js'

// Everyone who appeared in an MLB game for each of two clubs, from
// public/data/played-for-both/{a}-{b}.json (hand-run scripts/gen-played-for-both.mjs, #2579).
// One shard per club pair, ids ascending, so both clubs' lineup pages read the same file. A row is
// [id, name, seasons with the lower-id club, seasons with the higher-id club], most recent first.
// `top` is up to 12 ids, best first, for the card. Retired players count. MLB clubs only: a MiLB
// pair has no file and reads empty. History by club and season, no game, so it is open.

const EMPTY = { credit: [], throughSeason: null, teams: [], top: [], rows: [] }

const load = staticJsonBy((key) => `/data/played-for-both/${key}.json`, { fallback: null })

// -> { credit, throughSeason, teams: [lo, hi],
//      top: [{ id, name, seasons }], rows: [{ id, name, seasons }] }
// with `seasons` = { [teamId]: [season, ...] }. The same answer for either club order.
export async function playedForBoth(teamIdA, teamIdB) {
  if (!teamIdA || !teamIdB) return EMPTY
  const shard = await load(matchupKey(teamIdA, teamIdB))
  if (!shard?.teams?.length) return EMPTY
  const [lo, hi] = shard.teams
  const rows = (shard.rows ?? []).map(([id, name, withLo, withHi]) => ({ id, name, seasons: { [lo]: withLo, [hi]: withHi } }))
  const byId = new Map(rows.map((r) => [r.id, r]))
  return {
    credit: shard.credit ?? [],
    throughSeason: shard.throughSeason ?? null,
    teams: [lo, hi],
    top: (shard.top ?? []).map((id) => byId.get(id)).filter(Boolean),
    rows,
  }
}
