// The Pitch flight on a <canvas> (#2073, board PitchFlight.dc.html): the park, each path as a tapered
// comet trail, the ball with its shadow, and each landing mark with a ripple. The pitch colour and shape
// are the row's pitchMark (docs/pitch-types.md); paper and ink are the page's tokens (flightPalette).
// The sizes and fades are flightMotion.js's, which a test pins. Not pure: it draws.
import { glyphD } from '../../../../../lib/pitch/pitchGlyph.js'
import { TRAIL_N, ballR, rippleAt, trailStyle } from './flightMotion.js'
import { PLATE_Z, ZONE, lineD, makeCamera, project, sceneD, trailD } from './flightView.js'

const TAU = 2 * Math.PI
const { x: ZX, y0: ZY0, y1: ZY1 } = ZONE
const RUBBER = [[-1, 0, 60.25], [1, 0, 60.25], [1, 0, 60.75], [-1, 0, 60.75]]
const PLATE = [[-ZX, 0, PLATE_Z], [ZX, 0, PLATE_Z], [ZX, 0, ZX], [0, 0, 0], [-ZX, 0, ZX]]
const ZONE_FACE = [[-ZX, ZY0, PLATE_Z], [ZX, ZY0, PLATE_Z], [ZX, ZY1, PLATE_Z], [-ZX, ZY1, PLATE_Z]]

// The colours the canvas paints with, read from the tokens on `el` (a canvas cannot read var()).
export function flightPalette(el) {
  const cs = getComputedStyle(el)
  const v = (name) => cs.getPropertyValue(name).trim()
  return {
    paper: v('--surface-card'),
    ink: v('--text-heading'),
    caption: v('--text-caption'),
    grid: v('--border-grid'),
    inset: v('--surface-inset'),
    mono: v('--font-mono'),
  }
}

// A closed shape through `pts`, or false when a corner is behind the lens.
// ponytail: the board clips the shape at the lens. Every preset and every turned view keeps the plate,
// zone and rubber in front, so a corner behind the lens drops the shape instead. Clip only if one vanishes.
function polyPath(ctx, cam, pts) {
  const ps = pts.map((q) => project(cam, q))
  if (ps.some((p) => !p)) return false
  ctx.beginPath()
  ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
  return true
}

function strokeD(ctx, d, color, width) {
  if (!d) return
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.stroke(new Path2D(d))
}

function park(ctx, cam, pal) {
  const d = sceneD(cam)
  strokeD(ctx, d.grid, pal.grid, 1)
  strokeD(ctx, d.mound, pal.caption, 1)
  if (polyPath(ctx, cam, RUBBER)) {
    ctx.fillStyle = pal.ink
    ctx.fill()
  }
  if (polyPath(ctx, cam, PLATE)) {
    ctx.fillStyle = pal.caption
    ctx.fill()
  }
  if (polyPath(ctx, cam, ZONE_FACE)) {
    ctx.fillStyle = pal.inset
    ctx.fill()
    ctx.lineWidth = 1.6
    ctx.strokeStyle = pal.ink
    ctx.stroke()
  }
}

// A path from release to `s` seconds as a comet: n pieces, each with an ink under-stroke.
function trail(ctx, cam, path, s, color, pal, o = {}) {
  const n = o.n ?? TRAIL_N
  let prev = path.at(0)
  ctx.lineCap = 'butt'
  for (let k = 1; k <= n; k++) {
    const cur = path.at((s * k) / n)
    const d = lineD(cam, prev, cur)
    prev = cur
    if (!d) continue
    const piece = new Path2D(d)
    const st = trailStyle(k, n, project(cam, cur)?.k, o)
    ctx.globalAlpha = st.alpha * 0.4
    ctx.strokeStyle = pal.ink
    ctx.lineWidth = st.width + 1.6
    ctx.stroke(piece)
    ctx.globalAlpha = st.alpha
    ctx.strokeStyle = color
    ctx.lineWidth = st.width
    ctx.stroke(piece)
  }
  ctx.globalAlpha = 1
}

