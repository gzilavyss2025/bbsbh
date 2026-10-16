// The pure half of scripts/gen-world-series.mjs: schedule rows plus a play-by-play per
// gamePk in, the series.json shape of .scratch/world-series-callouts/contract.md §3 out.
// The data traps it handles (contract §2): key by gamePk and keep the played date, a tie
// has no winner, the final score is the last play, number games (date, gamePk) ourselves,
// and read the Series length from the data.

// Flatten a schedule response to its game rows, in listing order.
export const gamesOf = (schedule) => (schedule?.dates ?? []).flatMap((d) => d.games ?? [])

// The score after the highest atBatIndex.
export function finalScore(plays) {
  const last = plays.allPlays.reduce((a, b) => (b.about.atBatIndex > a.about.atBatIndex ? b : a))
  return { away: last.result.awayScore, home: last.result.homeScore }
}

// Distinct gamePks, last listing wins: a postponed game is listed under its old date
// and again on the day it was played.
export const dedupeByPk = (rows) => [...new Map(rows.map((g) => [g.gamePk, g])).values()]

export function buildSeries(season, rows, playsByPk) {
  const games = dedupeByPk(rows)
    .map((g) => {
      const { away, home } = finalScore(playsByPk[g.gamePk])
      return {
        pk: g.gamePk, date: g.officialDate, away: g.teams.away.team.id, home: g.teams.home.team.id,
        awayRuns: away, homeRuns: home, innings: g.linescore?.innings?.length ?? null,
        venue: g.venue?.id ?? null, tie: away === home,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.pk - b.pk)
    .map((g, i) => ({ ...g, n: i + 1 }))
  const wins = new Map()
  for (const g of games) {
    if (g.tie) continue
    const w = g.awayRuns > g.homeRuns ? g.away : g.home
    wins.set(w, (wins.get(w) ?? 0) + 1)
  }
  const [winner, winsNeeded] = [...wins].sort((a, b) => b[1] - a[1])[0]
  return {
    season, winsNeeded, clubs: [games[0].away, games[0].home], winner,
    games: games.map(({ pk, n, date, away, home, awayRuns, homeRuns, innings, venue, tie }) =>
      ({ pk, n, date, away, home, awayRuns, homeRuns, innings, venue, tie })),
  }
}

export function buildFile(seasons, rowsBySeason, playsByPk) {
  // 1904 and 1994 have no World Series: a season with no games is skipped.
  const series = seasons.filter((s) => rowsBySeason[s].length).map((s) => buildSeries(s, rowsBySeason[s], playsByPk))
  const games = series.reduce((n, s) => n + s.games.length, 0)
  const ties = series.reduce((n, s) => n + s.games.filter((g) => g.tie).length, 0)
  return {
    coverage: { from: seasons[0], through: seasons.at(-1), seasons: series.length, games, ties },
    series,
  }
}
