// The contact replay's swing: a DRAWING, never data (docs/contact-replay.md §6.2).
// Pure math, no React. Ported from .scratch/contact-replay/prototype.html `swingModel`.
// Feet, Statcast's frame (camera.js): x right of the plate, y toward the mound, z up.
import { clamp } from '../math/number.js'

export const YC = 2.2 // contact, ft in front of the plate's back point (a design choice)
// Drawing offsets, not data (#2305 tunes them): where the bat meets the ball.
export const WHIFF_OFFSET = 0.42 // the bat passes this far over the ball
export const FOUL_OFFSET = 0.11 // the bat meets the bottom of the ball
export const CENTRE_OFFSET = 2.25 // the swing circle's centre, ft to the batter's side
export const FOLLOW = 0.22 // s of follow-through after contact

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a) => mul(a, 1 / Math.hypot(...a))
const lerp = (a, b, k) => add(mul(a, 1 - k), mul(b, k))
const smooth = (k) => k * k * (3 - 2 * k)

// `swing` is 'whiff' | 'foul' | 'inplay'; `K` is the contact point [x, y, z] (contactPoint).
// Returns the bat at real time `dt` from contact, `at(dt)` = { knob, end, th }, and the
// sweet spot at angle `theta`, `sweet(theta)`, with the constants the drawing needs.
export function swingModel({ batSide, swing, K, attackDeg = 10, swingSec = 0.16 }) {
  const side = batSide === 'R' ? -1 : 1 // a right-handed batter stands left of the plate, seen from behind
  const Kb = add(K, [0, 0, swing === 'whiff' ? WHIFF_OFFSET : swing === 'foul' ? FOUL_OFFSET : 0])
  const Cn = [side * CENTRE_OFFSET, YC - 0.15, Kb[2] + 0.75]
  const u = unit(sub(Kb, Cn))
  const a = (attackDeg * Math.PI) / 180
  const v0 = [0, Math.cos(a), Math.sin(a)]
  const v = unit(sub(v0, mul(u, dot(v0, u))))
  const R = Math.hypot(...sub(Kb, Cn))
  const plane = (th) => add(mul(u, Math.cos(th)), mul(v, Math.sin(th)))
  const knobLoad = add(Cn, [side * 0.2, -0.35, 0.4])
  const dirLoad = unit([side * 0.35, -0.45, 0.82])
  const dirCoil = unit([side * 0.5, -0.7, 0.55])
  const TH0 = (-125 * Math.PI) / 180
  const THE = (150 * Math.PI) / 180
  const COIL = 0.09
  const SWING = swingSec

  function at(dt) {
    let dir, knob, th = null
    if (dt < -SWING) {
      const e = smooth(dt < -SWING - COIL ? 0 : clamp((dt + SWING + COIL) / COIL, 0, 1))
      dir = unit(lerp(dirLoad, dirCoil, e))
      knob = add(knobLoad, [0, -0.08 * e, 0])
    } else if (dt <= 0) {
      const q = (dt + SWING) / SWING
      th = TH0 * (1 - q * q) // gathers speed into the ball
      const e = smooth(clamp(q / 0.4, 0, 1))
      const pd = plane(th)
      dir = unit(lerp(dirCoil, pd, e))
      knob = lerp(add(knobLoad, [0, -0.08, 0]), add(Cn, mul(pd, R - 2.15)), e)
    } else {
      const q = clamp(dt / FOLLOW, 0, 1)
      th = THE * (1 - (1 - q) ** 3)
      dir = plane(th)
      knob = add(Cn, mul(dir, R - 2.15))
    }
    return { knob, end: add(knob, mul(dir, 2.65)), th }
  }
  const sweet = (th) => add(Cn, mul(plane(th), R))
  return { at, sweet, Kb, TH0, THE, COIL, SWING, FOLLOW }
}
