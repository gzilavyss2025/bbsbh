// The stage's world: Statcast's frame in feet (x toward first base, y from the plate toward the
// mound, z up, home plate at the origin), vector math and the park's wall.
// Pure: no React, no DOM, no clock. Part of Gameday's stage (#2568 slice 4, #2569).
import { wallOnLine } from '../../../../lib/ballpark/ballFlight.js'

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, u) => a + (b - a) * u
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

const B90 = 90 / Math.SQRT2
export const BASES = { home: [0, 0, 0], '1B': [B90, B90, 0], '2B': [0, 2 * B90, 0], '3B': [-B90, B90, 0] }
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
