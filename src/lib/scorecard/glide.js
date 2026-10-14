// The lens glide (#724, ADR-0092), as pure math: where the pane's scroll is at
// a given time after a tap. useLens runs it in a requestAnimationFrame tween.
//
// Why a tween and not `scroll-behavior: smooth` (G1): smooth scrolling cannot
// take a duration or a curve, and iOS takes control of it. The glide must end
// at --dur-glide, on the same --ease-out curve as every other arrival here.
//
// It reads positions only. It never sees a play: after a tap the target may
// depend on the result, because the reader has opened it (G8).

import { cubicBezier } from '../motion/curves.js'

// cubicBezier lives in lib/motion/curves.js now (#2073). Re-exported so this
// module's own readers keep one import.
export { cubicBezier }

// The --ease-out token's control points (tokens/effects.css). A test pins the
// two together, so a change to the token cannot leave the glide behind.
export const EASE_OUT = [0.16, 1, 0.3, 1]

export const easeOut = cubicBezier(...EASE_OUT)

// A CSS time (a token's computed value, `300ms` or `0.3s`) in ms, or
// `fallback` when it is not one. parseFloat alone drops the unit, so a token
// written in seconds would give a glide of 0.3 ms.
export function durationMs(css, fallback) {
  const m = /^\s*([\d.]+)(ms|s)\s*$/.exec(css)
  return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : fallback
}

// The scroll position `elapsed` ms into a glide of `ms` from `from` to `to`.
export function glideAt(from, to, elapsed, ms) {
  if (elapsed >= ms) return to
  return from + (to - from) * easeOut(elapsed / ms)
}
