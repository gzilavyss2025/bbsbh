// A hand-made four-series history in the contract.md section 3 shape. Not data.
// Home club: odd game number -> clubs[1], even -> clubs[0]. `results` is the
// winner of each game in order; null is a tie.
export function mk(season, winsNeeded, clubs, results) {
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

// --- event-note helpers (notes-*.test.js) ---------------------------------
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'world-series')
export const playsOf = (pk) => JSON.parse(readFileSync(join(FIXTURES, `${pk}-plays.json`), 'utf8')).allPlays
export const EVENTS_JSON = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data', 'world-series', 'events.json'), 'utf8'))

// One hand-made play. Score is the running score after it.
export function pl(i, { inning = 1, top = true, ev = 'single', rbi = 0, bat = 100 + i, pit = 900, away = 0, home = 0, events = [] } = {}) {
  return {
    result: { eventType: ev, rbi, awayScore: away, homeScore: home, description: '' },
    about: { atBatIndex: i, inning, isTopInning: top, halfInning: top ? 'top' : 'bottom' },
    matchup: { batter: { id: bat }, pitcher: { id: pit } },
    playEvents: events,
    atBatIndex: i,
  }
}

// A live-feed shape the event notes read: type W, an official date, a status, the plays, a linescore.
export function feedOf(plays, { date = '2024-10-26', final = true } = {}) {
  const last = plays.at(-1)?.result ?? {}
  const innings = Array.from({ length: Math.max(...plays.map((p) => p.about.inning)) }, (_, k) => ({ num: k + 1 }))
  return {
    gameData: { game: { type: 'W' }, datetime: { officialDate: date }, status: { abstractGameState: final ? 'Final' : 'Live' } },
    liveData: {
      plays: { allPlays: plays },
      linescore: { innings, teams: { away: { runs: last.awayScore ?? 0 }, home: { runs: last.homeScore ?? 0 } } },
    },
  }
}

export const BUNDLE = { away: { teamId: 1, name: 'Aways' }, home: { teamId: 2, name: 'Homes' } }
