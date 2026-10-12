// Pure helpers that turn an MLB Gameday field SVG into a fence outline in the
// app's feet frame, and audit it against Baseball Savant's measured
// dimensions (#1859). No I/O: scripts/ballpark/import-field-layouts.mjs fetches, this parses.
//
// THE SOURCE. Gameday draws every MLB park in a 250×250 frame
// (prod-gameday.mlbstatic.com/responsive-gameday-assets/1.2.0/images/fields/{venueId}.svg)
// with named layers: `Outfield` (the field out to the wall), the two foul
// lines, and `home`. GeomMLBStadiums traced the same frame in 2018 with one
// fixed transform (2.4957 ft/unit, home at y=199). Measured against Savant,
// the frame is 2.40 ft/unit with home where the foul lines meet (y≈203.2), so
// that transform ran every park about 4% large and 10 ft deep.
//
// ONE SCALE FOR EVERY PARK. A per-park scale fitted to the poles would hide a
// wrong drawing: it shrinks or grows the whole park until the poles agree.
// With one scale, the poles, CF, the gaps, the deepest point and the fair area
// are all free, and all five are checks (auditOutline below). Fitting the scale
// per park over the 2026 rows gives a median of 2.400 ft/unit.

import { fenceDistanceAt, auditFence } from '../../../src/lib/ballpark/layout/fenceAudit.js'

export const SCALE_FT_PER_UNIT = 2.4

const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi

// An SVG path `d` as a list of subpaths, each a list of [x, y]. Curves are
// sampled (8 steps), which is far finer than a 250-unit drawing needs.
export function pathPoints(d) {
  const tokens = d.match(/[a-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []
  const subpaths = []
  let cur = []
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let cmd = null
  let lastCtrl = null
  let i = 0
  const num = () => Number(tokens[i++])
  const push = (px, py) => cur.push([px, py])
  const cubic = (x0, y0, x1, y1, x2, y2, x3, y3) => {
    for (let k = 1; k <= 8; k++) {
      const t = k / 8
      const u = 1 - t
      push(
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      )
    }
  }
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++]
    const rel = cmd === cmd.toLowerCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    switch (cmd.toLowerCase()) {
      case 'm': {
        if (cur.length) subpaths.push(cur)
        cur = []
        x = ox + num(); y = oy + num(); sx = x; sy = y
        push(x, y)
        cmd = rel ? 'l' : 'L' // later pairs are line-tos
        lastCtrl = null
        break
      }
      case 'l': x = ox + num(); y = oy + num(); push(x, y); lastCtrl = null; break
      case 'h': x = ox + num(); push(x, y); lastCtrl = null; break
      case 'v': y = oy + num(); push(x, y); lastCtrl = null; break
      case 'c': {
        const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num(), x3 = ox + num(), y3 = oy + num()
        cubic(x, y, x1, y1, x2, y2, x3, y3); lastCtrl = [x2, y2]; x = x3; y = y3
        break
      }
      case 's': {
        const x1 = lastCtrl ? 2 * x - lastCtrl[0] : x, y1 = lastCtrl ? 2 * y - lastCtrl[1] : y
        const x2 = ox + num(), y2 = oy + num(), x3 = ox + num(), y3 = oy + num()
        cubic(x, y, x1, y1, x2, y2, x3, y3); lastCtrl = [x2, y2]; x = x3; y = y3
        break
      }
      case 'q': {
        const qx = ox + num(), qy = oy + num(), x3 = ox + num(), y3 = oy + num()
        cubic(x, y, x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x3 + (2 / 3) * (qx - x3), y3 + (2 / 3) * (qy - y3), x3, y3)
        lastCtrl = null; x = x3; y = y3
        break
      }
      case 'a': { // arcs: endpoint only (none seen in the field layers)
        i += 5; x = ox + num(); y = oy + num(); push(x, y); lastCtrl = null
        break
      }
      case 'z': x = sx; y = sy; push(x, y); lastCtrl = null; break
      default: i++ // unknown command: skip a token rather than loop forever
    }
  }
  if (cur.length) subpaths.push(cur)
  return subpaths
}

