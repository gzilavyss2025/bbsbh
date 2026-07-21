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
const INFIELD_CORNER_FT = 14 // how far the grass diamond's corner rounding eats into each baseline
const MOUND_FT = 60.5
const SKIN_RADIUS_FT = 95 // real groundskeeping spec: skin infield is a 95' arc off the pitcher's plate
const MOUND_DIRT_FT = 9 // dirt circle around the pitching rubber
const HOME_DIRT_FT = 13 // dirt circle around home plate
const BASELINE_DIRT_FT = 6 // width of the dirt running-lane strip along each baseline

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
    // The digitized polygon (GeomMLBStadiums' outfield_outer) runs past both foul
    // poles into foul territory — bullpen/camera-well wall beyond the true fair
    // line. Keep only the interior fair-territory points (within ±45° of dead
    // center) and cap each end at the actual posted pole distance, so the fence
    // still ends exactly at the foul line the labels report instead of bulging
    // past it.
    const interior = arc
      .map(([xf, yf]) => ({ xf, yf, a: (Math.atan2(xf, yf) * 180) / Math.PI }))
      .filter((p) => p.a >= -45 && p.a <= 45)
    const pole = (adeg, r) => {
      const rad = (adeg * Math.PI) / 180
      return { xf: r * Math.sin(rad), yf: r * Math.cos(rad), a: adeg }
    }
    const withPoles = [pole(-45, dist.lf), ...interior, pole(45, dist.rf)]
    return withPoles.map((p) => ({ ...toSvg(p.xf, p.yf), a: p.a, h: heightAt(p.a, wall) }))
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

// The dirt "skin" infield: home plate, out along each foul line, capped by the
// arc of a circle of radius `rFt` centered on the pitcher's mound — the real
// construction spec for where the infield dirt ends and outfield grass begins.
// Approximated as a sampled polyline rather than an SVG arc command (simpler
// than working out sweep flags, and this is a stylized "vibe" drawing anyway).
function skinFanPath(moundFt, rFt) {
  const footT = (aDeg) => {
    const cosA = Math.cos((aDeg * Math.PI) / 180)
    const b = -2 * moundFt * cosA
    const c = moundFt * moundFt - rFt * rFt
    return (-b + Math.sqrt(b * b - 4 * c)) / 2
  }
  const feetPoint = (aDeg, t) => {
    const rad = (aDeg * Math.PI) / 180
    return { x: t * Math.sin(rad), y: t * Math.cos(rad) }
  }
  const mound = { x: 0, y: moundFt }
  const footL = feetPoint(-45, footT(-45))
  const footR = feetPoint(45, footT(45))
  const angleFromMound = (p) => (Math.atan2(p.x - mound.x, p.y - mound.y) * 180) / Math.PI
  const thetaL = angleFromMound(footL)
  const thetaR = angleFromMound(footR)
  const STEPS = 16
  const arcPts = []
  for (let i = 0; i <= STEPS; i++) {
    const theta = thetaL + ((thetaR - thetaL) * i) / STEPS
    const rad = (theta * Math.PI) / 180
    arcPts.push(toSvg(mound.x + rFt * Math.sin(rad), mound.y + rFt * Math.cos(rad)))
  }
  return `M ${f(HOME.x)} ${f(HOME.y)} L ${line(arcPts)} Z`
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

  // Infield: home→1B→2B→3B (90-ft basepaths), mound at 60.5 ft, bases. Real
  // infields aren't a plain dirt diamond on grass — a big dirt "skin" fans out
  // from home past the bases (capped by the 95'-off-the-mound arc), with grass
  // cut into the middle of it and dirt circles at the mound and home plate.
  const b = (dft, adeg) => {
    const r = (adeg * Math.PI) / 180
    return toSvg(dft * Math.sin(r), dft * Math.cos(r))
  }
  const b1 = b(90, 45)
  const b2 = b(90 * Math.SQRT2, 0)
  const b3 = b(90, -45)
  const mound = b(MOUND_FT, 0)
  const skin = skinFanPath(MOUND_FT, SKIN_RADIUS_FT)
  // Corners rounded off — no real infield grass is knife-edged at the bases.
  const grassDiamond = roundedPolygonPath([{ x: HOME.x, y: HOME.y }, b1, b2, b3], INFIELD_CORNER_FT)
  // Dirt running lanes along each baseline, home to 1B/3B.
  const baselineDirtL = `M ${f(HOME.x)} ${f(HOME.y)} L ${f(b1.x)} ${f(b1.y)}`
  const baselineDirtR = `M ${f(HOME.x)} ${f(HOME.y)} L ${f(b3.x)} ${f(b3.y)}`

  const labelAt = (p, t) => ({ ...offsetFromHome(p, 16), t })
  const tagAt = (p, h) => ({ ...offsetFromHome(p, -12), h })

  return {
    fair, track, fenceSegs, foul, skin, grassDiamond, foulLineL, foulLineR,
    baselineDirtL, baselineDirtR,
    bases: [b1, b2, b3], mound,
    moundDirtR: MOUND_DIRT_FT, homeDirtR: HOME_DIRT_FT, baselineDirtW: BASELINE_DIRT_FT,
    labels: [labelAt(lf, dist.lf), labelAt(cf, dist.cf), labelAt(rf, dist.rf)],
    wallTags: [tagAt(lf, wall.lf), tagAt(cf, wall.cf), tagAt(rf, wall.rf)],
  }
}

// Fence stroke width from wall height: a 5' wall is a hairline, the 37' Monster
// is unmistakably a wall.
export const wallStroke = (h) => f(1.4 + Math.min(h, 40) * 0.11)
