// The Percentile rank module's pure view (#2011). Season Statcast ranks off a nightly static file;
// an open surface (ADR-0034), so nothing here is sealed.
import { medianRatesFor, percentileRows, savantPercentilesFor, savantRawFor } from '../../../../../api/savantPercentiles.js'
import { ordinal } from '../../../../../lib/format.js'

const DASH = '—'

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
      detail: `His ${value} · MLB median ${baseline} · better than ${r.percentile}% of ${pool}`,
      aria: `${r.label}: ${value}, MLB median ${baseline}, ${ord} percentile of ${pool}${r.lowerIsBetter ? '; lower is better, the rank already counts that' : ''}.`,
    }
  })
  return { rows, pool, tag: `vs ${pool}`, season: Number(data.season) }
}
