import { radarGeometry } from '../../lib/radarGeometry.js'

// The percentile polygon — a five-spoke radar of this player's season Statcast
// percentiles, with the raw rate printed at each spoke. All geometry comes from
// the pure, unit-tested lib/radarGeometry.js; this file only turns numbers into
// SVG. Spokes and their order come from api/savantPercentiles.js's radarSpokes.
//
// No chart library, deliberately — the app has none, and a polygon is a list of
// points. Inline SVG also inherits the design tokens directly, so the shape
// picks up navy ink on manila the same way everything else does.
//
// ACCESSIBILITY. The polygon itself is decorative and marked aria-hidden: its
// shape encodes nothing a screen reader can use, and every number in it is
// already read out by the labelled percentile cards immediately beneath (see
// StatcastPercentiles). Same treatment as PitchMix's usage bar. The visible
// spoke labels are drawn as SVG <text>, so they stay selectable and scale with
// the viewBox rather than being baked into the shape.
//
// The seal amber is deliberately not used anywhere in here — that ink is
// reserved for score covers (CLAUDE.md's spoiler rule), and this card is
// spoiler-free season aggregate data.
export function StatRadar({ spokes }) {
  const geo = radarGeometry(spokes ?? [])
  if (!geo) return null

  const { width, height, center, outline, averageRing, shape, axes } = geo

  return (
    <div className="statradar">
      <svg
        className="statradar__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        {/* Rim = best in the league; dashed ring = the average player, which on
            a percentile scale is a constant at the 50th (see radarGeometry). */}
        <polygon className="statradar__rim" points={outline} />
        {axes.map((a) => (
          <line
            key={a.key}
            className="statradar__axis"
            x1={center.x}
            y1={center.y}
            x2={a.x2}
            y2={a.y2}
          />
        ))}
        <polygon className="statradar__avg" points={averageRing} />
        <polygon className="statradar__shape" points={shape} />

        {axes.map((a) => (
          <g key={a.key}>
            <text
              className="statradar__label"
              x={a.labelX}
              y={a.labelY}
              textAnchor={a.anchor}
              dominantBaseline={a.baseline}
            >
              {a.label}
              {/* Marks a spoke whose RAW number reads backwards from the
                  chart: the polygon is pre-flipped so farther out is always
                  better, so a good BB% spoke is long while its number is
                  small. */}
              {a.lowerIsBetter && <tspan className="statradar__down"> ↓</tspan>}
            </text>
            <text
              className="statradar__value"
              x={a.labelX}
              y={a.labelY}
              dy="1.15em"
              textAnchor={a.anchor}
              dominantBaseline={a.baseline}
            >
              {a.value ?? (a.percentile == null ? '—' : '')}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
