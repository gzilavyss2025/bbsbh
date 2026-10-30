// Pure half of gen-league-pennants.mjs: a season's postseason series in, its two
// pennants out. A league pennant is won by playing in the World Series, so the two
// clubs of the W series are the two league champions. That holds back to 1903, when
// the Series began (there was none in 1904 or 1994), and it needs no LCS data. The
// feed lists the current Series once both LCS are decided, played or not.
// The names are the ones the feed gives for THAT season (the 1948 Boston Braves).

const LEAGUE = { 103: 'AL', 104: 'NL' }

// `series` is the `series` array of /api/v1/schedule/postseason/series?hydrate=team.
export function pennantsOfSeason(season, series) {
  const games = (series ?? []).find((s) => s.games?.[0]?.gameType === 'W')?.games ?? []
  const game = games[0]
  if (!game) return []
  const champ = worldChampion(games)
  return ['away', 'home'].map((side) => {
    const t = game.teams[side].team
    const league = LEAGUE[t.league?.id]
    if (!league) throw new Error(`${season}: club ${t.id} has no AL or NL league`)
    const row = { teamId: t.id, season, league, name: t.name, club: t.franchiseName || t.name, abbr: t.abbreviation }
    return champ === t.id ? { ...row, ws: true } : row
  })
}

// The World Series winner's id, or null while the Series is unfinished. The last game's
// `leagueRecord` is the series record: the winner is the side whose wins pass half of
// `gamesInSeries` (4 of 7, 5 of the 1903 and 1919-21 best-of-nine).
export function worldChampion(games) {
  const last = games?.at(-1)
  const need = Math.floor(Number(last?.gamesInSeries) / 2) + 1
  if (!last || !need) return null
  for (const side of ['away', 'home']) {
    if (Number(last.teams?.[side]?.leagueRecord?.wins) >= need) return last.teams[side].team.id
  }
  return null
}

// { teamId: [{ season, league, name, club, abbr, ws? }] } (`ws`: won the World Series), each club oldest first.
export function groupByTeam(rows) {
  const out = {}
  for (const { teamId, ...p } of [...rows].sort((a, b) => a.season - b.season || a.teamId - b.teamId)) {
    const { season, league, name, club, abbr, ws } = p
    ;(out[teamId] ??= []).push({ season, league, name, club, abbr, ...(ws ? { ws } : null) })
  }
  return out
}
