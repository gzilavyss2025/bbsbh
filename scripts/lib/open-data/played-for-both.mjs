// The pure half of scripts/gen-played-for-both.mjs (ADR-0100, #2579): for each pair of MLB
// clubs, every player with at least one MLB game for each, from the team-seasons rosters
// (Retrosheet, joined to MLBAM ids). It lives here because a generator file runs on import
// (scripts/CLAUDE.md).
//
// A franchise keeps its statsapi teamId when it moves, so every old Retrosheet code counts for
// the current club: Brooklyn (BRO) is club 119, Seattle (SE1) is 158. The map is the one the
// issue checked against the file: each of the 30 clubs has exactly one code per season, with no
// gap, from its first season to `throughSeason`. A code with no current club (the 1897-1899 NL
// clubs and the Federal League) is dropped. `BLA`, Baltimore 1901-1902, is the Yankees' first
// franchise, so it counts for 147.
//
// THE SCORE ranks who the card shows: career WAR (every bat and pit season in war-history) times
// a recency factor, the Former teammates curve (`stintScore`, gen-former-teammates.mjs):
// 0.4 + 0.6 * 0.9^yearsAgo. `yearsAgo` is `throughSeason` minus the player's last season with
// EITHER club, never the clock, so a re-run writes the same bytes. No WAR entry scores 0.
//
// No clock, no download: same input, same bytes.

export const CLUB_CODES = {
  108: ['LAA', 'CAL', 'ANA'],
  109: ['ARI'],
  110: ['MLA', 'SLA', 'BAL'],
  111: ['BOS'],
  112: ['CHN'],
  113: ['CIN'],
  114: ['CLE'],
  115: ['COL'],
  116: ['DET'],
  117: ['HOU'],
  118: ['KCA'],
  119: ['BRO', 'LAN'],
  120: ['MON', 'WAS'],
  121: ['NYN'],
  133: ['PHA', 'KC1', 'OAK', 'ATH'],
  134: ['PIT'],
  135: ['SDN'],
  136: ['SEA'],
  137: ['NY1', 'SFN'],
  138: ['SLN'],
  139: ['TBA'],
  140: ['WS2', 'TEX'],
  141: ['TOR'],
  142: ['WS1', 'MIN'],
  143: ['PHI'],
  144: ['BSN', 'MLN', 'ATL'],
  145: ['CHA'],
  146: ['FLO', 'MIA'],
  147: ['BLA', 'NYA'],
  158: ['SE1', 'MIL'],
}

export const CODE_TO_CLUB = new Map(Object.entries(CLUB_CODES).flatMap(([id, codes]) => codes.map((c) => [c, Number(id)])))

export const TOP_COUNT = 12

// The recency factor: 1 for a player last seen in `throughSeason`, falling toward 0.4.
export const recency = (yearsAgo) => 0.4 + 0.6 * 0.9 ** yearsAgo

export const scoreOf = (careerWar, throughSeason, lastSeason) => careerWar * recency(throughSeason - lastSeason)

// Career WAR per player, from parsed war-history shards ({ bat: { id: { season: war } }, pit }).
// A two-way player counts both sides. Rounded to two places so the sum never carries float dust.
export function careerWarFrom(shards) {
  const total = new Map()
  for (const shard of shards) {
    for (const side of [shard.bat, shard.pit]) {
      for (const [id, seasons] of Object.entries(side ?? {})) {
        const sum = Object.values(seasons).reduce((a, w) => a + (Number(w) || 0), 0)
        total.set(Number(id), (total.get(Number(id)) ?? 0) + sum)
      }
    }
  }
  for (const [id, w] of total) total.set(id, Math.round(w * 100) / 100)
  return total
}

// team-seasons.json's compact shape ({ players, teamSeasons: [[key, label, [index]]] }) ->
// Map(teamId -> Map(playerId -> sorted unique seasons)). A key is "CODE-YEAR".
export function seasonsByClub(file) {
  const out = new Map()
  for (const [key, , indexes] of file.teamSeasons) {
    const at = key.lastIndexOf('-')
    const club = CODE_TO_CLUB.get(key.slice(0, at))
    if (!club) continue
    const season = Number(key.slice(at + 1))
    const roster = out.get(club) ?? new Map()
    for (const i of indexes) {
      const id = file.players[i]
      const seen = roster.get(id) ?? []
      if (!seen.includes(season)) seen.push(season)
      roster.set(id, seen)
    }
    out.set(club, roster)
  }
  for (const roster of out.values()) for (const seasons of roster.values()) seasons.sort((a, b) => a - b)
  return out
}

// -> Map("a-b" (ids ascending) -> { teams: [a, b], throughSeason, top: [ids], rows }). `names` is
// Map(playerId -> "First Last"), `war` is careerWarFrom's map. `rows` are
// [id, name, seasonsWithA, seasonsWithB], most recent first (last season with either club), then
// higher score, then lower id. `top` is the best TOP_COUNT by score, then lower id.
export function buildPlayedForBoth({ file, names, war, topCount = TOP_COUNT }) {
  const through = file.throughSeason
  const clubs = seasonsByClub(file)
  const ids = [...clubs.keys()].sort((x, y) => x - y)
  const shards = new Map()
  for (const [ai, a] of ids.entries()) {
    for (const b of ids.slice(ai + 1)) {
      const mine = clubs.get(a)
      const theirs = clubs.get(b)
      const both = []
      for (const [id, seasonsA] of mine) {
        const seasonsB = theirs.get(id)
        if (!seasonsB) continue
        const last = Math.max(seasonsA.at(-1), seasonsB.at(-1))
        both.push({ id, name: names.get(id) ?? '', seasonsA, seasonsB, last, score: scoreOf(war.get(id) ?? 0, through, last) })
      }
      const rows = [...both].sort((x, y) => y.last - x.last || y.score - x.score || x.id - y.id)
      const top = [...both].sort((x, y) => y.score - x.score || x.id - y.id).slice(0, topCount)
      shards.set(`${a}-${b}`, {
        teams: [a, b],
        throughSeason: through,
        top: top.map((p) => p.id),
        rows: rows.map((p) => [p.id, p.name, p.seasonsA, p.seasonsB]),
      })
    }
  }
  return shards
}
