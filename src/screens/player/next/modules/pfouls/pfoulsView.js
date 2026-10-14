import { foulCountCells, MIN_PITCHER_PITCHES } from '../../../../../api/fouls.js'
import { ordinal } from '../../../../../lib/format.js'
import { baseline, diffPts, pct, place, plural, signed } from '../../parts/foulsFormat.js'

// The pitcher's Foul balls card, pure (#2016): the batter card's 12-count grid from his side, and
// three season baselines (foul rate, per whiff, fouled off) against the league with his rank.
// `line` is pitcherFoulLine in one scope; `league` is leagueFoulRates in that scope; `pool` is
// foulLeaders(...).pitchers.byFoulPct (200+ pitches), null in the postseason or when the whole
// file failed. A pitcher row has no `pa`: his batters are the 0-0 reach (#1993).
const ENDS = [['so', 'Strikeout'], ['out', 'Out in play'], ['walk', 'Walk'], ['hit', 'Hit']]
const THIN = 30
const FEW_SWINGS = 10 // a count with fewer swings draws no heat: one foul on one swing is not his hottest count
const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b)
  const m = s.length >> 1
  return !s.length ? null : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function pfoulsView({ id, line, league, pool, post = false }) {
  const mine = foulCountCells(line?.byCount)
  if (!mine) return null
  const pa = mine[0].reach
  const theirs = league?.byCount
  const heatOf = (c) => (c.swings >= FEW_SWINGS ? c.foulsPerSwing : 0)
  const hottest = Math.max(...mine.map(heatOf))
  const cells = mine.map((c, i) => {
    const [b, s] = c.count.split('-').map(Number)
    const lgRate = theirs?.[i]?.foulsPerSwing ?? null
    return {
      i,
      name: c.count,
      words: `${plural(b, 'ball')}, ${plural(s, 'strike')}`,
      two: s === 2,
      reach: c.reach,
      reachPct: pct(pa ? c.reach / pa : null, 0),
      fouls: c.fouls,
      per100: c.reach ? `${Math.round((c.fouls / c.reach) * 100)} per 100 visits` : 'no visits',
      swings: c.swings,
      rate: pct(c.foulsPerSwing),
      lgRate: pct(lgRate),
      diff: diffPts(c.foulsPerSwing, lgRate),
      railFill: place(c.foulsPerSwing, 0.5),
      railTick: lgRate == null ? null : place(lgRate, 0.5),
      heat: hottest ? heatOf(c) / hottest : 0,
      ends: ENDS.map(([key, name]) => ({ key, name, n: c.ends[key], pct: pct(c.reach ? c.ends[key] / c.reach : null, 0) })),
    }
  })

  const me = pool?.find((r) => r.personId === Number(id))
  const rankOf = (key) => {
    if (post) return 'Not ranked in the postseason'
    if (!pool) return ''
    if (!me) return `Not ranked: under ${MIN_PITCHER_PITCHES} pitches`
    if (me[key] == null) return ''
    const ranked = pool.filter((r) => r[key] != null)
    const n = 1 + ranked.filter((r) => r[key] > me[key]).length
    return `${ordinal(n)} most of ${ranked.length} pitchers with ${MIN_PITCHER_PITCHES}+ pitches`
  }
  const row = (r) => ({ ...baseline(r), lgName: r.lgName ?? 'MLB middle', lgSub: r.lg == null ? 'No league count' : 'all pitchers', rank: rankOf(r.rankKey), why: r.why })
  const hisRate = line.pitches ? line.fouls / line.pitches : null
  const hisWhiff = line.whiffs ? line.fouls / line.whiffs : null
  const lgRate = league?.foulRate ?? null
  const lgWhiff = pool ? median(pool.map((r) => r.foulsToWhiffs)) : null
  const lgFouls = pool ? Math.round(median(pool.map((r) => r.fouls))) : null
  const baselines = [
    row({
      key: 'rate', label: 'Foul rate', title: 'Fouls per pitch', scale: 0.35, rankKey: 'foulPct', lgName: 'League',
      his: hisRate, lg: lgRate, hisText: pct(hisRate), lgText: pct(lgRate),
      sub: `${line.fouls.toLocaleString('en-US')} of ${line.pitches.toLocaleString('en-US')} pitches`,
      gap: diffPts(hisRate, lgRate),
      why: 'How often a pitch he throws ends up foul.',
    }),
    row({
      key: 'whiff', label: 'Per whiff', title: 'Fouls per whiff', scale: 4, rankKey: 'foulsToWhiffs',
      his: hisWhiff, lg: lgWhiff, hisText: hisWhiff == null ? '—' : hisWhiff.toFixed(2), lgText: lgWhiff?.toFixed(2),
      sub: `${plural(line.fouls, 'foul')} · ${plural(line.whiffs, 'whiff')}`,
      gap: hisWhiff == null || lgWhiff == null ? '' : signed(Number((hisWhiff - lgWhiff).toFixed(2)), Math.abs(hisWhiff - lgWhiff).toFixed(2)),
      why: 'A high number means hitters touch his stuff but do not put it in play.',
    }),
    row({
      key: 'fouls', label: 'Fouled off', title: 'Pitches fouled off', scale: 700, rankKey: 'fouls',
      his: line.fouls, lg: lgFouls, hisText: line.fouls.toLocaleString('en-US'), lgText: lgFouls?.toLocaleString('en-US'),
      sub: `in ${plural(line.g, 'game')}`,
      gap: lgFouls == null ? '' : signed(line.fouls - lgFouls, Math.abs(line.fouls - lgFouls).toLocaleString('en-US')),
      why: 'A count, so it grows with innings. A starter sits high.',
    }),
  ]

  const outing = line.isStarter ? 'start' : 'outing'
  const thin =
    pa >= THIN
      ? null
      : post
        ? `${line.g === 1 ? `One postseason ${outing}` : `${line.g} postseason ${outing}s`}, ${plural(pa, 'batter')}: too few to draw the count grid.`
        : `Only ${plural(pa, 'batter')} on file: too few to draw the count grid.`
  return { pa, cells, top: mine.reduce((m, c, i) => (c.fouls > mine[m].fouls ? i : m), 0), thin, baseline: baselines }
}