// An SVG `transform` attribute as a 2×3 matrix [a, b, c, d, e, f].
function parseTransform(attr) {
  let m = [1, 0, 0, 1, 0, 0]
  const mul = (p, q) => [
    p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1],
    p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3],
    p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5],
  ]
  for (const [, fn, args] of attr.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const n = (args.match(NUM) ?? []).map(Number)
    let t = null
    if (fn === 'matrix') t = n
    else if (fn === 'translate') t = [1, 0, 0, 1, n[0], n[1] ?? 0]
    else if (fn === 'scale') t = [n[0], 0, 0, n[1] ?? n[0], 0, 0]
    else if (fn === 'rotate') {
      const r = (n[0] * Math.PI) / 180
      const [cx, cy] = [n[1] ?? 0, n[2] ?? 0]
      t = mul(mul([1, 0, 0, 1, cx, cy], [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]), [1, 0, 0, 1, -cx, -cy])
    }
    if (t) m = mul(m, t)
  }
  return { m, mul }
}

// The transform in force at character offset `at`: every open ancestor <g>'s
// transform, outermost first, then the element's own.
function transformAt(svg, at, ownTag) {
  const stack = []
  for (const g of svg.slice(0, at).matchAll(/<g\b[^>]*>|<\/g>/g)) {
    if (g[0] === '</g>') stack.pop()
    else stack.push(g[0])
  }
  let { m, mul } = parseTransform('')
  for (const tag of [...stack, ownTag]) {
    const t = tag.match(/\btransform="([^"]*)"/)
    if (t) m = mul(m, parseTransform(t[1]).m)
  }
  return ([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

// The points of the element whose id starts with `prefix` (Illustrator appends
// `_1_`, `_2_`, …; case-insensitive), in the SVG's own frame with every
// enclosing transform applied. A list of subpaths.
export function layer(svg, prefix) {
  const re = new RegExp(`<(path|polygon|polyline|line)\\b[^>]*\\bid="${prefix}[^"]*"[^>]*>`, 'i')
  const m = svg.match(re)
  if (!m) return null
  const tag = m[0]
  const apply = transformAt(svg, m.index, tag)
  let raw = null
  const d = tag.match(/\bd="([^"]*)"/)
  if (d) raw = pathPoints(d[1])
  const pts = !raw && tag.match(/\bpoints="([^"]*)"/)
  if (pts) {
    const n = pts[1].match(NUM).map(Number)
    const out = []
    for (let k = 0; k + 1 < n.length; k += 2) out.push([n[k], n[k + 1]])
    raw = [m[1].toLowerCase() === 'polygon' ? [...out, out[0]] : out]
  }
  if (!raw) {
    const ln = ['x1', 'y1', 'x2', 'y2'].map((a) => Number(tag.match(new RegExp(`\\b${a}="([^"]*)"`))?.[1]))
    if (ln.every(Number.isFinite)) raw = [[[ln[0], ln[1]], [ln[2], ln[3]]]]
  }
  return raw ? raw.map((sp) => sp.map(apply)) : null
}

// A foul line drawn from home to the pole: [home end, pole end], ordered by
// which end sits lower in the frame (home plate is at the bottom).
function foulLine(svg, side) {
  const sp = layer(svg, `${side}-foul-line`)
  if (!sp) return null
  const pts = sp.flat()
  const a = pts[0]
  const b = pts[pts.length - 1]
  return a[1] > b[1] ? [a, b] : [b, a]
}

const hypot = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])

// Ray from home at `deg` (0 = straightaway, negative toward LF) against a set
// of closed polylines in feet; the outermost crossing.
function outermost(polys, deg) {
  const rad = (deg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = Math.cos(rad)
  let best = null
  for (const pts of polys) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x1, y1] = pts[k]
      const [x2, y2] = pts[k + 1]
      const ex = x2 - x1
      const ey = y2 - y1
      const den = dx * ey - dy * ex
      if (Math.abs(den) < 1e-12) continue
      const t = (x1 * ey - y1 * ex) / den
      const u = (x1 * dy - y1 * dx) / den
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = best == null ? t : Math.max(best, t)
    }
  }
  return best
}

// Douglas-Peucker on an open polyline.
function simplify(pts, tol) {
  if (pts.length < 3) return pts
  const [a, b] = [pts[0], pts[pts.length - 1]]
  let far = -1
  let farD = 0
  for (let k = 1; k < pts.length - 1; k++) {
    const p = pts[k]
    const len = hypot(a, b) || 1
    const dist = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len
    if (dist > farD) { farD = dist; far = k }
  }
  if (farD <= tol) return [a, b]
  return [...simplify(pts.slice(0, far + 1), tol).slice(0, -1), ...simplify(pts.slice(far), tol)]
}

const r1 = (n) => Math.round(n * 10) / 10

