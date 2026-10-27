// The stage's world: Statcast's frame in feet (x toward first base, y from the plate toward the
// mound, z up, home plate at the origin), vector math, the pitch-view camera and the park's wall.
// Pure: no React, no DOM, no clock. Part of Gameday's stage (#2568 slice 4, #2569).
import { wallOnLine } from '../../../../lib/ballpark/ballFlight.js'

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, u) => a + (b - a) * u
export const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)
export const smooth = (u) => u * u * (3 - 2 * u)

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] },
  lerp: (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)],
}

// A point `ft` out on the ray `deg` off straightaway center (negative toward left field).
export const polar = (deg, ft, z = 0) => [ft * Math.sin((deg * Math.PI) / 180), ft * Math.cos((deg * Math.PI) / 180), z]
export const bearingOf = (x, y) => (Math.atan2(x, y) * 180) / Math.PI

const B90 = 90 / Math.SQRT2
export const BASES = { home: [0, 0, 0], '1B': [B90, B90, 0], '2B': [0, 2 * B90, 0], '3B': [-B90, B90, 0] }
export const MOUND = [0, 60.5, 0]
// Where each fielder stands, drawn (not tracked).
export const POS = {
  P: [0, 58, 0], C: [0, -3.5, 0], '1B': polar(37, 108), '2B': polar(14, 148), SS: polar(-13, 146),
  '3B': polar(-36, 104), LF: polar(-26, 255), CF: polar(0, 318), RF: polar(28, 285),
}

// The wall on the ray `deg`: { ft, h }, from resolveBallparkLayout's layout via wallOnLine. A park
// with no layout on file (most MiLB) gets a plain 330 ft, 8 ft wall so the stage still draws.
export function wallFn(layout) {
  const memo = new Map() // the drawing asks per pixel; the lookup reads the whole layout
  return (deg) => {
    const d = Math.round(clamp(deg, -45, 45) * 10) / 10
    if (!memo.has(d)) {
      const w = layout && wallOnLine(layout, d)
      memo.set(d, w ? { ft: w.ft, h: w.height } : { ft: 330, h: 8 })
    }
    return memo.get(d)
  }
}

// ---- Camera ------------------------------------------------------------------------------------
function camera(pos, target, vfov) {
  const f = v3.norm(v3.sub(target, pos))
  let r = v3.cross(f, [0, 0, 1])
  if (v3.len(r) < 1e-6) r = [1, 0, 0]
  r = v3.norm(r)
  return { pos, f, r, u: v3.cross(r, f), k: 1 / Math.tan(((vfov || 30) * Math.PI) / 360) }
}

// Screen px for a W x H buffer: d is depth in ft, s px per ft at that depth. Null behind the lens.
export function project(cam, p, W, H) {
  const q = v3.sub(p, cam.pos), d = v3.dot(q, cam.f)
  if (d < 0.5) return null
  const half = H / 2
  return { x: W / 2 + ((v3.dot(q, cam.r) * cam.k) / d) * half, y: half - ((v3.dot(q, cam.u) * cam.k) / d) * half, d, s: (cam.k * half) / d }
}

// Behind home plate, a little high. A tall phone stage would cut the batter off with a fixed lens,
// so the vertical field of view widens to keep at least 6 ft either side of the plate in view
// (round 1 finding, #2568).
export function homeCamera(aspect) {
  const needHalfV = (Math.atan(Math.tan((11.3 * Math.PI) / 180) / Math.max(0.2, aspect)) * 180) / Math.PI
  return camera([0, -30, 7.2], [0, 30, 2.2], Math.max(17, 1.45 * needHalfV)) // zoomed in: the batter and the zone fill the frame
}
