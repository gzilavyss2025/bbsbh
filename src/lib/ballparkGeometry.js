// Geometry for the ballpark field drawing (see components/BallparkDiagram.jsx).
// Turns a park's outfield wall into the SVG path strings + label points the
// diagram renders — infield diamond, outfield grass, warning track, foul ground,
// and the fence.
//
// The fence comes from one of two sources, both drawn as STRAIGHT segments (real
// outfield walls are straight runs meeting at distinct corners — never a smooth
// arc):
//   • the digitized wall polygon in ballparkFields.js when we have it (passed in
//     as `arc`, an LF-pole→RF-pole point list in feet) — true shape, real corners;
//   • otherwise a five-point outline through the posted LF/LC/CF/RC/RF distances —
//     angular, just coarser (the fallback for the A's park and any MiLB venue).
//
// Pure and self-contained (no React, no data import). Home plate anchors the
// drawing; feet map 1:1 to SVG units, +x toward right field, +y toward center
// field (SVG y grows down, so center field subtracts from home's y). Fixed
// 620×560 viewBox and fixed scale, so a deep park visibly fills more of the frame.

export const VIEWBOX = { w: 620, h: 560 }
export const HOME = { x: 310, y: 505 }
const ANGLE = { lf: -45, lc: -22.5, cf: 0, rc: 22.5, rf: 45 }
const TRACK_FT = 14 // warning-track width, feet
const FOUL_FT = 26 // stylized foul-ground margin beyond the wall/lines
const INFIELD_CORNER_FT = 14 // how far the dirt skin's corner rounding eats into each baseline

const f = (n) => Math.round(n * 100) / 100

// Feet (home-origin, y toward center) → SVG point.
const toSvg = (xFt, yFt) => ({ x: HOME.x + xFt, y: HOME.y - yFt })

// Wall height interpolated across the outfield by angle from center (−45°=LF,
// 0°=CF, +45°=RF), so the fence thickness eases between the three posted heights.
function heightAt(a, wall) {
  const c = Math.max(-45, Math.min(45, a))
  return c <= 0
    ? wall.lf + (wall.cf - wall.lf) * ((c + 45) / 45)
    : wall.cf + (wall.rf - wall.cf) * (c / 45)
}

// The ordered wall as SVG points carrying each point's angle + local wall height.
// From the digitized arc when present, else the five posted distances.
function wallPoints(dist, wall, arc) {
  if (arc && arc.length > 1) {
    return arc.map(([xf, yf]) => {
      const a = (Math.atan2(xf, yf) * 180) / Math.PI
      return { ...toSvg(xf, yf), a, h: heightAt(a, wall) }
    })
  }
  return ['lf', 'lc', 'cf', 'rc', 'rf'].map((k) => {
    const a = ANGLE[k]
    const rad = (a * Math.PI) / 180
    return { ...toSvg(dist[k] * Math.sin(rad), dist[k] * Math.cos(rad)), a, h: heightAt(a, wall) }
  })
}

const line = (pts) => pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')

// Push a point out from (or, negative, toward) home by `ft` feet.
function offsetFromHome(p, ft) {
  const dx = p.x - HOME.x
  const dy = p.y - HOME.y
  const len = Math.hypot(dx, dy) || 1
  return { x: p.x + (dx / len) * ft, y: p.y + (dy / len) * ft }
}

// A closed polygon's edges cut short by `r` at each vertex, with a quadratic
// curve rounding the corner back through the original vertex — the "vibe" of a
// dirt skin's edge (no real infield has knife-edge corners at the bases).
function roundedPolygonPath(pts, r) {
  const n = pts.length
  const seg = (a, b, d) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const t = Math.min(d, len / 2) / len
    return { x: a.x + dx * t, y: a.y + dy * t }
  }
  const pIn = (i) => seg(pts[i], pts[(i - 1 + n) % n], r)
  const pOut = (i) => seg(pts[i], pts[(i + 1) % n], r)
  const last = pOut(n - 1)
  let d = `M ${f(last.x)} ${f(last.y)}`
  for (let i = 0; i < n; i++) {
    const into = pIn(i)
    const out = pOut(i)
    d += ` L ${f(into.x)} ${f(into.y)} Q ${f(pts[i].x)} ${f(pts[i].y)} ${f(out.x)} ${f(out.y)}`
  }
  return d + ' Z'
}