// The fence outline of one field SVG, in feet (home (0,0), +x toward RF, +y
// toward CF), LF pole to RF pole, simplified to `tolFt`. Also returns the
// scale that would make the drawn foul lines match `poles` ({ lf, rf } in
// feet), for the import log. Returns null when a layer is missing.
export function fenceFromSvg(svg, { poles = null, tolFt = 1, scaleFtPerUnit = SCALE_FT_PER_UNIT } = {}) {
  const left = foulLine(svg, 'left')
  const right = foulLine(svg, 'right')
  const field = layer(svg, 'Outfield')
  if (!left || !right || !field) return null
  const home = [(left[0][0] + right[0][0]) / 2, (left[0][1] + right[0][1]) / 2]
  const units = { lf: hypot(left[0], left[1]), rf: hypot(right[0], right[1]) }
  const scale = scaleFtPerUnit
  const fittedScale = poles?.lf && poles?.rf ? (poles.lf / units.lf + poles.rf / units.rf) / 2 : null
  // Rotation: the bisector of the two foul lines is straightaway center.
  const angL = Math.atan2(left[1][0] - home[0], home[1] - left[1][1])
  const angR = Math.atan2(right[1][0] - home[0], home[1] - right[1][1])
  const rot = (angL + angR) / 2
  const toFeet = ([px, py]) => {
    const x = (px - home[0]) * scale
    const y = (home[1] - py) * scale
    const c = Math.cos(-rot)
    const s = Math.sin(-rot)
    return [x * c - y * s, x * s + y * c]
  }
  const polys = field.map((sp) => sp.map(toFeet))
  const span = ((angR - angL) * 180) / Math.PI / 2
  const out = sampleWall(polys, span, tolFt)
  if (!out) return null
  // The two softer layers (#1859, slice 5). Neither is a measurement: the art
  // is checked only for plausibility (checkLayers), and the app draws them as
  // estimates. Rounded to whole feet, because they ship with the app.
  // - `surface`: the playing surface, fair and foul, out to the wall and the
  //   stands — the `Outfield` layer's largest shape. It carries the foul ground
  //   and the backstop the stylized drawing used to invent.
  // - `trackInner`: the warning track's inner edge, the `grass` layer's outer
  //   edge sampled across fair territory.
  const surface = polys.reduce((a, b) => (polygonArea(b) > polygonArea(a) ? b : a))
  const grass = layer(svg, 'grass')?.map((sp) => sp.map(toFeet)) ?? []
  const inner = []
  for (let deg = -(span - 0.5); deg <= span - 0.5 + 1e-9; deg += 0.5) {
    const r = outermost(grass, deg)
    if (r != null) inner.push([r * Math.sin((deg * Math.PI) / 180), r * Math.cos((deg * Math.PI) / 180)])
  }
  const whole = (pts) => pts.map(([x, y]) => [Math.round(x), Math.round(y)])
  return {
    ...out,
    fittedScale,
    surface: whole(simplifyClosed(surface, 2)),
    trackInner: inner.length > 1 ? whole(simplify(inner, 2)) : null,
  }
}

function polygonArea(p) {
  return Math.abs(p.reduce((acc, q, i) => {
    const r = p[(i + 1) % p.length]
    return acc + q[0] * r[1] - r[0] * q[1]
  }, 0)) / 2
}

// Douglas-Peucker on a closed ring: split at the point farthest from the first.
function simplifyClosed(ring, tol) {
  const pts = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring
  if (pts.length < 4) return pts
  let far = 1
  for (let k = 1; k < pts.length; k++) if (hypot(pts[0], pts[k]) > hypot(pts[0], pts[far])) far = k
  return [...simplify(pts.slice(0, far + 1), tol).slice(0, -1), ...simplify([...pts.slice(far), pts[0]], tol).slice(0, -1)]
}

// Plausibility checks for the two softer layers against the audited fence.
// A layer that fails is not stored, and the app keeps its stylized drawing.
//   track: 8 to 40 ft wide at every 5° across fair territory (to ±40°);
//   surface: holds the fence (within 5 ft, inside the poles: the surface is
//   simplified to 2 ft and rounded to whole feet, which can shave a sharp
//   corner such as Fenway's triangle), its backstop is 35 to 90 ft
//   behind the plate, and it is larger than fair territory.
export const LAYER_LIMITS = { trackFt: [8, 40], backstopFt: [35, 90], fenceSlackFt: 5 }
export function checkLayers(fence, fairAreaSqFt, { surface, trackInner }) {
  const out = { track: false, surface: false }
  if (trackInner) {
    const widths = []
    for (let d = -40; d <= 40; d += 5) widths.push(fenceDistanceAt(fence, d) - (fenceDistanceAt(trackInner, d) ?? Infinity))
    out.track = widths.every((w) => w >= LAYER_LIMITS.trackFt[0] && w <= LAYER_LIMITS.trackFt[1])
  }
  if (surface?.length > 2) {
    const ring = [...surface, surface[0]]
    const back = outermost([ring], 180)
    // Interior bearings only: each pole is carried onto its foul line by
    // construction (sampleWall), right where the surface shape tucks in.
    const holdsFence = fence.every(([x, y]) => {
      const deg = (Math.atan2(x, y) * 180) / Math.PI
      return Math.abs(deg) > 44 || (outermost([ring], deg) ?? 0) >= Math.hypot(x, y) - LAYER_LIMITS.fenceSlackFt
    })
    out.surface = holdsFence && back != null &&
      back >= LAYER_LIMITS.backstopFt[0] && back <= LAYER_LIMITS.backstopFt[1] &&
      polygonArea(surface) > fairAreaSqFt
  }
  return out
}

