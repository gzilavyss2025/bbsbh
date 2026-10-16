import { inOrder } from '../../../../../api/hitterForm.js'
import { pitcherRole } from '../../../../../api/person/identity.js'
import { pitcherRollingSeries } from '../../../../../api/player/pitcherForm.js'
import { eraOf } from '../../../../../api/person/shared.js'
import { ipToOuts, outsToIp } from '../../../../../lib/math/innings.js'
import { monthDayName } from '../../../../../lib/dates.js'

// The pitcher Form trend's pure view (#1930). pitcherRollingSeries (api/player/pitcherForm.js)
// owns the maths: one ERA, K% and BB% point per appearance once the window is full. This file
// picks the window by role, shapes the points for the shared chart and table (../form/), and
// adds the cursor line.

// A starter's window counts starts; a reliever's counts innings (3 outs each), because a
// reliever's ERA over a few outings swings from 0.00 to 9.00 on one bad inning.
export const CHIPS = {
  SP: { windows: [3, 5, 10], pick: 5, unit: 'starts' },
  RP: { windows: [10, 15, 20], pick: 15, unit: 'IP' },
}
// The fourth chip, after the fixed windows: the season to date, which grows with each game and
// so never stops at 20 IP or 10 starts. It is a `w` like the numbers, and takes no count.
export const SEASON = 'season'
export const chipsOf = (kind) => [...CHIPS[kind].windows, SEASON]
export const COLUMNS = [
  { key: 'ip', label: 'IP' },
  { key: 'era', label: 'ERA' },
  { key: 'k', label: 'K%' },
  { key: 'bb', label: 'BB%' },
]

const n = (g, k) => Number(g.stat[k]) || 0
const sum = (games, k) => games.reduce((t, g) => t + n(g, k), 0)
const outsOf = (games) => games.reduce((t, g) => t + ipToOuts(g.stat.inningsPitched), 0)
const pct = (x, of) => (of ? `${Math.round((100 * x) / of)}%` : '—')
// A signed gap printed to k places; a gap that prints as zero carries no sign.
const dp = (d, k) => {
  const r = Number(d.toFixed(k))
  return r ? `${r < 0 ? '−' : '+'}${Math.abs(r).toFixed(k)}` : (0).toFixed(k)
}

// The chart's two readings. `better` is which way the green fill runs.
export const METRICS = {
  era: { label: 'ERA', digits: 2, better: 'down', step: 1, format: (v) => v.toFixed(2) },
  kPct: { label: 'K%', digits: 1, better: 'up', step: 5, format: (v) => `${+v.toFixed(1)}%` },
  // Velocity (#1933) is offered only once a pitcher has a speed on file (withSpeed). It has no season line.
  mph: { label: 'Velocity', digits: 1, better: 'up', step: 1, format: (v) => `${v.toFixed(1)} mph` },
}

// 'SP' or 'RP' (a closer reads as a reliever) from the log's totals before `asOf`, or null with
// no appearance. pitcherRole wants the season stat, which the log sums to; an October-only log
// reads from its October rows.
export function roleOf(log, asOf) {
  const dated = (log ?? []).filter((g) => !asOf || g.date < asOf)
  const rows = dated.some((g) => g.gameType === 'R') ? dated.filter((g) => g.gameType === 'R') : dated
  const role = pitcherRole({ gamesPitched: rows.length, gamesStarted: sum(rows, 'gamesStarted'), saves: sum(rows, 'saves') })
  return role && (role === 'SP' ? 'SP' : 'RP')
}

// The game log (R and October rows) to the view, or null when the log never fills one window.
// `w` is the chip: starts for 'SP', innings for 'RP', or SEASON for every game so far (null with
// fewer than two games, which is no trend). `asOf` keeps the games before that day.
// The stretches take October too and a starter's count his starts only; the season line is his
// regular season whole (a relief outing included), the line the box score and the hero show.
export function pformView(log, kind, w, asOf) {
  const starter = kind === 'SP'
  const dated = (log ?? []).filter((g) => !asOf || g.date < asOf)
  const rows = starter ? dated.filter((g) => n(g, 'gamesStarted') > 0) : dated
  const whole = w === SEASON
  const series = pitcherRollingSeries(rows, whole ? { by: 'all' } : { by: starter ? 'apps' : 'outs', w: starter ? w : 3 * w })
  if (!series || (whole && series.points.length < 2)) return null
  // The games the series counted, in its order. Its points are the last ones: one per game from the first full window on.
  const games = inOrder(rows).filter((g) => n(g, 'battersFaced') > 0 || outsOf([g]) > 0)
  const ends = series.points.map((_, i) => games.length - series.points.length + i)
  const regular = dated.filter((g) => g.gameType === 'R')
  const bf = sum(regular, 'battersFaced')
  return {
    starter,
    games,
    regular,
    points: series.points,
    season: regular.length && { era: eraOf(sum(regular, 'earnedRuns'), outsOf(regular)), kPct: bf ? (100 * sum(regular, 'strikeOuts')) / bf : null },
    // Each point's first game: the last w starts, or the fewest outings holding w innings. The season's is the first.
    starts: ends.map((end) => {
      if (whole) return 0
      if (starter) return end + 1 - w
      let from = end
      for (let held = outsOf([games[end]]); held < 3 * w; held += outsOf([games[--from]]));
      return from
    }),
    ends,
  }
}

