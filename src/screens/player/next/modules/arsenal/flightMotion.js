// The Pitch flight's motion (#2073, board PitchFlight.dc.html): the loop of phases each flight runs through,
// and the camera's swing from one pose to the next. Pure; no clock, no DOM. FlightCard runs them in a
// requestAnimationFrame loop.
import { easeOutQuart } from '../../../../../lib/motion/curves.js'

// Seconds of the board's loop: a wait at release, then the flight, then a hold on the landed frame.
export const PRE_S = 0.6
export const HOLD_S = 1.1
// Seconds of a camera swing.
export const FLY_S = 0.95

const lerp = (a, b, u) => a + (b - a) * u

// A loop at release. `playing` false gives a paused start.
export const startLoop = (playing) => ({ phase: 'pre', timer: 0, s: 0, prevS: 0, playing, cycled: false })

// The landed frame, paused: what a reader who asked for less motion sees. `s` is Infinity so it is
// the end of any flight; the caller clamps it to the flight's length.
export const landedLoop = () => ({ phase: 'hold', timer: 0, s: Infinity, prevS: Infinity, playing: false, cycled: false })

// One step of `dt` seconds. `end` is the flight's length (s), `speed` the fraction of real time.
// `prevS` is `s` before the step, so a caller can see a pitch land (prevS < T <= s).
// `cycled` is true on the one step where the hold ends and the loop starts again: the caller then
// moves to the next pitch (In order) or leaves the set as it is (Together).
export function stepLoop(L, dt, end, speed) {
  if (!L.playing) return L
  if (L.phase === 'pre') {
    const timer = L.timer + dt
    return timer >= PRE_S
      ? { ...L, phase: 'fly', timer: 0, s: 0, prevS: 0, cycled: false }
      : { ...L, timer, s: 0, prevS: 0, cycled: false }
  }
  if (L.phase === 'fly') {
    const s = Math.min(end, L.s + dt * speed)
    return s >= end
      ? { ...L, phase: 'hold', timer: 0, s, prevS: L.s, cycled: false }
      : { ...L, s, prevS: L.s, cycled: false }
  }
  const timer = L.timer + dt
  return timer >= HOLD_S ? { ...startLoop(true), cycled: true } : { ...L, timer, prevS: L.s, cycled: false }
}

// An angle in (-PI, PI], so a swing takes the short way round.
export function wrapAngle(a) {
  let v = a
  while (v > Math.PI) v -= 2 * Math.PI
  while (v <= -Math.PI) v += 2 * Math.PI
  return v
}

// The view `u` of the way from orbit view `a` to `b` (u in 0..1, already eased).
// A view is { T: [x, h, z] look-at point, yaw, pitch, dist, fov } (flightView.orbitOf).
export function viewAt(a, b, u) {
  return {
    T: a.T.map((v, i) => lerp(v, b.T[i], u)),
    yaw: a.yaw + wrapAngle(b.yaw - a.yaw) * u,
    pitch: lerp(a.pitch, b.pitch, u),
    dist: lerp(a.dist, b.dist, u),
    fov: lerp(a.fov, b.fov, u),
  }
}

// A camera that rests on `view`.
export const stillCam = (view) => ({ view, from: view, to: view, tw: 1 })

// A camera that starts a swing from where it is now to `to`.
export const swingCam = (cam, to) => ({ view: cam.view, from: cam.view, to, tw: 0 })

// One step of a swing: FLY_S seconds on the ease-out-quart curve. At the end the view is `to` exactly.
export function flyStep(cam, dt) {
  if (cam.tw >= 1) return cam
  const tw = Math.min(1, cam.tw + dt / FLY_S)
  return { ...cam, tw, view: tw >= 1 ? cam.to : viewAt(cam.from, cam.to, easeOutQuart(tw)) }
}
