// The Pitch flight views (#1892): one pitch type's average path from release, movement and flight time,
// the camera that draws it, and the gaps between paths. Pure; no feed, no clock.
//
// Frame, as the Claude Design board PitchFlight.dc.html has it: x is the catcher's right (a left-hander's
// arm side, the feed's own sign for x0 and pfxX), h is height, z is feet from the back tip of the plate
// toward the mound. All lengths are feet, flight time is seconds, movement is inches.
//
// The feed's pfxX and pfxZ are PITCHf/x values: the break over the LAST 40 ft only. This flight runs from the
// release, and a break grows as the square of the time, so the movement over the whole flight is the stored
// value times (distance flown / 40)^2, taking the time over a stretch as its length (distance, not drag).
// Checked on four live four-seamers (gamePk 823035): pfxZ 7.9 / 8.5 / 7.4 / 9.4 scale to 13.5 / 14.5 / 12.6 / 16.0 in,
// against Statcast's breakVerticalInduced 13.6 / 14.5 / 12.6 / 16.0. Upgrade: store the induced break in the arsenal store.
//
// ponytail: this is an average path, not a tracked one. The feed's x0/z0 sit at 50 ft and drag slows the
// ball, so the real path is a little curved in z and the speed falls by about 8%. Here z falls evenly with
// time and the vertical and side bend is the feed's pfx at the plate. Upgrade only if a per-pitch store holds vx0/ax.
import { GRID } from '../../../../../lib/zone/zoneGeometry.js'

export const G = 32.174
export const PLATE_Z = 1.417 // the front of the plate; the plate crosses here
export const RUBBER_Z = 60.5
export const ZONE = { x: 0.708, y0: 1.63, y1: 3.22 }
export const ZD = PLATE_Z + 23.8 // about 175 ms before the plate: where a hitter must commit

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, u) => a + (b - a) * u
const INPUTS = ['x0', 'z0', 'pfxX', 'pfxZ', 'extension', 'plateTime']

// A command-grid cell (the stored feed frame, row 0 on top, may be fractional: the pitch-weighted
// centroid of a pitch type) to feet. The middle three columns and rows are the zone's thirds, the
// outer ring one third wide beyond them, so the maths extends past 1..3 (zoneGeometry.commandCell).
export function markFeet(cell) {
  if (!cell) return null
  const zn = (GRID - 1 - cell.row - 0.5) / 3
  return { x: (-1 + ((cell.col - 0.5) * 2) / 3) * ZONE.x, h: ZONE.y0 + zn * (ZONE.y1 - ZONE.y0) }
}

// One pitch type's path, or null when a flight input or the landing mark is missing: a path that lands
// nowhere known is not drawn. `phys` is physOf(type); `landing` is { x, h } in feet (markFeet).
export function flightPath(phys, landing) {
  if (!phys || !landing || INPUTS.some((k) => phys[k] == null)) return null
  const { x0, z0, extension, plateTime: T } = phys
  const end = landing
  const zRel = RUBBER_Z - extension
  const full = ((zRel - PLATE_Z) / 40) ** 2
  const pfxX = phys.pfxX * full // inches over the whole flight
  const pfxZ = phys.pfxZ * full
  const sag = 0.5 * G * T * T // feet gravity alone drops it over the flight
  // The gravity-only path ends where the movement did not take it; the real path adds the movement on top, as a square of time.
  const freeX = end.x - pfxX / 12
  const freeH = end.h - pfxZ / 12
  const at = (s, real) => {
    const u = clamp(s / T)
    const bend = real ? u * u : 0
    return [
      lerp(x0, freeX, u) + (pfxX / 12) * bend,
      lerp(z0, freeH, u) + sag * (u - u * u) + (pfxZ / 12) * bend,
      lerp(zRel, PLATE_Z, u),
    ]
  }
  return {
    T,
    lift: pfxZ,
    side: pfxX,
    fall: sag * 12,
    tD: ((zRel - ZD) / (zRel - PLATE_Z)) * T,
    at: (s) => at(s, true),
    grav: (s) => at(s, false),
  }
}

