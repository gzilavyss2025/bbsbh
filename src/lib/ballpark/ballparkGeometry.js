// Geometry for the ballpark field drawing (see components/BallparkDiagram.jsx).
// Turns one resolved park layout (layout/resolveLayout.js) into the SVG path
// strings + label points the diagram renders — infield diamond, outfield grass,
// warning track, foul ground, and the fence.
//
// The fence is drawn as STRAIGHT segments (real outfield walls are straight
// runs meeting at distinct corners — never a smooth arc), from one of two
// inputs:
//   • the layout's audited outline (an LF-pole→RF-pole point list in feet),
//     cut at the two foul lines with segment intersections (layout/fenceShape.js);
//   • otherwise a five-point outline through the posted LF/LC/CF/RC/RF distances,
//     with the gaps at ±22.5° — a drawing choice, since a posted gap sign has no
//     published bearing. The layout's `quality.fence` ('dimensions-only') records it.
//
// The CF distance label sits where the CF sign stands: straightaway center, or
// the angle the layout audit found the posted number at (`cfAngle`, Fenway's
// triangle). It used to sit at the fence's deepest vertex, which is a different
// point in most parks (#1859).
//
// Wall height sets each fence segment's stroke weight. It comes from Savant's
// five measured heights when the layout has them, else the three posted ones
// (layout/fenceShape.js's heightAt). Only the measured or posted values are
// ever printed; between them the weight is a drawing choice.
//
// Pure and self-contained (no React, no data import). Home plate anchors the
// drawing; feet map 1:1 to SVG units, +x toward right field, +y toward center
// field (SVG y grows down, so center field subtracts from home's y). Fixed
// 620×560 viewBox and fixed scale, so a deep park visibly fills more of the
// frame. The deepest outline on file (433 ft, the old Tal's Hill wall) tops out
// at y≈72 and the widest pole (355 ft) at x≈59, both inside the frame and
// below the plot window's sky crop, so no park needs its own scale.

export const VIEWBOX = { w: 620, h: 560 }
export const HOME = { x: 310, y: 505 }

// THE PLOT WINDOW. Every card that uses this drawing as a GROUND to mark balls
// on — the hit chart, the flight card the play-by-play diamond opens — crops
// the dead sky off the top so the field fills the card. It is a WINDOW onto the
// fixed viewBox above and never a rescale, so a mark's coordinates mean the same
// thing cropped or not. The crop is the same for every park on purpose: marks from
// different parks stay comparable. The park CARDS (lib/ballpark/layout/parkWindow.js) crop
// to their own park instead. Stated once, here, because two consumers positioning HTML over
// the SVG in percentages of this box would otherwise drift apart. Set the crop to 0 to go
// back to the full frame.
export const PLOT_SKY_CROP = 50
export const PLOT_VIEWBOX = `0 ${PLOT_SKY_CROP} ${VIEWBOX.w} ${VIEWBOX.h - PLOT_SKY_CROP}`

// Where an SVG point sits as a percentage of the plot window: the position for
// an HTML label laid over a plot card (the hit chart's dot numbers). The one
// spelling of that mapping, so HTML and SVG marks cannot slide apart
// (test/overlay-alignment.test.js).
export function plotPercent({ x, y }) {
  return { left: (x / VIEWBOX.w) * 100, top: ((y - PLOT_SKY_CROP) / (VIEWBOX.h - PLOT_SKY_CROP)) * 100 }
}
const ANGLE = { lf: -45, lc: -22.5, cf: 0, rc: 22.5, rf: 45 }
const TRACK_FT = 14 // warning-track width, feet
const FOUL_FT = 26 // stylized foul-ground margin beyond the wall/lines
const INFIELD_CORNER_FT = 14 // how far the grass diamond's corner rounding eats into each baseline
const MOUND_FT = 60.5
const SKIN_RADIUS_FT = 95 // real groundskeeping spec: skin infield is a 95' arc off the pitcher's plate
const MOUND_DIRT_FT = 9 // dirt circle around the pitching rubber
const HOME_DIRT_FT = 13 // dirt circle around home plate
const BASELINE_DIRT_FT = 6 // width of the dirt running-lane strip along each baseline

import { fenceDistanceAt } from './layout/fenceAudit.js'
import { clipToFoulLines, heightAt } from './layout/fenceShape.js'

const f = (n) => Math.round(n * 100) / 100

// Feet (home-origin, y toward center) → SVG point.
const toSvg = (xFt, yFt) => ({ x: HOME.x + xFt, y: HOME.y - yFt })
// SVG points → [x, y] feet, the frame fenceDistanceAt reads.
const toFeet = (pts) => pts.map((p) => [p.x - HOME.x, HOME.y - p.y])

