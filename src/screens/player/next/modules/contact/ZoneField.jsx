import { HOME } from '../../../../../lib/ballpark/ballparkGeometry.js'
import { ZONE_DEPTHS, ZONE_DIRS, fieldOrder, zoneFill, zoneLabelOnLight } from './contactZones.js'

// The Zones view of the spray field (#2975, round 3, Gary 2026-11-12): nine places on the field,
// pull / center / oppo by infield / shallow / deep, each lit by its share on one fixed scale. The
// ball-type filter sets only the hue. Drawn inside ContactModule's own <svg>, over the same foul
// lines; the outer band IS the fence here, so the arc and the zones share one edge.
// The bands' radii in SVG feet: the depth edges (150, 250 ft), the outer edge at the fence line.
const RADII = { infield: [45, 150], shallow: [150, 250], deep: [250, 345] }
const WEDGE = { pull: [-45, -15], center: [-15, 15], oppo: [15, 45] } // a right-handed hitter

const at = (deg, ft) => {
  const r = (deg * Math.PI) / 180
  return [HOME.x + ft * Math.sin(r), HOME.y - ft * Math.cos(r)].map((v) => v.toFixed(1))
}
const cellPath = (a0, a1, r0, r1) =>
  `M ${at(a0, r0)} L ${at(a0, r1)} A ${r1} ${r1} 0 0 1 ${at(a1, r1)} L ${at(a1, r0)} A ${r0} ${r0} 0 0 0 ${at(a0, r0)} Z`
// A left-handed hitter pulls to right field: mirror the wedges.
const angles = (dir, side) => (side === 'L' ? WEDGE[dir].map((a) => -a).reverse() : WEDGE[dir])
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`)

export function ZoneField({ zones, side, type }) {
  const R = RADII.deep[1]
  return (
    <g className="fcontact__zones" aria-hidden="true">
      {zones.cells.map((c) => {
        const [a0, a1] = angles(c.dir, side)
        const [r0, r1] = RADII[c.depth]
        const [lx, ly] = at((a0 + a1) / 2, (r0 + r1) / 2)
        return (
          <g key={`${c.dir}-${c.depth}`}>
            <path className="fcontact__zone" d={cellPath(a0, a1, r0, r1)} style={{ fill: zoneFill(type, c.share) }} />
            <text className={`fcontact__zlabel${zoneLabelOnLight(c.share) ? ' fcontact__zlabel--dark' : ''}`} x={lx} y={ly}>{pct(c.share)}</text>
          </g>
        )
      })}
      <path className="spray__fence" d={`M ${at(-45, R)} A ${R} ${R} 0 0 1 ${at(45, R)}`} />
      {ZONE_DIRS.map(([dir, name]) => {
        const [a0, a1] = angles(dir, side)
        const [x, y] = at((a0 + a1) / 2, R + 22)
        return <text key={dir} className="fcontact__zdir" x={x} y={y}>{name}</text>
      })}
    </g>
  )
}

// The same nine shares as a table, deep to infield, its columns in the field's own left-to-right
// order for this batter: the side column on a wide card.
export function ZoneTable({ zones, side }) {
  const cols = fieldOrder(side).map((d) => ZONE_DIRS.find(([k]) => k === d))
  const cell = (dir, depth) => zones.cells.find((c) => c.dir === dir && c.depth === depth)
  return (
    <table className="fcontact__ztable">
      <thead>
        <tr><th scope="col">Depth</th>{cols.map(([d, n]) => <th key={d} scope="col">{n}</th>)}</tr>
      </thead>
      <tbody>
        {[...ZONE_DEPTHS].reverse().map(([depth, name]) => (
          <tr key={depth}>
            <th scope="row">{name}</th>
            {cols.map(([d]) => <td key={d}>{pct(cell(d, depth).share)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
