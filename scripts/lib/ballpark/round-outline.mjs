// Whole-unit rounding of park outlines (#2931). It shrinks fields.js by about a
// sixth, but the CF marker search (auditFence) argmaxes a wall that is flat to
// ~0.5 ft, so rounding can move its angle by several degrees (American Family:
// 8 -> -0.5). A fence is therefore rounded only when the unchanged search keeps
// its angle (to 0.5 degrees) and the CF audit still passes; else it stays at 1 decimal.
import { auditFence } from '../../../src/lib/ballpark/layout/fenceAudit.js'

export const wholeUnits = (pts) => pts.map(([x, y]) => [Math.round(x), Math.round(y)])

// `passes(rounded)` is the caller's own audit (Savant or posted) on the rounded points.
export function roundFence(points, postedCf, passes = () => true) {
  const r = wholeUnits(points)
  const [a, b] = [auditFence(points, postedCf), auditFence(r, postedCf)]
  const ok = a && b && b.pass && Math.abs(a.cfMarkerAngle - b.cfMarkerAngle) <= 0.5 && passes(r)
  return ok ? r : points
}

// Fair area home -> fence -> home (shoelace), to carry the outline's audit area across a rounding.
export const fairArea = (p) => Math.abs(p.reduce((a, q, k) => { const n = p[k + 1] ?? [0, 0]; return a + q[0] * n[1] - n[0] * q[1] }, 0)) / 2
