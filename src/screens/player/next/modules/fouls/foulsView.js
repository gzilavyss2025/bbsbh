import { foulCountCells } from '../../../../../api/fouls.js'
import { baseline, diffPts, pct, place, plural, signed } from '../../parts/foulsFormat.js'

// The Foul balls card's pure view (#1891): the 12-count grid, the rates per count and the three
// season baselines, each against the league. The cells come from `byCount` and the season totals
// from the total fields; they are not reconciled here (a few batters differ by 1 or 2, #1979).
const ENDS = [['hit', 'Hit'], ['walk', 'Walk'], ['out', 'Out in play'], ['so', 'Strikeout']]
const sum = (cells, key) => cells.reduce((a, c) => a + c[key], 0)

export function foulsView({ line, league }) {
  const mine = foulCountCells(line?.byCount)
  if (!mine || !line.pa) return null
  const theirs = league?.byCount
  const perVisit = mine.map((c) => (c.reach ? c.fouls / c.reach : 0))
  const hottest = Math.max(...perVisit)
  const cells = mine.map((c, i) => {
    const [b, s] = c.count.split('-').map(Number)
    const lgRate = theirs?.[i]?.foulsPerSwing ?? null
    return {
      i,
      name: c.count,
      words: `${plural(b, 'ball')}, ${plural(s, 'strike')}`,
      two: s === 2,
      reach: c.reach,
      reachPct: pct(c.reach / line.pa, 0),
      fouls: c.fouls,
      per100: `${Math.round(perVisit[i] * 100)} per 100 visits`,
      swings: c.swings,
      rate: pct(c.foulsPerSwing),
      lgRate: pct(lgRate),
      diff: diffPts(c.foulsPerSwing, lgRate),
      railFill: place(c.foulsPerSwing, 0.5),
      railTick: lgRate == null ? null : place(lgRate, 0.5),
      heat: hottest ? perVisit[i] / hottest : 0,
      ends: ENDS.map(([key, name]) => ({ key, name, n: c.ends[key], pct: pct(c.reach ? c.ends[key] / c.reach : null, 0) })),
    }
  })

  // Per swing is cells over cells, so the rate and its "of N swings" agree.
  const swings = sum(mine, 'swings')
  const hisSwing = swings ? sum(mine, 'fouls') / swings : null
  const lgSwing = theirs && sum(theirs, 'swings') ? sum(theirs, 'fouls') / sum(theirs, 'swings') : null
  const lgPa = league?.totals && theirs?.[0]?.reach ? league.totals.fouls / theirs[0].reach : null
  const hisPa = line.fouls / line.pa
  const rows = [
    baseline({
      key: 'swing', label: 'Per swing', title: 'Fouls per swing', scale: 0.5,
      his: hisSwing, lg: lgSwing, hisText: pct(hisSwing), lgText: pct(lgSwing),
      sub: `of ${swings.toLocaleString('en-US')} swings`, lgSub: 'all hitters',
      gap: diffPts(hisSwing, lgSwing),
    }),
    baseline({
      key: 'pa', label: 'Per PA', title: 'Fouls per plate appearance', scale: 1,
      his: hisPa, lg: lgPa, hisText: hisPa.toFixed(2), lgText: lgPa?.toFixed(2),
      sub: `${line.fouls} fouls in ${line.pa} PA`, lgSub: 'all hitters',
      gap: lgPa == null ? '' : signed(Number((hisPa - lgPa).toFixed(2)), Math.abs(hisPa - lgPa).toFixed(2)),
    }),
  ]
  const best = line.bestPa?.fouls
  if (best != null) {
    const med = league?.medianBestPaFouls ?? null
    rows.push(
      baseline({
        key: 'best', label: 'Best at-bat', title: 'Most fouls in one at-bat', scale: 14,
        his: best, lg: med, hisText: String(best), lgText: String(med),
        sub: 'in a single plate appearance', lgSub: 'median of hitters with 300+ PA',
        gap: med == null ? '' : signed(best - med, String(Math.abs(best - med))),
      }),
    )
  }
  return { pa: line.pa, cells, top: mine.reduce((m, c, i) => (c.fouls > mine[m].fouls ? i : m), 0), baseline: rows }
}
