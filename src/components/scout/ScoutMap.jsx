import { useId } from 'react'
import { REGIONS, mapBox, platePoints, regionLabel, regionRect, stanceRect } from '../../lib/zone/regions.js'

// ONE 13-REGION MAP (the Matchup Scout, #1408; geometry in lib/zone/regions.js). `cells` maps a region id to { tone, value, count }:
// `tone` picks the fill class, `value` is the big figure, `count` the small
// one. A region with no value is under the floor: pencil-hatched, count only —
// a hatch, not a tint, so it can never read as a step of either colour scale.
//
// Every rect comes from model.js's projection, so the mirror is one prop
// (`view`) and nothing here knows which way round the picture is. The batter's
// box is drawn on the side his stance puts him, through the same projection,
// and the plate sits under the low band, symmetric, so it never moves.
//
// EACH REGION IS A BUTTON (`onSelect`): a tap picks it on both maps, and the
// page prints its exact figures on the readout line under them — the
// numbers a 27px cell has no room for. The picked region wears `.is-picked`
// (a navy frame); the tone classes stay on the rect, so the fill tweens when
// a pill flips the data under it (scout.css). A figure is keyed on its value,
// so a changed number remounts and inks in. No `title=` tooltip anywhere.
//
// `unit` '%' sets a percent sign after each figure, in a smaller size than the
// number (#1490): the pitcher's share always, the hitter's Whiff % and Swing %.
// xwOBA (est.) takes none.
export function ScoutMap({ view, stance, cells, label, picked, onSelect, unit = '' }) {
  const inner = ['r1c1', 'r3c3'].map((r) => regionRect(r, view))
  const fx = Math.min(inner[0].x, inner[1].x)
  const fr = Math.max(inner[0].x + inner[0].width, inner[1].x + inner[1].width)
  const box = stanceRect(stance, view)
  const hatch = useId()
  return (
    <svg className="scout__map" viewBox={mapBox(stance, view)} role="group" aria-label={label}>
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
        const figure = c.value != null ? `${c.value}${unit}` : c.count != null ? `${c.count}, under the floor` : ''
        return (
          <g
            key={r}
            className={`scout__regionbtn${picked === r ? ' is-picked' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={picked === r}
            aria-label={`${regionLabel(r, stance)}: ${figure}`}
            onClick={() => onSelect(r)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(r)
              }
            }}
          >
            <rect className={`scout__region scout__region--${c.tone}`} x={x} y={y} width={width} height={height}
              style={c.tone === 'gray' ? { fill: `url(#${hatch})` } : undefined} />
            {c.value != null ? (
              <>
                <text key={`v${c.value}`} className="scout__figure" x={cx} y={c.count != null ? cy - 2 : cy + 4}>
                  {c.value}{unit && <tspan className="scout__unit">{unit}</tspan>}
                </text>
                {c.count != null && <text key={`n${c.count}`} className="scout__count" x={cx} y={cy + 10}>{c.count}</text>}
              </>
            ) : (
              <text key={`n${c.count}`} className="scout__count" x={cx} y={cy + 4}>{c.count}</text>
            )}
          </g>
        )
      })}
      <rect className="scout__frame" x={fx} y={inner[0].y} width={fr - fx} height={inner[1].y + inner[1].height - inner[0].y} />
      {picked && <rect className="scout__pick" {...regionRect(picked, view)} />}
      <polygon className="scout__plate" points={platePoints(view)} />
      <rect className="scout__box" {...box} />
      <text className="scout__stance" x={box.x + box.width / 2} y={box.y + box.height / 2 + 4}>{stance}</text>
    </svg>
  )
}
