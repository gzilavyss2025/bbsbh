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

import { HOME, wallDistanceAt } from './ballparkGeometry.js'
import { heightAt, measuredHeightAt } from './layout/fenceShape.js'
import { simFlight } from './flightModel.js'
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
export const isGrounded = (launchAngle, trajectory = null) =>
  trajectory === 'ground_ball' || launchAngle == null || launchAngle <= GROUND_BALL_MAX_ANGLE

// How deep the curve departs from the straight home→landing chord, in the same
// units (= feet). `launchAngle` is degrees off the ground, MLB's own sign
// convention (negative = driven into the dirt). Returns 0 for anything on the
// ground, which is what makes the path a straight line.
export function bowSagitta(chord, launchAngle, trajectory = null) {
  if (!(chord > 0)) return 0
  if (isGrounded(launchAngle, trajectory)) return 0
  const angle = Math.min(launchAngle, 89)
  const apex = (chord * Math.tan((angle * Math.PI) / 180)) / 4
  return Math.min(apex, chord * MAX_BOW_FRACTION, MAX_BOW_FT)
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
export const ARC_CD = 0.3
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
  return (Math.atan2(landing.x - home.x, home.y - landing.y) * 180) / Math.PI
}

// The wall on the ray at `deg`: feet out, feet high, and `label`, the measured
// height when the ray falls on a measured point (else null: between points the
// height is a straight-line estimate, and no label prints one). Null when the
// layout has no heights or no wall on that ray.
export function wallOnLine(layout, deg) {
  const heights = layout?.measurements?.measured?.height ?? layout?.measurements?.wall ?? null
  if (!heights) return null
  const ft = wallDistanceAt(layout, deg)
  if (ft == null) return null
  return { ft: round1(ft), height: round1(heightAt(deg, heights)), label: measuredHeightAt(deg, heights) }
}

// [[x, z], ...] in feet, plate to landing. Modelled when there is a speed.
function airPoints(ball) {
  const { exitVelo: ev, launchAngle: la, distance: dist } = ball
  if (ev == null) {
    const apex = Math.min((dist * Math.tan((Math.min(la, 89) * Math.PI) / 180)) / 4, MAX_BOW_FT)
    return Array.from({ length: ARC_SAMPLES + 1 }, (_, i) => {
      const u = i / ARC_SAMPLES
      return [dist * u, 4 * apex * u * (1 - u)]
    })
  }
  let [lo, hi] = LIFT_RANGE
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (simFlight(ev, la, mid, 3, ARC_CD).dist < dist) lo = mid
    else hi = mid
  }
  const f = simFlight(ev, la, (lo + hi) / 2, 3, ARC_CD)
  // Stretched to land on the measured distance exactly, where the lift range
  // could not reach it. The start height is the bat's, 3 ft.
  const k = dist / f.dist
  const step = Math.max(1, Math.floor(f.pts.length / ARC_SAMPLES))
  const pts = f.pts.filter((_, i) => i % step === 0).map(([x, z]) => [x * k, Math.max(0, z)])
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

// The side view of one ball. Returns null when there is none to draw.
//   pts      [[x, z], ...] feet, rounded to 0.1
//   peak     { x, z } feet, or null for a ball on the ground
//   wall     wallOnLine's answer, or null
//   grounded the ball never left the ground: one flat line
//   atWall   a ball that did not leave the park, cut where it met the wall
//   modelled the arc flew the drag model (false: the plain parabola)
//
// The two result rules, both only where the ball's distance is past the wall:
// a home run is lifted to clear it; any other ball is held to the wall's height
// and ends at the wall, because the feed says it stayed in.
export function elevationArc(ball, layout = null) {
  if (!hasElevationArc(ball)) return null
  const wall = ball.x != null && ball.y != null ? wallOnLine(layout, ballBearing(ball)) : null
  const dist = ball.distance
  if (isGrounded(ball.launchAngle, ball.trajectory)) {
    return { pts: [[0, 0], [dist, 0]], peak: null, wall, grounded: true, atWall: false, modelled: false }
  }
  let pts = airPoints(ball)
  let atWall = false
  if (wall && dist > wall.ft) {
    const z = heightOnArc(pts, wall.ft)
    if (ball.homeRun && z < wall.height + HOME_RUN_CLEAR_FT && z > 0) {
      const k = (wall.height + HOME_RUN_CLEAR_FT) / z
      pts = pts.map(([x, h]) => [x, h * k])
    } else if (!ball.homeRun) {
      const k = z > wall.height && z > 0 ? wall.height / z : 1
      pts = pts.map(([x, h]) => [x, h * k])
      const met = heightOnArc(pts, wall.ft)
      pts = [...pts.filter(([x]) => x < wall.ft), [wall.ft, met]]
      atWall = true
    }
  }
  pts = pts.map(([x, z]) => [round1(x), round1(z)])
  const top = pts.reduce((a, b) => (b[1] > a[1] ? b : a))
  return {
    pts,
    peak: { x: top[0], z: top[1] },
    wall,
    grounded: false,
    atWall,
    modelled: ball.exitVelo != null,
  }
}
