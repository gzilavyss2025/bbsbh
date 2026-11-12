import { HOME } from '../../../../../lib/ballpark/ballparkGeometry.js'
import { ZONE_DIRS, ZONE_TYPES } from './contactZones.js'

// The Zones view of the spray field (#2975, design A, Gary 2026-11-12): the fair field cut into
// three 30° wedges, each in three depth bands (ground balls nearest the plate, fly balls
// deepest), every cell inked by its share. Drawn inside ContactModule's own <svg>, over the same
// fence and lines as the dots. `side` places pull: a left-handed hitter pulls to right field.
const BANDS = { ground: [70, 165], line: [165, 255], fly: [255, 335] }
const WEDGE = { pull: [15, 45], center: [-15, 15], oppo: [-45, -15] }

const at = (deg, ft) => {
  const r = (deg * Math.PI) / 180
  return [HOME.x + ft * Math.sin(r), HOME.y - ft * Math.cos(r)].map((v) => v.toFixed(1))
}
const cellPath = (a0, a1, r0, r1) => {
  const [p, q, s, t] = [at(a0, r0), at(a0, r1), at(a1, r1), at(a1, r0)]
  return `M ${p} L ${q} A ${r1} ${r1} 0 0 1 ${s} L ${t} A ${r0} ${r0} 0 0 0 ${p} Z`
}
// Mirror the wedges for a right-handed hitter, who pulls to left field (negative angles).
const angles = (dir, side) => (side === 'L' ? WEDGE[dir] : WEDGE[dir].map((a) => -a).reverse())
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`)

export function ZoneField({ zones, side }) {
  const top = Math.max(...zones.cells.map((c) => c.share ?? 0)) || 1
  return (
    <g className="fcontact__zones">
      {zones.cells.map((c) => {
        const [a0, a1] = angles(c.dir, side)
        const [r0, r1] = BANDS[c.type]
        const ink = 0.12 + 0.88 * ((c.share ?? 0) / top)
        const [lx, ly] = at((a0 + a1) / 2, (r0 + r1) / 2)
        return (
          <g key={`${c.dir}-${c.type}`}>
            <path className="fcontact__zone" d={cellPath(a0, a1, r0, r1)} style={{ fillOpacity: ink.toFixed(2) }} />
            <text className={`fcontact__zlabel${ink < 0.5 ? ' fcontact__zlabel--dark' : ''}`} x={lx} y={ly}>{pct(c.share)}</text>
          </g>
        )
      })}
      {ZONE_DIRS.map(([dir, name]) => {
        const [a0, a1] = angles(dir, side)
        const [x, y] = at((a0 + a1) / 2, 395)
        return <text key={dir} className="fcontact__zdir" x={x} y={y}>{name}</text>
      })}
    </g>
  )
}

// The same nine shares as a table, with each row's total: the desktop side column.
export function ZoneTable({ zones }) {
  const cell = (dir, type) => zones.cells.find((c) => c.dir === dir && c.type === type)
  return (
    <table className="fcontact__ztable">
      <thead>
        <tr><th scope="col">Ball type</th>{ZONE_DIRS.map(([d, n]) => <th key={d} scope="col">{n}</th>)}</tr>
      </thead>
      <tbody>
        {ZONE_TYPES.map(([type, name]) => (
          <tr key={type}>
            <th scope="row">
              <svg className="fcontact__swatch" viewBox="0 0 16 16" aria-hidden="true"><circle className={`fcontact__dot--${type}`} cx="8" cy="8" r="6" /></svg>
              {type === 'fly' ? 'Fly ball + pop-up' : name}
            </th>
            {ZONE_DIRS.map(([d]) => <td key={d}>{pct(cell(d, type).share)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