export function buildFieldGeometry(dist, wall, arc) {
  const pts = wallPoints(dist, wall, arc)
  const lf = pts[0]
  const rf = pts[pts.length - 1]
  const cf = pts.reduce((a, b) => (b.y < a.y ? b : a)) // topmost = deepest center

  // Fair territory: home → LF pole → straight fence run → RF pole → home.
  const fair = `M ${f(HOME.x)} ${f(HOME.y)} L ${line(pts)} L ${f(HOME.x)} ${f(HOME.y)} Z`

  // Warning track: a band of constant width running the whole fence, pole to
  // pole — inset from the wall by the same TRACK_FT everywhere, same as a real
  // park's track (not a stroke straddling the fence line, which used to leave
  // half its width sitting in foul ground beyond the wall).
  const trackInner = pts.map((p) => offsetFromHome(p, -TRACK_FT))
  const track = `M ${line(pts)} L ${line([...trackInner].reverse())} Z`

  // The fence again, split per segment so each can take a stroke width scaled to
  // the local wall height — a fat run for Fenway's Monster, a hairline elsewhere.
  const fenceSegs = []
  for (let i = 0; i < pts.length - 1; i++) {
    fenceSegs.push({
      d: `M ${f(pts[i].x)} ${f(pts[i].y)} L ${f(pts[i + 1].x)} ${f(pts[i + 1].y)}`,
      h: (pts[i].h + pts[i + 1].h) / 2,
    })
  }

  // Foul ground: the fence run pushed outward + a backstop curve behind home, as a
  // stylized park footprint sitting behind the grass (not park-accurate foul area).
  const foulPts = pts.map((p) => offsetFromHome(p, FOUL_FT))
  const backLeft = { x: HOME.x - 66, y: HOME.y + 30 }
  const backRight = { x: HOME.x + 66, y: HOME.y + 30 }
  const foul =
    `M ${f(backLeft.x)} ${f(backLeft.y)} L ${line(foulPts)} ` +
    `L ${f(backRight.x)} ${f(backRight.y)} ` +
    `Q ${f(HOME.x)} ${f(HOME.y + 58)} ${f(backLeft.x)} ${f(backLeft.y)} Z`

  // Foul lines, home to each pole.
  const foulLineL = `M ${f(HOME.x)} ${f(HOME.y)} L ${f(lf.x)} ${f(lf.y)}`
  const foulLineR = `M ${f(HOME.x)} ${f(HOME.y)} L ${f(rf.x)} ${f(rf.y)}`

  // Infield: dirt diamond home→1B→2B→3B (90-ft basepaths), mound at 60.5 ft, bases.
  const b = (dft, adeg) => {
    const r = (adeg * Math.PI) / 180
    return toSvg(dft * Math.sin(r), dft * Math.cos(r))
  }
  const b1 = b(90, 45)
  const b2 = b(90 * Math.SQRT2, 0)
  const b3 = b(90, -45)
  const mound = b(60.5, 0)
  // Corners rounded off — real dirt skins are never knife-edged at the bases.
  const infield = roundedPolygonPath([{ x: HOME.x, y: HOME.y }, b1, b2, b3], INFIELD_CORNER_FT)

  const labelAt = (p, t) => ({ ...offsetFromHome(p, 16), t })
  const tagAt = (p, h) => ({ ...offsetFromHome(p, -12), h })

  return {
    fair, track, fenceSegs, foul, infield, foulLineL, foulLineR,
    bases: [b1, b2, b3], mound,
    labels: [labelAt(lf, dist.lf), labelAt(cf, dist.cf), labelAt(rf, dist.rf)],
    wallTags: [tagAt(lf, wall.lf), tagAt(cf, wall.cf), tagAt(rf, wall.rf)],
  }
}

// Fence stroke width from wall height: a 5' wall is a hairline, the 37' Monster
// is unmistakably a wall.
export const wallStroke = (h) => f(1.4 + Math.min(h, 40) * 0.11)
