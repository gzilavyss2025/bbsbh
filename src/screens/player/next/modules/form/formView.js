import { rollingSeries } from '../../../../../api/hitterForm.js'
import { aggregateSplits } from '../../../../../api/person/stats.js'
import { rate3 } from '../../../../../api/person/shared.js'
import { monthDayName } from '../../../../../lib/dates.js'

// The batter Form trend's pure view (#1889). rollingSeries (api/hitterForm.js) owns the
// maths: one OPS point per game from game w on, the best and worst stretch. This file
// shapes it for the chart and the table, and adds the cursor line.

export const WINDOWS = [10, 15, 20]
export const DEFAULT_WINDOW = 15
export const OUTCOMES = ['Extra-base', 'Single', 'Walk', 'Out', 'Strikeout']
export const ENDS = ['Hitter wins', 'Pitcher wins']
export const COLUMNS = [
  { key: 'pa', label: 'PA' },
  { key: 'ops', label: 'OPS' },
  { key: 'k', label: 'K' },
  { key: 'bb', label: 'BB' },
]

const n = (g, k) => Number(g.stat[k]) || 0
const sum = (games, k) => games.reduce((t, g) => t + n(g, k), 0)
const pct = (x, of) => (of ? `${Math.round((100 * x) / of)}%` : '—')
const signed = (d) => `${d < 0 ? '−' : '+'}${rate3(Math.abs(d))}`

// The game log (R and October rows) to the view, or null with fewer than w games with a plate
// appearance. `asOf` keeps the games before that day. The season line is the regular season's
// OPS, like the pitcher twin's; the stretches take October too.
export function formView(log, w, asOf) {
  const rows = (log ?? []).filter((g) => !asOf || g.date < asOf)
  const series = rollingSeries(rows, w)
  if (!series) return null
  // The games rollingSeries counted, in its order: its one-game series lists them.
  const byPk = new Map(rows.map((g) => [g.game?.gamePk, g]))
  const games = rollingSeries(rows, 1).points.map((p) => byPk.get(p.gamePk))
  const regular = games.filter((g) => g.gameType === 'R')
  const at = (s) => series.points.findIndex((p) => p.date === s.endDate && p.ops === s.ops)
  return {
    w,
    games,
    regular,
    seasonOps: regular.length ? Number.parseFloat(aggregateSplits(regular, 'hitting', { dedupe: false }).ops) : null,
    points: series.points.map((p, i) => ({ ...p, v: p.ops, mark: n(games[i + w - 1], 'homeRuns') > 0 })),
    best: at(series.best),
    worst: at(series.worst),
  }
}

// The card under the chart's title at point i: the big figure, the game, the gap to the season.
export function cursorText(view, i) {
  const { w, points, games, seasonOps } = view
  const p = points[i]
  const g = games[i + w - 1]
  const hr = n(g, 'homeRuns')
  const line = [
    `${n(g, 'hits')}-for-${n(g, 'atBats')}`,
    hr && (hr > 1 ? `${hr} HR` : 'HR'),
    n(g, 'baseOnBalls') && `${n(g, 'baseOnBalls')} BB`,
    n(g, 'strikeOuts') && `${n(g, 'strikeOuts')} K`,
  ].filter(Boolean)
  return {
    big: rate3(p.v),
    line1: [i === points.length - 1 && 'Latest', `Game ${i + w}`, monthDayName(p.date), `${p.isHome ? 'vs' : '@'} ${p.opp}`, line.join(', ')]
      .filter(Boolean)
      .join(' · '),
    line2: seasonOps == null ? '' : `${signed(p.v - seasonOps)} against his season OPS of ${rate3(seasonOps)}`,
  }
}

// One row of "How the stretches ended": PA, OPS, K% and BB%, and the five ways a plate
// appearance ended, left to right. `at` is the point the row jumps the cursor to (null: no jump).
function row(key, name, sub, games, at = null) {
  const pa = sum(games, 'plateAppearances')
  const hits = sum(games, 'hits')
  const xbh = sum(games, 'doubles') + sum(games, 'triples') + sum(games, 'homeRuns')
  const walks = sum(games, 'baseOnBalls') + sum(games, 'hitByPitch')
  const so = sum(games, 'strikeOuts')
  const counts = [xbh, hits - xbh, walks, Math.max(0, pa - hits - walks - so), so]
  const outs = Math.round((100 * (counts[3] + so)) / pa)
  return {
    key,
    name,
    sub,
    at,
    pa,
    ops: aggregateSplits(games, 'hitting', { dedupe: false }).ops,
    k: pct(so, pa),
    bb: pct(walks, pa),
    segs: counts.map((c) => ({ n: c, label: c / pa >= 0.08 ? String(Math.round((100 * c) / pa)) : '' })),
    good: `${100 - outs}% on base`,
    bad: `${outs}% outs`,
  }
}

// The table under the chart: the stretch at the cursor i, the season, the best and the worst.
export function stretchRows(view, i) {
  const { w, games, regular, best, worst } = view
  const span = (k) => games.slice(k, k + w)
  const dates = (k) => `${monthDayName(games[k].date)} to ${monthDayName(games[k + w - 1].date)}`
  return [
    row('cursor', 'At the cursor', `last ${w} games · ${dates(i)}`, span(i)),
    regular.length && row('season', 'Season', `${regular.length} games`, regular),
    row('best', 'Best stretch', `${w} games · ${dates(best)}`, span(best), best),
    row('worst', 'Worst stretch', `${w} games · ${dates(worst)}`, span(worst), worst),
  ].filter(Boolean)
}
