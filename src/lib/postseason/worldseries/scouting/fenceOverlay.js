import { HOME, LABEL_HALF } from '../../../ballpark/ballparkGeometry.js'
import { geometryOf, parkWindow } from '../../../ballpark/layout/parkWindow.js'

// THE FENCE OVERLAY (Park fit, 2026-10-21): two parks' outfield walls in one frame. Pure.
// Every park is drawn from one home plate at one scale (a foot to a unit, ballparkGeometry.js), so two
// walls lay over each other exactly: the infield is the same, only the fences differ. This file holds the
// two decisions that need both parks at once: the window, and which distance signs make room for each other.

// A distance sign ("344′", set at --fs-title-sm in the mono face) is about this big, in the drawing's units.
// Its height is the cropped window's own (LABEL_HALF, which test/park-window.test.js holds to the token) and
// a unit of margin. Two signs whose centres are closer than this on BOTH axes overlap.
export const SIGN_W = 46
export const SIGN_H = 2 * LABEL_HALF + 2
const SLOTS = ['lf', 'cf', 'rf']
// How far a sign that makes room moves: back toward home along its ray (so it stands inside its wall), and
// across the ray toward the field's centre line (so it clears the foul line and the wall).
const INWARD = 34
const ACROSS = 30

// One window over every park: the same scale as any park's own (never a rescale), cropped to the highest
// mark of any of them, so it is the window of the park that stands highest. The card keeps one size
// whichever park it shows, so the page does not jump.
export function overlayWindow(layouts) {
  const highest = layouts.reduce((a, b) => (geometryOf(b).top < geometryOf(a).top ? b : a))
  return parkWindow(highest)
}

const radius = (p) => Math.hypot(p.x - HOME.x, p.y - HOME.y)

// The move that takes a sign from where it stands outside its wall to just inside it.
function insideMove(sign) {
  const r = radius(sign)
  const ux = (sign.x - HOME.x) / r
  const uy = (sign.y - HOME.y) / r
  // Across the ray, toward the field's centre line: a line sign steps toward the side of home it does not
  // stand on. Center field has no such side, so it only steps in.
  const across = sign.slot === 'cf' ? 0 : ACROSS * Math.sign(HOME.x - sign.x)
  return { dx: -INWARD * ux - across * uy, dy: -INWARD * uy + across * ux }
}

// -> one array per layout, [{ slot: 'lf' | 'cf' | 'rf', x, y, t, dx, dy }]: the park's distance signs.
// (x, y) is where a sign stands beside its own wall, as the single-park drawing prints it, and the value
// `t` is the posted distance. (dx, dy) is the move for the two-park view: zero, except for the sign of
// the park whose wall stands nearer home where the two parks' signs for one slot would overlap. That sign
// steps inside its wall, so both can be read. No other sign moves.
// Two parks at most (fitParks draws one per Series club): a third would not be compared.
export function overlayLabels(layouts) {
  const per = layouts.map((layout) => geometryOf(layout).labels.map((l) => ({ ...l, dx: 0, dy: 0 })))
  for (const slot of SLOTS) {
    const [p, q] = per.map((signs) => signs.find((s) => s.slot === slot))
    if (!p || !q || Math.abs(p.x - q.x) >= SIGN_W || Math.abs(p.y - q.y) >= SIGN_H) continue
    // The shallower wall steps in. A tie is the later park.
    const inner = radius(p) < radius(q) ? p : q
    Object.assign(inner, insideMove(inner))
  }
  return per
}
