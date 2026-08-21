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

import { HOME } from './ballparkGeometry.js'

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

const round1 = (n) => Math.round(n * 10) / 10

// How deep the curve departs from the straight home→landing chord, in the same
// units (= feet). `launchAngle` is degrees off the ground, MLB's own sign
// convention (negative = driven into the dirt). Returns 0 for anything on the
// ground, which is what makes the path a straight line.
export function bowSagitta(chord, launchAngle, trajectory = null) {
  if (!(chord > 0)) return 0
  if (trajectory === 'ground_ball') return 0
  if (launchAngle == null || launchAngle <= GROUND_BALL_MAX_ANGLE) return 0
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