// The wall of a field drawn as closed shapes in feet, sampled every 0.25°
// between foul lines `spanDeg` either side of center, simplified to `tolFt`.
// Sampling starts 0.5° inside each line: right at the line the art is
// unreliable both ways. A shape can tuck in before it (a bullpen gate, a
// corner cut; Wrigley), and a drawn foul line can run past the wall (Yankee
// Stadium). So each pole sits ON the foul line at the distance of the nearest
// inside sample.
function sampleWall(polys, spanDeg, tolFt) {
  const span = spanDeg
  const inner = span - 0.5
  const steps = Math.round((2 * inner) / 0.25)
  const polar = []
  for (let k = 0; k <= steps; k++) {
    const deg = -inner + (2 * inner * k) / steps
    const r = outermost(polys, deg)
    if (r != null) polar.push([deg, r])
  }
  if (polar.length < 2) return null
  polar.unshift([-span, polar[0][1]])
  polar.push([span, polar[polar.length - 1][1]])
  const sampled = polar.map(([deg, r]) => {
    const rad = (deg * Math.PI) / 180
    return [r * Math.sin(rad), r * Math.cos(rad)]
  })
  return {
    points: simplify(sampled, tolFt).map(([a, b]) => [r1(a), r1(b)]),
    foulAngleDeg: r1(span * 2),
    // Fair area: home → fence → home, shoelace (home is the origin, so its
    // two edges add nothing).
    areaSqFt: Math.round(Math.abs(sampled.reduce((acc, p, k) => {
      const q = sampled[k + 1] ?? [0, 0]
      return acc + (p[0] * q[1] - q[0] * p[1])
    }, 0)) / 2),
  }
}

// The thresholds an outline must meet against Savant's measured row. CF and
// the deepest point are tight: they are the numbers a renovation moves. The
// poles get more room because the wall can bend sharply right at the line
// (Fenway's Pesky's Pole), and the renderer pins each pole to the posted
// distance anyway. Savant's gap bearing is not published; ±18° is where its gap
// distances land on the outlines that match everywhere else (an inference from
// the 2026 rows), so the gaps get room too. Area catches a wall moved in one
// stretch, which no single bearing sees (Rogers Centre's 2023 alleys).
export const TOLERANCE = { cfFt: 5, deepestFt: 5, poleFt: 10, gapFt: 8, areaPct: 2.5 }
const GAP_DEG = 18

// `measured` = { dist: { lf, lc, cf, rc, rf }, deepest, areaSqFt }.
export function auditOutline(points, areaSqFt, measured) {
  let deepest = 0
  for (let a = -45; a <= 45; a += 0.25) deepest = Math.max(deepest, fenceDistanceAt(points, a) ?? 0)
  const d = measured.dist
  const err = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? r1(a - b) : null)
  const e = {
    lf: err(Math.hypot(...points[0]), d.lf),
    lc: err(fenceDistanceAt(points, -GAP_DEG), d.lc),
    cf: err(fenceDistanceAt(points, 0), d.cf),
    rc: err(fenceDistanceAt(points, GAP_DEG), d.rc),
    rf: err(Math.hypot(...points[points.length - 1]), d.rf),
    deepest: err(deepest, measured.deepest),
    areaPct: measured.areaSqFt ? r1((areaSqFt / measured.areaSqFt - 1) * 100) : null,
  }
  const within = (v, tol) => v != null && Math.abs(v) <= tol
  const pass =
    within(e.cf, TOLERANCE.cfFt) && within(e.deepest, TOLERANCE.deepestFt) &&
    within(e.lf, TOLERANCE.poleFt) && within(e.rf, TOLERANCE.poleFt) &&
    within(e.lc, TOLERANCE.gapFt) && within(e.rc, TOLERANCE.gapFt) &&
    within(e.areaPct, TOLERANCE.areaPct)
  return { errors: e, pass }
}