// The ordered wall as SVG points carrying each point's bearing + local wall
// height. From the clipped outline when present, else the five posted distances.
function wallPoints(dist, heights, fence) {
  const clipped = clipToFoulLines(fence)
  if (clipped) {
    return clipped.map(([xf, yf]) => {
      const a = (Math.atan2(xf, yf) * 180) / Math.PI
      return { ...toSvg(xf, yf), a, h: heightAt(a, heights) }
    })
  }
  return ['lf', 'lc', 'cf', 'rc', 'rf'].map((k) => {
    const a = ANGLE[k]
    const rad = (a * Math.PI) / 180
    return { ...toSvg(dist[k] * Math.sin(rad), dist[k] * Math.cos(rad)), a, h: heightAt(a, heights) }
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

// Where the fence crosses the ray from home at `deg`, as an SVG point; the
// deepest point when the ray misses (it cannot for a fence pinned at both poles).
function fencePointAt(pts, deg) {
  const ft = fenceDistanceAt(toFeet(pts), deg)
  if (ft == null) return pts.reduce((a, b) => (b.y < a.y ? b : a))
  const rad = (deg * Math.PI) / 180
  return toSvg(ft * Math.sin(rad), ft * Math.cos(rad))
}

// The input the drawing needs from a resolved layout (resolveLayout.js):
// posted distances (the labels), the three printed wall heights, the heights
// that weight the stroke (Savant's five when measured), the outline, and
// where the CF sign stands.
export function diagramInput(layout) {
  const { dist, wall, measured } = layout.measurements
  return {
    dist,
    wall,
    heights: measured?.height ?? wall ?? null,
    fence: layout.geometry.fence,
    cfAngle: layout.geometry.cfMarkerAngle,
    surface: layout.geometry.surface ?? null,
    trackInner: layout.geometry.trackInner ?? null,
  }
}

// Feet from home plate to the wall the drawing draws, on the ray at `deg` (0 =
// straightaway center, negative toward left field): the same outline the plan
// view inks, so the side view's wall (ballFlight.js) stands where this one is.
// Null for a ray that misses the wall, or a layout with no wall to draw.
export function wallDistanceAt(layout, deg) {
  const { dist, heights, fence } = diagramInput(layout)
  if (!fence && !dist) return null
  const pts = wallPoints(dist, heights ?? UNKNOWN_HEIGHTS, fence)
  return fenceDistanceAt(toFeet(pts), deg)
}

// The stroke weight for a wall whose heights are unknown (an older
// configuration): an ordinary 8 ft. It is a drawing weight only; no label
// prints it, and the wall tags are left off.
const UNKNOWN_HEIGHTS = { lf: 8, cf: 8, rf: 8 }

export function buildFieldGeometry({
  dist, wall, heights = wall, fence = null, cfAngle = 0, surface = null, trackInner = null,
}) {
  const pts = wallPoints(dist, heights ?? UNKNOWN_HEIGHTS, fence)
  const lf = pts[0]
  const rf = pts[pts.length - 1]
  const cf = fencePointAt(pts, cfAngle)

  // Fair territory: home → LF pole → straight fence run → RF pole → home.
  const fair = `M ${f(HOME.x)} ${f(HOME.y)} L ${line(pts)} L ${f(HOME.x)} ${f(HOME.y)} Z`

  // Warning track: the band between the wall and the track's inner edge. The
  // park's own edge when the layout has one (Gameday's grass line, slice 5),
  // else a band of constant width, inset from the wall by TRACK_FT everywhere
  // (not a stroke straddling the fence line, which used to leave half its
  // width sitting in foul ground beyond the wall).
  const inner = trackInner?.length > 1
    ? trackInner.map(([x, y]) => toSvg(x, y))
    : pts.map((p) => offsetFromHome(p, -TRACK_FT))
  const track = `M ${line(pts)} L ${line([...inner].reverse())} Z`

  // The fence again, split per segment so each can take a stroke width scaled to
  // the local wall height — a fat run for Fenway's Monster, a hairline elsewhere.
  const fenceSegs = []
  for (let i = 0; i < pts.length - 1; i++) {
    fenceSegs.push({
      d: `M ${f(pts[i].x)} ${f(pts[i].y)} L ${f(pts[i + 1].x)} ${f(pts[i + 1].y)}`,
      h: (pts[i].h + pts[i + 1].h) / 2,
    })
  }

  // Foul ground: the park's own playing surface when the layout has one
  // (Gameday's drawing, fair and foul out to the stands and the backstop,
  // slice 5), drawn behind the grass. Else the fence run pushed outward + a
  // backstop curve behind home, as a stylized footprint.
  const foulPts = pts.map((p) => offsetFromHome(p, FOUL_FT))
  const backLeft = { x: HOME.x - 66, y: HOME.y + 30 }
  const backRight = { x: HOME.x + 66, y: HOME.y + 30 }
  const foul = surface?.length > 2
    ? `M ${line(surface.map(([x, y]) => toSvg(x, y)))} Z`
    : `M ${f(backLeft.x)} ${f(backLeft.y)} L ${line(foulPts)} ` +
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
  // Only values on file are printed: an older wall may know its CF and not
  // its lines, and its heights not at all.
  const labels = [labelAt(lf, dist.lf), labelAt(cf, dist.cf), labelAt(rf, dist.rf)].filter((l) => Number.isFinite(l.t))
  // The highest ink on the drawing: a distance sign's upper half, or the wall's outer edge.
  // A card crops the frame's empty sky down to it (layout/parkWindow.js).
  const top = Math.min(...labels.map((l) => l.y - LABEL_HALF), ...pts.map((p) => p.y - wallStroke(p.h) / 2))

  return {
    fair, track, fenceSegs, foul, skin, grassDiamond, foulLineL, foulLineR,
    baselineDirtL, baselineDirtR,
    bases: [b1, b2, b3], mound,
    moundDirtR: MOUND_DIRT_FT, homeDirtR: HOME_DIRT_FT, baselineDirtW: BASELINE_DIRT_FT,
    labels,
    top,
    wallTags: wall ? [tagAt(lf, wall.lf), tagAt(cf, wall.cf), tagAt(rf, wall.rf)].filter((w) => Number.isFinite(w.h)) : [],
  }
}

// Half a distance sign's height: .bpdiagram__dist is set at --fs-title-sm (18px, 18 units in
// this frame) and centred on its point. test/park-window.test.js reads the token and holds this
// to it, so a bigger sign cannot slip out of a cropped window.
export const LABEL_HALF = 10

// Fence stroke width from wall height: a 5' wall is a hairline, the 37' Monster
// is unmistakably a wall.
export const wallStroke = (h) => f(1.4 + Math.min(h, 40) * 0.11)
