// The path a batted ball travelled, home plate to where it came down, drawn in
// the ballpark diagram's own SVG space (./ballparkGeometry.js — feet map 1:1 to
// units off HOME).
//
// Pure geometry: no feed, no React, no result. It is handed a landing point
// somebody else already derived and returns a path string, which is why it can
// sit in lib/ rather than behind the reveal gate its one caller sits behind.
//
// WHAT THE BOW MEANS, AND WHAT IT DOES NOT. The drawing is a PLAN view — seen
// from above, every fly ball's real flight is a straight line from the plate to
// the spot it lands on, and its height is the one dimension the drawing cannot
// show. Broadcast and Gameday-style hit trajectories solve this the same way:
// the path is bowed, and the depth of the bow stands for the loft. So the bow
// here is a GLYPH FOR HEIGHT, not a claim about where the ball was over the
// ground — a chopper and a 400-foot fly to the same fielder differ by the bend,
// which is the whole point.
//
// THE BEND IS A MEASUREMENT, NOT A FLOURISH. For a ball launched at angle a
// over level ground the peak of its flight is range × tan(a) / 4, and that is
// exactly what the sagitta — the curve's deepest departure from the straight
// chord — is set to. The drawing puts feet 1:1 on SVG units, so the depth of
// the bow IS the ball's own apex height in feet, laid on its side. A line drive
// bends a little and a towering popup bends a lot because they really do.

import { HOME, diagramInput, wallDistanceAt } from './ballparkGeometry.js'
import { bearing, heightAt, measuredHeightAt } from './layout/fenceShape.js'
import { fitLift } from './flightModel.js'
import { round1 } from '../math/number.js'

// At or under this launch angle the ball is on the ground, drawn dead straight:
// a grounder's landing coordinate is where a fielder got to it, and a bow over
// that stretch would draw a hop the ball never took. MLB's own trajectory
// classification (`hitData.trajectory === 'ground_ball'`) is checked first and
// this is the fallback for a park that reports an angle but no trajectory.
export const GROUND_BALL_MAX_ANGLE = 10

// Two clamps on that measurement, both about the paper rather than the physics.
// tan() runs away above 65° and is infinite at 90°, so a popup that lands forty
// feet from the plate would otherwise bow a hundred-foot loop across the
// infield: the SHARE cap holds the curve near its own chord. The absolute cap
// is the backstop for the other end — no batted ball peaks higher than this, so
// nothing can bow off the top of the drawing.
export const MAX_BOW_FRACTION = 0.55
export const MAX_BOW_FT = 130

// On the ground: MLB's trajectory first, the angle as the fallback. Both views
// ask this, so a ball cannot bow in one and run flat in the other.
const isGrounded = (launchAngle, trajectory = null) =>
  trajectory === 'ground_ball' || launchAngle == null || launchAngle <= GROUND_BALL_MAX_ANGLE

// range × tan(a) / 4: the peak of a flight with no drag, in the chord's units.
// The bow's depth, and the side view's arc when there is no exit velocity.
const noDragApex = (chord, launchAngle) => (chord * Math.tan((Math.min(launchAngle, 89) * Math.PI) / 180)) / 4

// How deep the curve departs from the straight home→landing chord, in the same
// units (= feet). `launchAngle` is degrees off the ground, MLB's own sign
// convention (negative = driven into the dirt). Returns 0 for anything on the
// ground, which is what makes the path a straight line.
export function bowSagitta(chord, launchAngle, trajectory = null) {
  if (!(chord > 0)) return 0
  if (isGrounded(launchAngle, trajectory)) return 0
  return Math.min(noDragApex(chord, launchAngle), chord * MAX_BOW_FRACTION, MAX_BOW_FT)
}

