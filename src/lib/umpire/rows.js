// The umpire shard's game rows, packed (#2288). A row used to carry both clubs'
// abbreviation, the venue name and both isWinner flags, repeated for every game
// an umpire worked. The pack moves the first three into per-shard `teams` and
// `venues` tables keyed by id, and drops a winner flag the scores already give.
// Lossless: a value the tables or the scores cannot give stays on its row.

// A winner flag the scores imply. Level scores name a winner for neither side.
function impliedWins(g) {
  const { awayScore: a, homeScore: h } = g
  if (a == null || h == null || a === h) return { away: null, home: null }
  return { away: a > h, home: h > a }
}

export function packUmpireGames(games) {
  const teams = {}
  const venues = {}
  const rows = games.map((g) => {
    const row = { ...g }
    for (const [idKey, abbrKey] of [['awayId', 'awayAbbr'], ['homeId', 'homeAbbr']]) {
      const id = g[idKey]
      if (id == null || g[abbrKey] === undefined) continue
      if (teams[id] !== undefined && teams[id] !== g[abbrKey]) continue
      teams[id] = g[abbrKey]
      delete row[abbrKey]
    }
    if (g.venueId != null && g.venueName !== undefined && (venues[g.venueId] === undefined || venues[g.venueId] === g.venueName)) {
      venues[g.venueId] = g.venueName
      delete row.venueName
    }
    const implied = impliedWins(g)
    if (g.awayIsWinner === implied.away && g.homeIsWinner === implied.home) {
      delete row.awayIsWinner
      delete row.homeIsWinner
    }
    return row
  })
  return { teams, venues, games: rows }
}

// The reverse. A shard written before the pack (no `teams`) passes through.
export function unpackUmpireGames(shard) {
  const { teams, venues, games } = shard ?? {}
  if (!teams || !Array.isArray(games)) return games ?? []
  return games.map((g) => {
    const implied = impliedWins(g)
    return {
      ...g,
      awayAbbr: g.awayAbbr ?? teams[g.awayId],
      homeAbbr: g.homeAbbr ?? teams[g.homeId],
      venueName: g.venueName ?? venues?.[g.venueId],
      awayIsWinner: 'awayIsWinner' in g ? g.awayIsWinner : implied.away,
      homeIsWinner: 'homeIsWinner' in g ? g.homeIsWinner : implied.home,
    }
  })
}