// ── Minor-league parks: the LEGACY Gameday art ─────────────────────────────
//
// Most MiLB field SVGs predate the named-layer style above: hand-drawn
// Illustrator shapes with no ids. What they share with every other Gameday
// field is a stamped infield and a three-point foul-line template (a
// fill="none" polyline whose lowest point is the apex of home plate). The
// outfield is drawn per park, in track and grass colours; the grey shapes are
// the compass glyph.
//
// The legacy art is drawn at its own scale. Fitted to the posted LF, CF and RF
// signs of the 68 parks it parses (2026-10-12), the median is 2.333 ft/unit,
// against 2.40 for the named-layer MLB art. One scale for every legacy park, for
// the same reason as above: a per-park fit would hide a wrong drawing.
//
// What this art is NOT: a survey. The audit below checks it only against the
// posted signs (no Savant row exists for a minor-league park), so a passing
// outline is an estimate, and the registry labels it so.
export const LEGACY_SCALE_FT_PER_UNIT = 2.333
const GREY = /^#(e4e4e4|dcdcdc|989898|727272|d0d0d0|ffffff|fff|58745e)$/i

function legacyShapes(svg) {
  const out = []
  for (const m of svg.matchAll(/<(path|polygon|polyline)\b([^>]*)>/g)) {
    const [tag, kind, attrs] = [m[0], m[1], m[2]]
    const fill = (attrs.match(/\bfill="([^"]*)"/)?.[1] ?? '').trim()
    const apply = transformAt(svg, m.index, tag)
    let subs = []
    const d = attrs.match(/\bd="([^"]*)"/)
    if (d) subs = pathPoints(d[1])
    const pp = attrs.match(/\bpoints="([^"]*)"/)
    if (pp) {
      const n = pp[1].match(NUM).map(Number)
      const q = []
      for (let k = 0; k + 1 < n.length; k += 2) q.push([n[k], n[k + 1]])
      subs = [kind === 'polygon' ? [...q, q[0]] : q]
    }
    out.push({ kind, fill, subs: subs.map((sp) => sp.map(apply)) })
  }
  return out
}

// The fence of a legacy MiLB field SVG, in feet, LF pole to RF pole, or null
// when the art has no foul-line template or no field shapes.
export function legacyFenceFromSvg(svg, { tolFt = 1, scaleFtPerUnit = LEGACY_SCALE_FT_PER_UNIT } = {}) {
  const shapes = legacyShapes(svg)
  const tmpl = shapes.find((s) => s.kind === 'polyline' && s.fill === 'none' && s.subs[0]?.length === 3)
  if (!tmpl) return null
  const q = tmpl.subs[0]
  const home = q.reduce((a, b) => (b[1] > a[1] ? b : a))
  const [L, R] = q.filter((p) => p !== home).sort((a, b) => a[0] - b[0])
  const angL = Math.atan2(L[0] - home[0], home[1] - L[1])
  const angR = Math.atan2(R[0] - home[0], home[1] - R[1])
  const rot = (angL + angR) / 2
  const toFeet = ([px, py]) => {
    const x = (px - home[0]) * scaleFtPerUnit
    const y = (home[1] - py) * scaleFtPerUnit
    return [x * Math.cos(-rot) - y * Math.sin(-rot), x * Math.sin(-rot) + y * Math.cos(-rot)]
  }
  const polys = shapes
    .filter((s) => s.fill && s.fill !== 'none' && !GREY.test(s.fill))
    .flatMap((s) => s.subs.map((sp) => sp.map(toFeet)))
  if (!polys.length) return null
  return sampleWall(polys, ((angR - angL) * 180) / Math.PI / 2, tolFt)
}

// Audit against the posted signs only: LF line, CF (straightaway or deepest,
// as auditFence reads it) and RF line, each within 10 ft.
export const POSTED_TOLERANCE_FT = 10
export function auditPosted(points, posted) {
  const cf = auditFence(points, posted?.cf)
  const err = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? r1(a - b) : null)
  const e = {
    lf: err(Math.hypot(...points[0]), posted?.lf),
    cf: cf ? cf.cfErrorFt : null,
    rf: err(Math.hypot(...points[points.length - 1]), posted?.rf),
  }
  const pass = Object.values(e).every((v) => v != null && Math.abs(v) <= POSTED_TOLERANCE_FT)
  return { errors: e, pass }
}
