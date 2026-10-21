import { HOME } from '../../../ballpark/ballparkGeometry.js'
import { geometryOf, parkWindow } from '../../../ballpark/layout/parkWindow.js'

// THE FENCE OVERLAY (Park fit, 2026-10-21): two parks' outfield walls in one frame. Pure.
// Every park is drawn from one home plate at one scale (a foot to a unit, ballparkGeometry.js), so two
// walls lay over each other exactly: the infield is the same, only the fences differ. This file holds the
// two decisions that need both parks at once: the window, and which distance signs make room for each other.

// A distance sign ("344′", set at --fs-title-sm in the mono face) is about this big, in the drawing's units.
// Two signs whose centres are closer than this on BOTH axes overlap.
const SIGN_W = 46
const SIGN_H = 22
const SLOTS = ['lf', 'cf', 'rf']
// How far a sign that makes room moves: back toward home along its ray (so it stands inside its wall), and
// across the ray toward the field's centre line (so it clears the foul line and the wall).
const INWARD = 34
const ACROSS = 30

// One window over every park: the same scale as any park's own (never a rescale), cropped to the highest
// mark of any of them. The card keeps one size whichever park it shows, so the page does not jump.
export function overlayWindow(layouts) {
  const top = Math.min(...layouts.map((l) => geometryOf(l).top))
  return parkWindow(layouts[0], { geometry: { top } })
}

const radius = (p) => Math.hypot(p.x - HOME.x, p.y - HOME.y)

// The move that takes a sign from where it stands outside its wall to just inside it.
function insideMove(sign) {
  const r = radius(sign) || 1
  const u = { x: (sign.x - HOME.x) / r, y: (sign.y - HOME.y) / r }
  // The perpendicular that points toward the field's centre line. Dead center has none: it only steps in.
  const toward = Math.sign(HOME.x - sign.x)
  const across = sign.slot === 'cf' || toward === 0 ? 0 : ACROSS
  const side = Math.sign(-u.y * toward) || 1
  const n = { x: -u.y * side, y: u.x * side }
  return { dx: -INWARD * u.x + across * n.x, dy: -INWARD * u.y + across * n.y }
}

// -> one array per layout, [{ slot: 'lf' | 'cf' | 'rf', x, y, t, dx, dy }]: the park's distance signs.
// (x, y) is where a sign stands beside its own wall, as the single-park drawing prints it, and the value
// `t` is the posted distance. (dx, dy) is the move for the two-park view: zero, except for the sign of
// the park whose wall stands nearer home where the two parks' signs for one slot would overlap. That sign
// steps inside its wall, so both can be read. No other sign moves.
export function overlayLabels(layouts) {
  const per = layouts.map((layout) => {
    // The same filter buildFieldGeometry applies to its signs, so slots line up with them.
    const slots = SLOTS.filter((k) => Number.isFinite(layout.measurements.dist[k]))
    return geometryOf(layout).labels.map((l, i) => ({ slot: slots[i], x: l.x, y: l.y, t: l.t, dx: 0, dy: 0 }))
  })
  for (const slot of SLOTS) {
    const here = per.map((signs) => signs.find((s) => s.slot === slot)).filter(Boolean)
    for (let a = 0; a < here.length; a++) {
      for (let b = a + 1; b < here.length; b++) {
        const [p, q] = [here[a], here[b]]
        if (Math.abs(p.x - q.x) >= SIGN_W || Math.abs(p.y - q.y) >= SIGN_H) continue
        // The shallower wall steps in. A tie is the later park.
        const inner = radius(p) < radius(q) ? p : q
        Object.assign(inner, insideMove(inner))
      }
    }
  }
  return per
}