// Which way a side break goes: +x for a left-hander is toward his arm side. With no hand on file the side is
// named by the base instead (the catcher's right is first base).
export function towardOf(side, throws) {
  const arm = throws === 'L' ? 1 : throws === 'R' ? -1 : 0
  if (!arm) return side > 0 ? 'the first-base side' : 'the third-base side'
  return side * arm > 0 ? 'his arm side' : 'his glove side'
}

// "Falls a little less than gravity alone; moves 5 in toward his arm side."
export function verdictOf({ lift, side }, throws) {
  const rise =
    lift >= 18 ? 'Rides high'
    : lift >= 8 ? 'Falls a little less than gravity alone'
    : lift > -8 ? 'Falls about as fast as gravity alone'
    : 'Drops more than gravity alone'
  return `${rise}; ${Math.abs(side) < 5 ? 'barely moves sideways' : `moves ${Math.round(Math.abs(side))} in toward ${towardOf(side, throws)}`}.`
}

// How far apart the paths are, in inches, at release, 23.8 ft out and at the plate (largest pair), and the
// closest and widest pair at 23.8 ft. `items` are { code, path }; null under two paths.
export function tunnelView(items) {
  const paths = items.filter((i) => i.path)
  if (paths.length < 2) return null
  const gap = (a, b, s) => {
    const p = a.path.at(s(a.path))
    const q = b.path.at(s(b.path))
    return Math.hypot(p[0] - q[0], p[1] - q[1]) * 12
  }
  const at = { release: () => 0, out: (p) => p.tD, plate: (p) => p.T }
  const pairs = []
  const widest = { release: 0, out: 0, plate: 0 }
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const g = Object.fromEntries(Object.entries(at).map(([k, s]) => [k, gap(paths[i], paths[j], s)]))
      for (const k of Object.keys(g)) widest[k] = Math.max(widest[k], g[k])
      pairs.push({ names: `${paths[i].code} · ${paths[j].code}`, ...g })
    }
  }
  pairs.sort((a, b) => a.out - b.out)
  return { ...widest, closest: pairs[0], widest: pairs.at(-1) }
}

// The drop curve as a 64 x 28 sparkline path, an inch a pixel about the line at 14, shrunk to fit a big arch.
export function sparkD(path) {
  const v = dropCurve(path).map((d) => d * 12)
  const peak = Math.max(...v.map(Math.abs))
  const k = peak > 12 ? 12 / peak : 1
  return v.map((d, i) => `${i ? 'L' : 'M'}${(2 + (60 * i) / (v.length - 1)).toFixed(1)} ${(14 - d * k).toFixed(1)}`).join('')
}

// Height of the path above a straight line from release to landing, sampled n+1 times: the drop sparkline.
export function dropCurve(path, n = 16) {
  const a = path.at(0)
  const b = path.at(path.T)
  return Array.from({ length: n + 1 }, (_, i) => path.at((path.T * i) / n)[1] - lerp(a[1], b[1], i / n))
}

// --- the camera: a pinhole at a pose, looking at a point (the board's own presets) ------------------
const POSES = {
  catcher: { pos: [0.2, 3.7, -9.5], tgt: [0.3, 2.2, 30], fov: 27 },
  mound: { pos: [0.8, 6.4, 66], tgt: [0, 2.4, 1], fov: 13 },
  side: { pos: [-72, 6, 28.5], tgt: [0, 6, 28.5], fov: 44 },
  park: { pos: [-46, 34, -30], tgt: [0, 0, 40], fov: 46 },
}
export const CAMERAS = [['catcher', 'Catcher'], ['mound', 'Mound'], ['side', 'Side'], ['park', 'Park']]
const NEAR = 0.25

