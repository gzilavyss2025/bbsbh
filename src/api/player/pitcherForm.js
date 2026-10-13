import { aggregateSplits } from '../person/stats.js'
import { inOrder } from '../hitterForm.js'
import { ipToOuts } from '../../lib/math/innings.js'
import { teamAbbr } from '../../lib/teams.js'

// The pitcher's Form trend (#1930): the rolling ERA, K% and BB% of his game log, one
// point per appearance once the window is full. The pitcher twin of hitterForm.js's
// rollingSeries, with the same point fields so the two cards share one chart.
// Pure: the caller hands over the gameLog splits it already fetched (regular season and
// October, MLB_LOG_GAME_TYPES) and the window the role calls for: `{ by: 'apps', w }` for
// a starter (pass his starts only) or `{ by: 'outs', w: 3 * IP }` for a reliever. Null
// when the log never fills one window. The stretches include October; `season` is the
// regular season only, the line the card compares them to.
const BF = (g) => Number(g.stat.battersFaced) || 0

function line(games) {
  const agg = aggregateSplits(games, 'pitching', { dedupe: false })
  const bf = games.reduce((t, g) => t + BF(g), 0)
  return {
    era: Number.parseFloat(agg.era),
    kPct: bf ? (100 * agg.strikeOuts) / bf : null,
    bbPct: bf ? (100 * agg.baseOnBalls) / bf : null,
    ip: agg.inningsPitched,
  }
}

export function pitcherRollingSeries(log, { by, w }) {
  const games = inOrder(log).filter((g) => BF(g) > 0)
  const outs = games.map((g) => ipToOuts(g.stat.inningsPitched))
  const spans = []
  let from = 0
  for (let end = 0, held = 0; end < games.length; end++) {
    held += outs[end]
    if (by === 'apps') {
      if (end + 1 < w) continue
      from = end + 1 - w
    } else {
      // Drop the oldest game while the rest still holds w outs.
      for (; held - outs[from] >= w; from++) held -= outs[from]
      if (held < w) continue
    }
    spans.push([from, end])
  }
  if (!spans.length) return null
  const regular = games.filter((g) => g.gameType === 'R')
  const points = spans.map(([a, b]) => {
    const last = games[b]
    return {
      date: last.date,
      gamePk: last.game?.gamePk,
      opp: teamAbbr(last.opponent),
      isHome: Boolean(last.isHome),
      summary: last.stat.summary,
      ...line(games.slice(a, b + 1)),
    }
  })
  const stretch = (better) => {
    const i = points.reduce((m, p, j) => (better(p.era, points[m].era) ? j : m), 0)
    return { startDate: games[spans[i][0]].date, endDate: points[i].date, era: points[i].era }
  }
  return { points, best: stretch((a, b) => a < b), worst: stretch((a, b) => a > b), season: regular.length ? line(regular) : null }
}
