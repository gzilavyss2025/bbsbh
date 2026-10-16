// A hand-made four-series history in the contract.md section 3 shape. Not data.
// Home club: odd game number -> clubs[1], even -> clubs[0]. `results` is the
// winner of each game in order; null is a tie.
function mk(season, winsNeeded, clubs, results) {
  const games = results.map((w, i) => {
    const n = i + 1
    const home = n % 2 ? clubs[1] : clubs[0]
    const away = home === clubs[0] ? clubs[1] : clubs[0]
    const [awayRuns, homeRuns] = w === null ? [2, 2] : w === home ? [1, 3] : [3, 1]
    return {
      pk: season * 100 + n, n, date: `${season}-10-${String(n + 10).padStart(2, '0')}`,
      away, home, awayRuns, homeRuns, innings: 9, venue: null, tie: w === null,
    }
  })
  const decided = results.filter((w) => w !== null)
  return { season, winsNeeded, clubs, winner: decided.at(-1), games }
}

export const HISTORY = {
  coverage: { from: 1990, through: 2000, seasons: 4, games: 0, ties: 1 },
  series: [
    mk(1990, 4, [1, 2], [1, 1, 1, 1]), // sweep: Game 1 winner and a 2-0 leader won
    mk(1991, 4, [3, 4], [3, 3, 4, 3, 4, 4, 4]), // 3-1 comeback; Game 7 won at home
    mk(1992, 5, [1, 3], [null, 1, 3, 1, 3, 1, 3, 1, 3, 3]), // best of nine, a tie; Game 10 won on the road
    mk(2000, 4, [1, 2], [1, 2, 1, 2, 2, 1, 1]), // Game 7 won on the road
  ],
}

// A callouts bundle heading into a game of a Series between `away` and `home`,
// with `winners` the winner (club id, or null for a tie) of each earlier game.
export function bundleAfter(away, home, winners) {
  const clubs = [away, home]
  return {
    away: { teamId: away, name: `Club${away}` },
    home: { teamId: home, name: `Club${home}` },
    series: {
      id: 'ws',
      games: winners.map((w, i) => {
        const n = i + 1
        const h = n % 2 ? clubs[1] : clubs[0]
        const a = h === clubs[0] ? clubs[1] : clubs[0]
        const [ar, hr] = w === null ? [2, 2] : w === h ? [1, 3] : [3, 1]
        return { gamePk: n, n, date: `2001-10-${String(n + 10).padStart(2, '0')}`, awayId: a, homeId: h, runs: { away: ar, home: hr } }
      }),
    },
  }
}