export function makeCamera(name, W, H) {
  // The Arsenal card's side view is flat, as the board draws it: distance across (the plate on the right),
  // height up, the height stretched so the paths visibly split.
  if (name === 'flat') return { flat: true, W, H, ox: W * 0.881, sx: W * 0.01396, oy: H * 0.922, sy: H * 0.119 }
  const { pos, tgt, fov } = POSES[name] ?? POSES.catcher
  const norm = (v) => v.map((c) => c / Math.hypot(...v))
  const f = norm(tgt.map((t, i) => t - pos[i]))
  const r = norm([f[2], 0, -f[0]])
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]]
  return { pos, f, r, u, W, H, k: H / 2 / Math.tan((fov * Math.PI) / 360) }
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const toCam = (cam, q) => {
  const d = q.map((c, i) => c - cam.pos[i])
  return [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)]
}
const toScreen = (cam, c) => [cam.W / 2 + (c[0] / c[2]) * cam.k, cam.H / 2 - (c[1] / c[2]) * cam.k]

// A point on the screen, with k = pixels per foot at its depth; null behind the lens.
export function project(cam, q) {
  if (cam.flat) return { x: cam.ox - cam.sx * (q[2] - PLATE_Z), y: cam.oy - cam.sy * q[1], k: cam.sx }
  const c = toCam(cam, q)
  if (c[2] < NEAR) return null
  const [x, y] = toScreen(cam, c)
  return { x, y, k: cam.k / c[2] }
}

const r1 = (v) => Math.round(v * 10) / 10
// One segment as an SVG path, clipped at the lens; '' when it is wholly behind it.
export function lineD(cam, a, b) {
  if (cam.flat) {
    const [p, q] = [project(cam, a), project(cam, b)]
    return `M${r1(p.x)} ${r1(p.y)}L${r1(q.x)} ${r1(q.y)}`
  }
  let ca = toCam(cam, a)
  let cb = toCam(cam, b)
  if (ca[2] < NEAR && cb[2] < NEAR) return ''
  const cut = (p, q) => p.map((v, i) => lerp(v, q[i], (NEAR - p[2]) / (q[2] - p[2])))
  if (ca[2] < NEAR) ca = cut(ca, cb)
  else if (cb[2] < NEAR) cb = cut(cb, ca)
  const [x1, y1] = toScreen(cam, ca)
  const [x2, y2] = toScreen(cam, cb)
  return `M${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}`
}
const polyD = (cam, pts) => pts.map((p, i) => lineD(cam, p, pts[(i + 1) % pts.length])).join('')

// A path (`at` is path.at or path.grav) from release up to `s` seconds, n steps.
export function trailD(cam, at, s, n = 24) {
  let d = ''
  let prev = at(0)
  for (let i = 1; i <= n; i++) {
    const cur = at((s * i) / n)
    d += lineD(cam, prev, cur)
    prev = cur
  }
  return d
}

// The park the ball flies through: a 10 ft grid, the plate, the zone, the rubber and the mound ring.
export function sceneD(cam) {
  const seg = (a, b) => lineD(cam, a, b)
  let grid = ''
  for (let z = -10; z <= 70; z += 10) grid += seg([-80, 0, z], [80, 0, z])
  for (let x = -80; x <= 80; x += 10) grid += seg([x, 0, -13], [x, 0, 72])
  const { x, y0, y1 } = ZONE
  return {
    grid,
    plate: polyD(cam, [[-x, 0, PLATE_Z], [x, 0, PLATE_Z], [x, 0, x], [0, 0, 0], [-x, 0, x]]),
    zone: polyD(cam, [[-x, y0, PLATE_Z], [x, y0, PLATE_Z], [x, y1, PLATE_Z], [-x, y1, PLATE_Z]]),
    rubber: polyD(cam, [[-1, 0, 60.25], [1, 0, 60.25], [1, 0, 60.75], [-1, 0, 60.75]]),
    mound: polyD(cam, Array.from({ length: 40 }, (_, i) => [9 * Math.cos((i / 40) * 2 * Math.PI), 0, 60.5 + 9 * Math.sin((i / 40) * 2 * Math.PI)])),
  }
}
