import { aggregateSplits } from './person/stats.js'
import { teamAbbr } from '../lib/teams.js'

// Game-log rows with a stat line, oldest first.
export const inOrder = (log) =>
  (log ?? [])
    .filter((g) => g?.stat)
    .sort((a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      (a.game?.gameNumber ?? 0) - (b.game?.gameNumber ?? 0) ||
      (a.game?.gamePk ?? 0) - (b.game?.gamePk ?? 0))

// The form trend: the OPS of every w-game stretch, one point per game from game w
// on, plus the best and worst stretch (the first one on a tie). Only games with a
// plate appearance count, so a pinch-running or late-defense game does not stretch
// a window. Null when he has fewer than w such games.
export function rollingSeries(log, w) {
  const games = inOrder(log).filter((g) => Number(g.stat.plateAppearances) > 0)
  if (games.length < w) return null
  const points = games.slice(w - 1).map((last, i) => ({
    date: last.date,
    gamePk: last.game?.gamePk,
    opp: teamAbbr(last.opponent),
    isHome: Boolean(last.isHome),
    ops: Number.parseFloat(aggregateSplits(games.slice(i, i + w), 'hitting', { dedupe: false }).ops),
  }))
  const stretch = (better) => {
    const i = points.reduce((m, p, j) => (better(p.ops, points[m].ops) ? j : m), 0)
    return { startDate: games[i].date, endDate: points[i].date, ops: points[i].ops }
  }
  return { points, best: stretch((a, b) => a > b), worst: stretch((a, b) => a < b) }
}