// The flight path as an SVG `d`, plus the flags a caller needs to ink it.
//
// `landing` is the point selectBattedBall already projected into diagram space;
// `home` is injectable only so a test can state the plate's position rather
// than import it.
//
// WHICH WAY THE BOW GOES. UP THE FRAME, always — of the two perpendiculars, the
// one that rises toward the outfield. The drawing's vertical is the field's own
// depth axis, so a curve that climbs it is the nearest thing a plan view has to
// a ball climbing. It also lands where it needs to on its own: a ball down
// either line bends back over fair ground rather than ballooning past the foul
// line, and one popped up BEHIND the plate bends toward the field rather than
// off the bottom of the paper. A ball hit dead at center has two perpendiculars
// that rise equally, and takes the right-hand one; the card shows ONE ball at a
// time, so that arbitrary hand is never seen beside its mirror image.
export function ballFlightPath(landing, launchAngle, trajectory = null, home = HOME) {
  const dx = landing.x - home.x
  const dy = landing.y - home.y
  const chord = Math.hypot(dx, dy)
  const sagitta = bowSagitta(chord, launchAngle, trajectory)
  if (!sagitta) {
    return { d: `M ${home.x} ${home.y} L ${landing.x} ${landing.y}`, grounded: true, chord }
  }
  // Unit perpendicular, then turned to face up the frame (SVG y grows DOWN, so
  // "up" is the negative one). The tie is a chord straight up the middle, whose
  // two perpendiculars are both level; it takes the one pointing right.
  const px = -dy / chord
  const py = dx / chord
  const sign = py > 0 ? -1 : py < 0 ? 1 : px >= 0 ? 1 : -1
  // A quadratic's deepest point sits HALF way out to its control point, so the
  // control point is offset by twice the sagitta to bow by the sagitta.
  const cx = round1(home.x + dx / 2 + px * sign * sagitta * 2)
  const cy = round1(home.y + dy / 2 + py * sign * sagitta * 2)
  return {
    d: `M ${home.x} ${home.y} Q ${cx} ${cy} ${landing.x} ${landing.y}`,
    grounded: false,
    chord,
  }
}

// ---- THE SIDE VIEW ("Elevation Arc", #1875) ----
//
// The same ball seen from the side: height against distance from the plate, in
// feet, with the park's wall standing on the ball's own line. Like the bow, the
// arc is A PICTURE OF THE HEIGHT, not the tracked path — the feed sends where
// the ball went and how it left the bat, never its flight.
//
// WHY NOT THE BOW'S PARABOLA. range × tan(a) / 4 has no drag, so it is far too
// low for a real fly ball: 58 ft for a 471 ft home run Statcast measured at a
// 97 ft peak (Alan Nathan, "A Tale of Two Dingers"). Drawn against a wall, that
// puts a home run into the fence. So a ball with an exit velocity flies the
// replay's drag-and-lift model (flightModel.js) with the lift solved to land at
// the measured distance. ARC_CD is the drag that model needs to agree with
// Nathan's two measured balls: 93 ft and 56 ft against measured peaks of 97 and
// 63. The replay's own 0.35 gives 138 ft for the first. Two balls are a sanity
// check, not a validation. With no exit velocity the parabola is all there is.
const ARC_CD = 0.3
const LIFT_RANGE = [-0.2, 0.45]
const ARC_SAMPLES = 32

// How far over the wall a home run is drawn at the least, in feet. THE DRAWING
// MUST AGREE WITH THE RESULT: a modelled arc that clips the top of the wall
// would draw a home run as a ball off the wall.
export const HOME_RUN_CLEAR_FT = 4

// The side view needs a launch angle and a distance. A park that tracks neither
// (most MiLB) has no side view, and the card hides the toggle.
export const hasElevationArc = (ball) => ball?.launchAngle != null && ball?.distance > 0

// The ball's bearing in degrees off straightaway center, negative toward left
// field: the frame fenceDistanceAt and heightAt read.
export function ballBearing(landing, home = HOME) {
  return bearing([landing.x - home.x, home.y - landing.y])
}

// The wall on the ray at `deg`: feet out, feet high, and `label`, the height
// at a measured or posted point when the ray falls on one (else null: between
// points the height is a straight-line estimate, and no label prints one). The
// heights are the ones the plan view weights its fence with (diagramInput).
// Null when the layout has no heights or no wall on that ray.
export function wallOnLine(layout, deg) {
  if (!layout) return null
  const { heights } = diagramInput(layout)
  if (!heights) return null
  const ft = wallDistanceAt(layout, deg)
  if (ft == null) return null
  return { ft: round1(ft), height: round1(heightAt(deg, heights)), label: measuredHeightAt(deg, heights) }
}

// [[x, z], ...] in feet, plate to landing, x never decreasing. Modelled when
// there is a speed.
function airPoints(ball) {
  const { exitVelo: ev, launchAngle: la, distance: dist } = ball
  if (ev == null) {
    const apex = Math.min(noDragApex(dist, la), MAX_BOW_FT)
    return Array.from({ length: ARC_SAMPLES + 1 }, (_, i) => {
      const u = i / ARC_SAMPLES
      return [dist * u, 4 * apex * u * (1 - u)]
    })
  }
  // Twelve halvings fit the lift to about 1e-4; the stretch below takes up the rest.
  const [lo, hi] = LIFT_RANGE
  const { flight: f } = fitLift(ev, la, dist, { cd: ARC_CD, lo, hi, iters: 12 })
  // Stretched to land on the measured distance exactly, where the lift range
  // could not reach it. The start height is the bat's, 3 ft. The sim's last
  // sample is one step under the ground, past the landing, so it is dropped; so
  // is any sample behind one before it (a lift at the top of its range can curl
  // a steep ball back on itself).
  const k = dist / f.dist
  const step = Math.max(1, Math.floor(f.pts.length / ARC_SAMPLES))
  const pts = []
  for (let i = 0; i < f.pts.length; i += step) {
    const x = f.pts[i][0] * k
    if (x < dist && (!pts.length || x >= pts.at(-1)[0])) pts.push([x, Math.max(0, f.pts[i][1])])
  }
  pts.push([dist, 0])
  return pts
}

