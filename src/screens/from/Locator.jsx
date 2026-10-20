import { LOCATOR_ZOOM, MAP_VIEW, zoomTransform } from '../../lib/from/zoom.js'

// The small locator map on a place page (#1526, SPEC §9.4): the same national outline as the
// picker, zoomed to the place's state at 0.6, that state on card paper with an ink edge, the
// others faint, and an ink dot with a paper ring where the place is. It is a picture, not a
// control: a <figure> with a text label. A place with no point shows the state and no dot.
//
//   outline  map/us.json.   state  the place's state code.   point  [x, y] on that map, or null.
//   label    "Map: Nashville, in TN" for a screen reader.
export function Locator({ outline, state, point, label }) {
  const here = outline.states[state]
  if (!here) return null
  const { k, tx, ty } = zoomTransform(here.b, LOCATOR_ZOOM)
  const [width, height] = MAP_VIEW
  return (
    <figure className="fromloc">
      <svg className="fromloc__svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <g transform={`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(4)})`}>
          {Object.entries(outline.states).filter(([st]) => st !== state).map(([st, s]) => (
            <path key={st} d={s.d} className="fromloc__other" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={here.d} className="fromloc__state" vectorEffect="non-scaling-stroke" />
        </g>
        {point && (
          <g>
            <circle className="fromloc__ring" cx={point[0] * k + tx} cy={point[1] * k + ty} r="13" />
            <circle className="fromloc__dot" cx={point[0] * k + tx} cy={point[1] * k + ty} r="7" />
          </g>
        )}
      </svg>
    </figure>
  )
}
