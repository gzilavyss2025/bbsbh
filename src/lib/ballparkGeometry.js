// Geometry for the ballpark field drawing (see components/BallparkDiagram.jsx).
// Turns a park's five outfield distances + three wall heights into the SVG path
// strings and label points the diagram renders — infield diamond, outfield grass,
// warning track, foul ground, and the fence shaped to scale.
//
// Pure and self-contained (no React, no data import), so the whole drawing can be
// unit-checked without a browser: buildFieldGeometry(dist, wall) → path strings.
//
// Home plate anchors the drawing; angle is measured in degrees from the
// straightaway center-field axis (up the page), positive toward right field — so
// the foul lines sit at ±45°, the gaps at ±22.5°, dead center at 0°. Drawn at a
// FIXED scale (1 SVG unit = 1 foot) inside a fixed 620×560 viewBox, so every park
// is rendered at the same scale and a deep park visibly fills more of the frame.

export const VIEWBOX = { w: 620, h: 560 }
export const HOME = { x: 310, y: 505 }
const ANGLE = { lf: -45, lc: -22.5, cf: 0, rc: 22.5, rf: 45 }
const TRACK_FT = 14 // warning-track width, feet
const FOUL_FT = 26 // stylized foul-ground margin beyond the wall/lines (see foul path)

// Convert a (distance-from-home, angle) polar pair into an SVG point. SVG y grows
// downward, so center field (up the page) subtracts from home's y.
function polar(distFt, angleDeg) {
  const a = (angleDeg * Math.PI) / 180
  return { x: HOME.x + distFt * Math.sin(a), y: HOME.y - distFt * Math.cos(a) }
}

const f = (n) => Math.round(n * 100) / 100 // trim float noise in path strings

// A Catmull-Rom spline through the given points as an SVG cubic-bezier path body
// (no leading "M"), so a smooth fence can be stitched onto a larger path. Endpoints
// are duplicated so the curve passes through the first and last points cleanly.
function splineBody(pts) {
  const p = [pts[0], ...pts, pts[pts.length - 1]]
  let d = ''
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += `C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)} `
  }
  return d.trim()
}

const reverseSpline = (pts) => splineBody([...pts].reverse())

// Fence stroke width from wall height: a 5' wall is a hairline, the 37' Monster
// is unmistakably a wall.
export const wallStroke = (h) => f(1.4 + Math.min(h, 40) * 0.11)

// Build every path/point the diagram needs from a park's dist + wall records.
export function buildFieldGeometry(dist, wall) {
  const keys = ['lf', 'lc', 'cf', 'rc', 'rf']
  const wallPts = keys.map((k) => polar(dist[k], ANGLE[k]))
  const trackPts = keys.map((k) => polar(dist[k] - TRACK_FT, ANGLE[k]))
  const foulPts = keys.map((k) => polar(dist[k] + FOUL_FT, ANGLE[k]))
  const [lf, , , , rf] = wallPts

  const wallSpline = splineBody(wallPts)

  // Fair territory: home → LF pole → fence → RF pole → home.
  const fair = `M ${f(HOME.x)} ${f(HOME.y)} L ${f(lf.x)} ${f(lf.y)} ${wallSpline} L ${f(HOME.x)} ${f(HOME.y)} Z`

  // Warning-track band: the ring between the fence and a fence offset inward,
  // laid over the grass so only the rim shows. Trace the fence LF→RF, cross to the
  // inner (offset) fence, trace it back RF→LF, and close.
  const track =
    `M ${f(lf.x)} ${f(lf.y)} ${wallSpline} ` +
    `L ${f(trackPts[4].x)} ${f(trackPts[4].y)} ` +
    `${reverseSpline(trackPts)} ` +
    `L ${f(lf.x)} ${f(lf.y)} Z`

  // Foul ground: a stylized stadium footprint sitting BEHIND the grass — the fair
  // wedge grown outward, wrapped around behind home plate as a backstop curve. Not
  // park-accurate foul-territory area (statsapi doesn't carry that); it's a fixed
  // margin so the field reads as sitting inside a park, not floating.
  const foulLf = foulPts[0]
  const backLeft = { x: HOME.x - 66, y: HOME.y + 30 }
  const backRight = { x: HOME.x + 66, y: HOME.y + 30 }
  const foul =
    `M ${f(backLeft.x)} ${f(backLeft.y)} ` +
    `L ${f(foulLf.x)} ${f(foulLf.y)} ${splineBody(foulPts)} ` +
    `L ${f(backRight.x)} ${f(backRight.y)} ` +
    `Q ${f(HOME.x)} ${f(HOME.y + 58)} ${f(backLeft.x)} ${f(backLeft.y)} Z`

  // Foul lines, home to each pole.
  const foulLineL = `M ${f(HOME.x)} ${f(HOME.y)} L ${f(lf.x)} ${f(lf.y)}`
  const foulLineR = `M ${f(HOME.x)} ${f(HOME.y)} L ${f(rf.x)} ${f(rf.y)}`

  // Infield: dirt diamond home→1B→2B→3B (90-ft basepaths), mound at 60.5 ft, bases.
  const b1 = polar(90, 45)
  const b2 = polar(90 * Math.SQRT2, 0)
  const b3 = polar(90, -45)
  const mound = polar(60.5, 0)
  const infield = `M ${f(HOME.x)} ${f(HOME.y)} L ${f(b1.x)} ${f(b1.y)} L ${f(b2.x)} ${f(b2.y)} L ${f(b3.x)} ${f(b3.y)} Z`

  // Wall drawn as two arcs (LF-half, RF-half) so each can take a stroke width
  // scaled to that corner's wall height — a fat stroke = a tall wall.
  const wallSegs = [
    { d: `M ${f(wallPts[0].x)} ${f(wallPts[0].y)} ${splineBody([wallPts[0], wallPts[1], wallPts[2]])}`, h: wall.lf },
    { d: `M ${f(wallPts[2].x)} ${f(wallPts[2].y)} ${splineBody([wallPts[2], wallPts[3], wallPts[4]])}`, h: wall.rf },
  ]

  return {
    fair, track, foul, infield, foulLineL, foulLineR, wallSegs,
    bases: [b1, b2, b3], mound,
    labels: [
      { ...polar(dist.lf + FOUL_FT + 12, ANGLE.lf), t: `${dist.lf}` },
      { ...polar(dist.cf + FOUL_FT + 12, ANGLE.cf), t: `${dist.cf}` },
      { ...polar(dist.rf + FOUL_FT + 12, ANGLE.rf), t: `${dist.rf}` },
    ],
    wallTags: [
      { ...polar(dist.lf - TRACK_FT - 12, ANGLE.lf), h: wall.lf },
      { ...polar(dist.cf - TRACK_FT - 12, ANGLE.cf), h: wall.cf },
      { ...polar(dist.rf - TRACK_FT - 12, ANGLE.rf), h: wall.rf },
    ],
  }
}