// Height of the arc at `x` ft, read off the polyline.
export function heightOnArc(pts, x) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1]
    const [x1, z1] = pts[i]
    if (x <= x1) return x1 === x0 ? z1 : z0 + ((z1 - z0) * (x - x0)) / (x1 - x0)
  }
  return 0
}

// 0 at u = 0, 1 at u = 1, level at both ends: a bend with no corner.
const ease = (u) => u * u * (3 - 2 * u)

// The highest point of an arc, [x, z].
const topOf = (pts) => pts.reduce((a, b) => (b[1] > a[1] ? b : a))

// The arc with a point laid at `x`, so a line drawn through it crosses there
// exactly, not somewhere between two samples.
const withKnot = (pts, x) => [...pts.filter((p) => p[0] < x), [x, heightOnArc(pts, x)], ...pts.filter((p) => p[0] > x)]

// The arc bent to cross `wallFt` at `target` ft high. The bend starts at the
// peak (or at the plate, for a wall the ball meets on its way up), is full at
// the wall, and fades out to nothing at the landing. Up to the peak the arc is
// untouched, so the peak the card prints stays the model's. `pts` carries a
// knot at the wall (withKnot), so the line crosses there at `target`.
function bendTo(pts, wallFt, target, dist) {
  const delta = target - heightOnArc(pts, wallFt)
  const top = topOf(pts)[0]
  const from = top < wallFt ? top : 0
  return pts.map(([x, z]) => {
    if (x <= from) return [x, z]
    if (x <= wallFt) return [x, z + delta * ease((x - from) / (wallFt - from))]
    return [x, Math.max(0, z + delta * (1 - ease((x - wallFt) / (dist - wallFt))))]
  })
}

// The side view of one ball. Returns null when there is none to draw.
//   pts      [[x, z], ...] feet, rounded to 0.1, x never decreasing
//   peak     { x, z } feet, or null for a ball on the ground
//   wall     wallOnLine's answer, or null
//   grounded the ball never left the ground: one flat line
//   atWall   a ball that did not leave the park, cut where it met the wall
//   modelled the arc flew the drag model (false: the plain parabola)
//
// THE TWO RESULT RULES bend the descent only (bendTo), never scale the whole
// arc: a scale by the ratio at the wall printed a 342 ft peak for a home run
// that reached the wall low, and flattened a ball caught at the wall.
//   - A home run crosses the wall at least HOME_RUN_CLEAR_FT over its top. One
//     that lands at or short of the drawn wall says that outline is wrong on
//     this ray, not the ball: no wall is drawn.
//   - Any other ball whose distance is past the wall meets the wall at or under
//     its top and ends there, because the feed says it stayed in.
export function elevationArc(ball, layout = null) {
  if (!hasElevationArc(ball)) return null
  let wall = ball.x != null && ball.y != null ? wallOnLine(layout, ballBearing(ball)) : null
  const dist = ball.distance
  if (isGrounded(ball.launchAngle, ball.trajectory)) {
    return { pts: [[0, 0], [dist, 0]], peak: null, wall, grounded: true, atWall: false, modelled: false }
  }
  let pts = airPoints(ball)
  let atWall = false
  if (wall && ball.homeRun && dist <= wall.ft) wall = null
  if (wall && dist > wall.ft) {
    pts = withKnot(pts, wall.ft)
    const z = heightOnArc(pts, wall.ft)
    if (ball.homeRun) {
      if (z < wall.height + HOME_RUN_CLEAR_FT) pts = bendTo(pts, wall.ft, wall.height + HOME_RUN_CLEAR_FT, dist)
    } else {
      if (z > wall.height) pts = bendTo(pts, wall.ft, wall.height, dist)
      pts = pts.filter(([x]) => x <= wall.ft)
      atWall = true
    }
  }
  pts = pts.map(([x, z]) => [round1(x), round1(z)])
  const top = topOf(pts)
  return {
    pts,
    peak: { x: top[0], z: top[1] },
    wall,
    grounded: false,
    atWall,
    modelled: ball.exitVelo != null,
  }
}