const extreme = (points, k, up) => points.reduce((m, p, i) => ((up ? p[k] > points[m][k] : p[k] < points[m][k]) ? i : m), 0)

// What FormChart takes for one metric: the points with their value, the season line, and the
// indexes of the best and worst stretch (lowest ERA, highest K%).
export function chartOf(view, metric) {
  const { better, step, format } = METRICS[metric]
  const up = better === 'up'
  // A point with no value (a window with no speed) is left off the chart; `idx` keeps its place in the card.
  const idx = view.points.flatMap((p, i) => (p[metric] == null ? [] : [i]))
  const points = idx.map((i) => view.points[i])
  return {
    points: points.map((p) => ({ ...p, v: p[metric] })),
    idx,
    season: view.season?.[metric] ?? null,
    better,
    step,
    format,
    best: extreme(points, metric, up),
    worst: extreme(points, metric, !up),
  }
}

// The games whose speeds the velocity series needs: those inside the first window on, none other.
export const shownGames = (view) => view.games.slice(view.starts[0])

// The view with a `mph` on each point: the mean of the primary-fastball speeds in its window, or
// null when none of its games has one. `bySpk` maps gamePk to mph or null. Null with no speed at all.
export function withSpeed(view, bySpk) {
  const mean = (a) => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : null)
  const points = view.points.map((p, k) => ({
    ...p,
    mph: mean(view.games.slice(view.starts[k], view.ends[k] + 1).map((g) => bySpk[g.game?.gamePk]).filter((x) => x != null)),
  }))
  return points.some((p) => p.mph != null) ? { ...view, points } : null
}

// The card under the chart's title at point i: the big figure, the game, the gap to the season.
export function cursorText(view, i, metric) {
  const { points, ends, starter } = view
  const { format, digits } = METRICS[metric]
  const p = points[i]
  const season = view.season?.[metric]
  // The gap is between the two printed figures, so 3.4551 against a season of 3.46 reads no gap.
  const rounded = (v) => Number(v.toFixed(digits))
  const gap = (d) => (metric === 'era' ? dp(d, digits) : `${dp(d, digits)} pts`)
  return {
    big: p[metric] == null ? '—' : format(p[metric]),
    line1: [i === points.length - 1 && 'Latest', `${starter ? 'Start' : 'Game'} ${ends[i] + 1}`, monthDayName(p.date), `${p.isHome ? 'vs' : '@'} ${p.opp}`, p.summary]
      .filter(Boolean)
      .join(' · '),
    line2: season == null ? '' : `${gap(rounded(p[metric]) - rounded(season))} against his season ${METRICS[metric].label} of ${format(season)}`,
  }
}

// One row of "How the stretches ended": IP, ERA, K% and BB%, and the five ways a plate
// appearance ended, left to right (the batter card's order). `at` is the point the row jumps to.
function row(key, name, sub, games, at = null) {
  const bf = sum(games, 'battersFaced')
  const hits = sum(games, 'hits')
  const xbh = sum(games, 'doubles') + sum(games, 'triples') + sum(games, 'homeRuns')
  const walks = sum(games, 'baseOnBalls') + sum(games, 'hitByPitch')
  const so = sum(games, 'strikeOuts')
  const outs = outsOf(games)
  const counts = [xbh, hits - xbh, walks, Math.max(0, bf - hits - walks - so), so]
  const out = Math.round((100 * (counts[3] + so)) / bf) // NaN with no batters faced; good and bad then print a dash
  return {
    key,
    name,
    sub,
    at,
    ip: outsToIp(outs),
    era: eraOf(sum(games, 'earnedRuns'), outs)?.toFixed(2) ?? '—',
    k: pct(so, bf),
    bb: pct(sum(games, 'baseOnBalls'), bf), // walks alone, as the series' bbPct counts them
    segs: counts.map((c) => ({ n: c, label: c / bf >= 0.08 ? String(Math.round((100 * c) / bf)) : '' })),
    good: bf ? `${100 - out}% on base` : '—',
    bad: bf ? `${out}% outs` : '—',
  }
}

// The table under the chart: the stretch at the cursor i, the season, the best and the worst.
export function stretchRows(view, i, metric) {
  const { games, regular, starts, ends, starter } = view
  const chart = chartOf(view, metric)
  const [best, worst] = [chart.idx[chart.best], chart.idx[chart.worst]]
  const span = (k) => games.slice(starts[k], ends[k] + 1)
  const sub = (k) => {
    const g = span(k)
    return `${g.length} ${starter ? 'starts' : g.length === 1 ? 'game' : 'games'} · ${monthDayName(g[0].date)} to ${monthDayName(g.at(-1).date)}`
  }
  return [
    row('cursor', 'At the cursor', sub(i), span(i)),
    regular.length && row('season', 'Season', `${regular.length} games`, regular),
    row('best', 'Best stretch', sub(best), span(best), best),
    row('worst', 'Worst stretch', sub(worst), span(worst), worst),
  ].filter(Boolean)
}
