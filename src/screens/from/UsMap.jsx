import { zoomCss } from '../../lib/from/zoom.js'

// The US map of the Where they're from picker (#1526, SPEC §9.3): one inline svg, a path for
// each state, no map library. A tap on a state zooms the map in on it, and the state's zones are
// drawn over it. It is a picture of the controls that matter: the State select and the zone
// chips do everything a tap does, so the svg is hidden from assistive tech (51 tab stops on a map
// would be worse) and a path takes no title.
//
//   outline   map/us.json: { viewBox, states: { GA: { d, b } } }.
//   has       { GA: n }: the states that have a place in this list. Drawn with the heavy ink
//             edge, because the mint fill alone is only 1.86:1 against the paper.
//   picked    the zoomed state's code, or null for the whole country.
//   zones     the picked state's zones [{ id, d }] (map/{ST}.json), drawn over it.
//   zoneHas   { zoneId: n }.
//   zone      the picked zone's id, or null.
//   onState / onZone  the same handlers the select and the chips call.
export function UsMap({ outline, has, picked, zones, zoneHas, zone, onState, onZone }) {
  const [width, height] = outline.viewBox
  const states = Object.entries(outline.states)
  const box = picked ? outline.states[picked]?.b : null
  const stateClass = (st) => {
    if (st === picked) return 'fromap__shape fromap__shape--here'
    if (picked) return 'fromap__shape fromap__shape--outside'
    return has[st] ? 'fromap__shape fromap__shape--has' : 'fromap__shape fromap__shape--none'
  }
  const zoneClass = (id) =>
    `fromap__shape ${id === zone ? 'fromap__shape--picked' : zoneHas[id] ? 'fromap__shape--has' : 'fromap__shape--none'}`
  return (
    <svg className="fromap" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <g className="fromap__world" style={{ transform: zoomCss(box) }}>
        {states.filter(([st]) => st !== picked).map(([st, s]) => (
          <path key={st} d={s.d} className={stateClass(st)} vectorEffect="non-scaling-stroke" onClick={() => onState(st)} />
        ))}
        {picked && outline.states[picked] && (
          <path d={outline.states[picked].d} className={stateClass(picked)} vectorEffect="non-scaling-stroke" />
        )}
        {picked && zones?.map((z) => (
          <path key={z.id} d={z.d} className={zoneClass(z.id)} vectorEffect="non-scaling-stroke" onClick={() => onZone(z.id)} />
        ))}
      </g>
    </svg>
  )
}
