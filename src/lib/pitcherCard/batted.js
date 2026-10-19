// The batted ball of the contact replay (docs/contact-replay.md §6.4, §7.1, §10).
// Pure math, no React. Ported from .scratch/contact-replay/prototype.html
// `battedFlight`, `groundRoll` and `sampleAt`. The path is measured (exit speed,
// angle, distance, spray); the foul is a drawing.
import { flightModel } from '../ballpark/flightModel.js'
import { HIT_COORD_FT_PER_UNIT, HIT_COORD_ORIGIN } from '../ballpark/hitProjection.js'
import { SCENE_W, proj } from './scene.js'

const G = 32.174
const MAX_EXIT = 0.9 // s of real time the ball is followed in the scene, at most
const NO_DISTANCE = 150 // ft drawn when the feed has neither a distance nor coordinates
const FOUL_MPH = 72 // the drawn foul's speed

// A ball hit under 40 mph is a bunt: the bat is held still, with no swing (§10).
export const isBunt = (hit) => hit?.exitVelo != null && hit.exitVelo < 40

// A grounder: the ball bounces along the ground (restitution 0.3 to 0.42, 0.86 friction a bounce).
function groundRoll(ev, la, dist, z0) {
  const dt = 0.01
  const a = (la * Math.PI) / 180
  let x = 0, z = z0, vx = ev * 1.4667 * Math.cos(a), vz = ev * 1.4667 * Math.sin(a), t = 0
  const pts = [[0, z0, t]]
  while (x < dist && t < 6) {
    vz -= G * dt
    vx *= 0.9985
    x += vx * dt
    z += vz * dt
    t += dt
    if (z < 0) {
      z = -z * 0.3
      vz = -vz * 0.42
      vx *= 0.86
    }
    pts.push([x, z, t])
  }
  return { T: t, pts }
}

// [x along the ground, z up] on a point list [x, z, t] at time t, by linear interpolation.
function sampleAt(pts, T, t) {
  if (t <= 0) return pts[0].slice(0, 2)
  if (t >= T) return pts[pts.length - 1].slice(0, 2)
  let i = 0
  while (i < pts.length - 2 && pts[i + 1][2] < t) i++
  const [a, b] = [pts[i], pts[i + 1]]
  const k = (t - a[2]) / (b[2] - a[2] || 1)
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
}

// The 2-D flight from z0 ft up: { T, at(t) = [ground ft, height ft], apex } with `apex` the
// top of an air flight, [ground ft, height ft], null for a grounder or a ball with no launch angle.
function fit(hit, z0) {
  const { exitVelo: ev, launchAngle: la, coordX, coordY } = hit
  const chord = coordX == null || coordY == null ? 0 : Math.hypot(coordX - HIT_COORD_ORIGIN.x, HIT_COORD_ORIGIN.y - coordY) * HIT_COORD_FT_PER_UNIT
  const dist = hit.distance || chord || NO_DISTANCE // ponytail: a bare ball (no distance, no coordinates) is drawn at 150 ft
  if (la != null && la >= 8) {
    const f = flightModel({ exitVelo: ev, launchAngle: la, distance: dist }, chord, z0)
    const n = f.sf.length - 1
    const at = (t) => {
      const x = Math.min(Math.max((t / f.T) * n, 0), n)
      const i = Math.min(Math.floor(x), n - 1)
      const k = x - i
      return [(f.sf[i] + (f.sf[i + 1] - f.sf[i]) * k) * dist, f.sz[i] + (f.sz[i + 1] - f.sz[i]) * k]
    }
    const top = f.sz.indexOf(Math.max(...f.sz))
    return { T: f.T, at, apex: [f.sf[top] * dist, f.sz[top]] }
  }
  const r = groundRoll(ev, la ?? 0, dist, z0) // a missing angle is drawn as a grounder
  return { T: r.T, at: (t) => sampleAt(r.pts, r.T, t), apex: null }
}

// Real seconds until the ball leaves the scene: out of the frame, under 1.3 px wide, or MAX_EXIT.
function exitOf(pos) {
  let t = 0
  for (; t < MAX_EXIT; t += 0.005) {
    const p = pos(t)
    const [sx, sy, d] = proj(...p)
    if (sy < -6 || sx < -6 || sx > SCENE_W + 6 || d < 1.3 || p[1] < -5.6) break // -5.6: just ahead of the camera
  }
  return Math.min(t, MAX_EXIT)
}

// The ball in play, in scene feet (the pitch's frame, camera.js): pos(t) is t seconds after contact at K.
// `T` is the hang time, `exitSec` how long the scene follows it. Null with no exit speed.
export function battedPath(hit, K) {
  if (hit?.exitVelo == null) return null
  const { T, at } = fit(hit, K[2])
  // spray in degrees, positive toward right field (§3.1); no coordinates: straight out, drawn
  const spray = hit.coordX == null || hit.coordY == null ? 0 : Math.atan2(hit.coordX - HIT_COORD_ORIGIN.x, HIT_COORD_ORIGIN.y - hit.coordY)
  const pos = (t) => {
    const [x, z] = at(t)
    return [K[0] + Math.sin(spray) * x, K[1] + Math.cos(spray) * x, z]
  }
  return { pos, T, exitSec: exitOf(pos) }
}

// The drawn foul: back over the camera and up at 72 mph. No flight model; it is pencil.
export function foulPath(K, batSide) {
  const side = batSide === 'R' ? -1 : 1
  const d = [-side * 0.25, -0.55, 0.8]
  const s = (FOUL_MPH * 1.4667) / Math.hypot(...d)
  const pos = (t) => [K[0] + d[0] * s * t, K[1] + d[1] * s * t, K[2] + d[2] * s * t - 0.5 * G * t * t]
  return { pos, exitSec: exitOf(pos) }
}

// The side view's scale (§7.1): 0 to 450 ft along the ground, the same scale up, from a baseline at y = 80.
export const SIDE_X = (ft) => 16 + (ft * 304) / 450
const SIDE_Y = (ft) => 80 - (ft * 304) / 450

// The same flight in the 336 x 100 strip: pos(t) = [x, y] in strip units, `apex` = { x, y, ft }
// or null (a grounder, or no launch angle). Null with no exit speed.
export function sideViewPath(hit) {
  if (hit?.exitVelo == null) return null
  const { T, at, apex } = fit(hit, 3)
  const pos = (t) => ((p) => [SIDE_X(p[0]), SIDE_Y(p[1])])(at(t))
  return { T, pos, apex: apex && { x: SIDE_X(apex[0]), y: SIDE_Y(apex[1]), ft: apex[1] } }
}
