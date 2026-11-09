import { rankTop } from './rank.js'

// The season Pressure Moments page's lists (/pressure-moments), from the flat list of tense plays
// (tensest.json `plays`, every play at LI >= 4, #2981): the league's top 50, a
// club's top 25 batting and pitching, and the league list filtered by batter,
// pitcher, park and club. Pure. The page is not a scoring surface (ADR-0034).

const LEAGUE_SIZE = 50
const CLUB_SIZE = 25

// Which club batted and which pitched: the away club bats in the top half.
const batting = (r) => (r.top ? r.aw : r.hm)
const pitching = (r) => (r.top ? r.hm : r.aw)

export const leagueTop = (plays, size = LEAGUE_SIZE) => rankTop(plays ?? [], size)

export function clubTop(plays, teamId, side, size = CLUB_SIZE) {
  const pick = side === 'bat' ? batting : pitching
  return rankTop((plays ?? []).filter((r) => pick(r) === teamId), size)
}

// The plays that match every filter set (ids; an unset filter matches all), tensest first.
export function filterPlays(plays, { batter = null, pitcher = null, park = null, batting: bat = null, pitching: pit = null } = {}) {
  return (plays ?? []).filter((r) =>
    (batter == null || r.bid === batter) &&
    (pitcher == null || r.pid === pitcher) &&
    (park == null || r.vid === park) &&
    (bat == null || batting(r) === bat) &&
    (pit == null || pitching(r) === pit))
}

// Each batter, pitcher and park once, by name, for the filter pickers. A play
// with no park on record adds no park.
export function filterOptions(plays) {
  const sets = { batters: new Map(), pitchers: new Map(), parks: new Map() }
  for (const r of plays ?? []) {
    if (r.bid != null) sets.batters.set(r.bid, r.bn)
    if (r.pid != null) sets.pitchers.set(r.pid, r.pn)
    if (r.vid != null) sets.parks.set(r.vid, r.vn)
  }
  const list = (m) => [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  return { batters: list(sets.batters), pitchers: list(sets.pitchers), parks: list(sets.parks) }
}
