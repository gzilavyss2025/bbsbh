import { useId } from 'react'
import { REGIONS, mapBox, regionRect, stanceRect } from './model.js'

// ONE 13-REGION MAP. `cells` maps a region id to { tone, value, count }:
// `tone` picks the fill class, `value` is the big figure, `count` the small
// one. A region with no value is under the floor: pencil-hatched, count only —
// a hatch, not a tint, so it can never read as a step of either colour scale.
//
// Every rect comes from model.js's projection, so the mirror is one prop
// (`view`) and nothing here knows which way round the picture is. The batter's
// box is drawn on the side his stance puts him, through the same projection.
export function ZoneMap({ view, stance, cells, label }) {
  const inner = ['r1c1', 'r3c3'].map((r) => regionRect(r, view))
  const fx = Math.min(inner[0].x, inner[1].x)
  const fr = Math.max(inner[0].x + inner[0].width, inner[1].x + inner[1].width)
  const box = stanceRect(stance, view)
  const hatch = useId()
  return (
    <svg className="scout__map" viewBox={mapBox(stance, view)} role="img" aria-label={label}>
      <defs>
        <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect className="scout__hatchground" width="5" height="5" />
          <line className="scout__hatch" x1="0" y1="0" x2="0" y2="5" />
        </pattern>
      </defs>
      {REGIONS.map((r) => {
        const { x, y, width, height } = regionRect(r, view)
        const c = cells[r]
        const cx = x + width / 2
        const cy = y + height / 2
        return (
          <g key={r}>
            <rect className={`scout__region scout__region--${c.tone}`} x={x} y={y} width={width} height={height}
              style={c.tone === 'gray' ? { fill: `url(#${hatch})` } : undefined} />
            {c.value != null ? (
              <>
                <text className="scout__figure" x={cx} y={c.count != null ? cy - 2 : cy + 4}>{c.value}</text>
                {c.count != null && <text className="scout__count" x={cx} y={cy + 10}>{c.count}</text>}
              </>
            ) : (
              <text className="scout__count" x={cx} y={cy + 4}>{c.count}</text>
            )}
          </g>
        )
      })}
      <rect className="scout__frame" x={fx} y={inner[0].y} width={fr - fx} height={inner[1].y + inner[1].height - inner[0].y} />
      <rect className="scout__box" {...box} />
      <text className="scout__count" x={box.x + box.width / 2} y={box.y + box.height / 2 + 4}>{stance}</text>
    </svg>
  )
}
