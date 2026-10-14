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

// The reader's own turn of the camera (the board's rotate): radians a pixel of drag, radians a key press,
// and the pitch limits — just above the ground to just short of straight down.
export const DRAG_YAW = 0.0085
export const DRAG_PITCH = 0.006
export const PITCH_MIN = 0.02
export const PITCH_MAX = 1.53
export const KEY_TURN = { ArrowLeft: [0.08, 0], ArrowRight: [-0.08, 0], ArrowUp: [0, -0.06], ArrowDown: [0, 0.06] }

// A drag of dx, dy pixels as [yaw, pitch] radians: drag right turns the scene right.
export const dragTurn = (dx, dy) => [-dx * DRAG_YAW, dy * DRAG_PITCH]

// The camera turned by yaw and pitch radians. A turn ends a swing where it is.
export function turnView(cam, yaw, pitch) {
  const v = cam.view
  const view = { ...v, yaw: v.yaw + yaw, pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, v.pitch + pitch)) }
  return { view, from: view, to: view, tw: 1 }
}

// Play or pause. `cycled` is cleared: a loop paused on the step where the hold ended must not fire onCycle again.
export const setPlayingLoop = (L, playing) => ({ ...L, playing, cycled: false })

// A scrub to `s` seconds: the loop pauses in the flight.
export const seekLoop = (L, s) => ({ ...L, phase: 'fly', timer: 0, s, prevS: s, playing: false, cycled: false })

// Whether the frame loop has work: the stage is on screen and the loop plays or a camera swings.
export const needsFrame = (visible, L, cam) => visible && (L.playing || cam.tw < 1)