// The ball in flight: its shadow on the ground and a dashed drop line to it, a ring in the pitch colour,
// a paper face.
function ball(ctx, cam, q, color, pal) {
  const p = project(cam, q)
  if (!p) return
  const r = ballR(p.k)
  const g = project(cam, [q[0], 0, q[2]])
  if (g) {
    ctx.save()
    ctx.globalAlpha = 0.2
    ctx.fillStyle = pal.ink
    ctx.beginPath()
    ctx.ellipse(g.x, g.y, r * 1.1, Math.max(1, r * 0.32), 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 0.22
    ctx.strokeStyle = pal.ink
    ctx.lineWidth = 1
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    ctx.moveTo(p.x, p.y + r)
    ctx.lineTo(g.x, g.y)
    ctx.stroke()
    ctx.restore()
  }
  ctx.beginPath()
  ctx.arc(p.x, p.y, r + Math.max(1.4, r * 0.2), 0, TAU)
  ctx.lineWidth = Math.max(1.8, r * 0.26)
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, TAU)
  ctx.fillStyle = pal.paper
  ctx.fill()
  ctx.lineWidth = Math.max(1.2, r * 0.16)
  ctx.strokeStyle = pal.ink
  ctx.stroke()
}

// The gravity-only path, whole and dashed, and a dashed ghost ball on it at `s`.
function ghost(ctx, cam, path, s, pal) {
  ctx.save()
  ctx.strokeStyle = pal.ink
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 1.3
  ctx.setLineDash([5, 4])
  const d = trailD(cam, path.grav, path.T, 40)
  if (d) ctx.stroke(new Path2D(d))
  const g = project(cam, path.grav(s))
  if (g) {
    ctx.globalAlpha = 1
    ctx.lineWidth = 1.6
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(g.x, g.y, ballR(g.k), 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
}

// Where a pitch landed: its mark, a ripple `age` seconds after it landed (null: none), and its number in
// the round when the mark is big enough to hold it.
function mark(ctx, cam, it, pal, num, age) {
  if (!it.landing) return
  const p = project(cam, [it.landing.x, it.landing.h, PLATE_Z])
  if (!p) return
  const r = ballR(p.k)
  const color = it.mark.color
  const rip = age == null ? null : rippleAt(age, r)
  if (rip) {
    ctx.save()
    ctx.globalAlpha = rip.alpha
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(p.x, p.y, rip.r, 0, TAU)
    ctx.stroke()
    ctx.restore()
  }
  ctx.save()
  ctx.translate(p.x, p.y)
  const g = new Path2D(glyphD(it.mark.shape, r))
  if (it.mark.ring) {
    ctx.lineWidth = 3
    ctx.strokeStyle = color
    ctx.stroke(g)
  } else {
    ctx.fillStyle = color
    ctx.fill(g)
    ctx.lineWidth = 1.6
    ctx.strokeStyle = pal.ink
    ctx.stroke(g)
  }
  ctx.restore()
  if (num && r > 8) {
    ctx.fillStyle = pal.ink
    ctx.font = `700 ${Math.min(14, r)}px ${pal.mono}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), p.x, p.y + 0.5)
  }
}

// One frame. `f`: { W, H, pal, view, s, now, landT, items, done, ghost, num }.
// items: the rows in flight; done: earlier rows of the round (In order); num: the current pitch's number
// (In order) or null; landT: Map of code -> landing time (s, same clock as `now`).
export function paintFlight(ctx, f) {
  const { W, H, pal, s } = f
  const cam = makeCamera(f.view, W, H)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = pal.paper
  ctx.fillRect(0, 0, W, H)
  park(ctx, cam, pal)
  f.done.forEach((it) => trail(ctx, cam, it.path, it.path.T, it.mark.color, pal, { n: 24, alpha: 0.32, wm: 0.55 }))
  if (f.ghost && f.items[0]) ghost(ctx, cam, f.items[0].path, s, pal)
  f.done.forEach((it, n) => mark(ctx, cam, it, pal, n + 1, null))
  f.items.forEach((it) => trail(ctx, cam, it.path, Math.min(s, it.path.T), it.mark.color, pal, { wm: 1.1 }))
  const landed = (it) => s >= it.path.T - 1e-6
  // Far balls first, so a near one covers them.
  f.items
    .filter((it) => !landed(it))
    .map((it) => ({ it, q: it.path.at(s), p: project(cam, it.path.at(s)) }))
    .filter((b) => b.p)
    .sort((a, b) => a.p.k - b.p.k)
    .forEach((b) => ball(ctx, cam, b.q, b.it.mark.color, pal))
  f.items.forEach((it) => {
    if (!landed(it)) return
    const t = f.landT.get(it.code)
    mark(ctx, cam, it, pal, f.num, t == null ? null : f.now - t)
  })
}
