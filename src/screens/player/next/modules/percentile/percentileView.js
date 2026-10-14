// The Percentile rank module's pure view (#2011). Season Statcast ranks off a nightly static file;
// an open surface (ADR-0034), so nothing here is sealed.
import { medianRatesFor, percentileRows, savantPercentilesFor, savantRawFor } from '../../../../../api/savantPercentiles.js'
import { ordinal } from '../../../../../lib/format.js'
import { DASH } from '../../../../../api/person/shared.js'

// Savant ranks a longer swing higher and the app keeps that order (#1984, Q4), so the shared
// sentence ("a shorter swing gets there quicker") is wrong on this card.
// ponytail: drop this once savantPercentiles.js carries the fixed sentence.
const GLOSS = {
  swingLength:
    'How far his bat travels on its way to the ball. Savant ranks a longer swing higher, so a short swing reads low here.',
}

// Top third mint with a triangle up, bottom third clay with a triangle down, the middle plain.
export function tierOf(p) {
  if (p >= 67) return { tier: 'top', mark: '▲' }
  if (p <= 33) return { tier: 'low', mark: '▼' }
  return { tier: 'mid', mark: '' }
}

// null when the file is another season, he is not in it, or he has under three rows.
export function percentileView(data, id, role, season) {
  if (!data || Number(season) !== Number(data.season)) return null
  const savant = savantPercentilesFor(data, id, role)
  const raw = savantRawFor(data, id, role)
  const bare = percentileRows(savant, raw, role, null)
  if (!bare) return null
  const withMedian = percentileRows(savant, raw, role, medianRatesFor(data, role))
  // Savant ranks each metric against its own qualified pool (bat tracking is a much smaller one),
  // so each row counts the players ranked on that metric.
  const ranks = Object.values((role === 'pitching' ? data.pit : data.bat) ?? {})
  const noun = role === 'pitching' ? 'pitcher' : 'hitter'
  const poolOf = (key) => {
    const n = ranks.filter((r) => r?.[key] != null).length
    return `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`
  }
  const pool = role === 'pitching' ? 'all pitchers' : `${Object.keys(data.bat ?? {}).length} hitters`
  const rows = bare.map((r) => {
    const value = r.value ?? DASH
    const baseline = withMedian.find((m) => m.key === r.key)?.baseline ?? DASH
    const def = GLOSS[r.key] ?? r.def
    const ord = ordinal(r.percentile)
    return {
      key: r.key,
      label: r.label,
      percentile: r.percentile,
      ord,
      value,
      baseline,
      lowerIsBetter: r.lowerIsBetter,
      def,
      ...tierOf(r.percentile),
      // Swing length keeps Savant's order: a high rank is a long swing, not a better one.
      detail: `His ${value} · MLB median ${baseline} · ${r.key === 'swingLength' ? `${ord} percentile of` : `better than ${r.percentile}% of`} ${poolOf(r.key)}`,
      aria: `${r.label}: ${value}, MLB median ${baseline}, ${ord} percentile of ${poolOf(r.key)}${r.lowerIsBetter ? '; lower is better, the rank already counts that' : ''}.`,
    }
  })
  return { rows, pool, tag: `vs ${pool}`, season: Number(data.season) }
}
