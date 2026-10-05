// The pitch scene's two cameras and the real flight of one tracked pitch
// (#1490). Pure math, no React; test/scout-scene.test.js pins it.
//
// FEET, Statcast's frame: x = right of the plate's centre as the catcher sees
// it (first-base side +x), y = toward the mound from the plate's back point
// (the front edge is at y = 17/12), z = up.
//
// A camera is a pinhole: position C, aimed at T, focal length F px, principal
// point (cx, cy) in the 336 x 204 scene. Frame: f = norm(T - C); right
// r = norm(f.y, -f.x, 0); up u = r x f. A point p projects to
// [cx + F(v.r)/d, cy - F(v.u)/d, ball diameter px] with v = p - C, d = v.f.
//
//   hitter   The Now Pitching card's camera (scene.js `proj`): 6 ft behind the
//            plate, 4 ft up, looking at the mound. +x is on the viewer's right.
//   pitcher  A centre-field telecast camera, high and far with a long lens,
//            aimed at the zone. +x lands on the viewer's LEFT, the same side
//            the Scout's Pitcher's-view maps draw it (ADR-0093, ADR-0099).
const BALL_FT = 0.242

const CAMERAS = {
  hitter: { C: [0, -6, 4], T: [0, 60, 4], F: 410, cx: 168, cy: 26 },
  pitcher: { C: [0, 420, 16], T: [0, 0, 2.6], F: 9000, cx: 168, cy: 82 },
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a) => {
  const l = Math.hypot(...a)
  return [a[0] / l, a[1] / l, a[2] / l]
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

// The projector for one view: (x, y, z) ft -> [screen x, screen y, ball px].
export function camera(view) {
  const { C, T, F, cx, cy } = CAMERAS[view] ?? CAMERAS.hitter
  const f = norm(sub(T, C))
  const r = norm([f[1], -f[0], 0])
  const u = cross(r, f)
  return (x, y, z) => {
    const v = sub([x, y, z], C)
    const d = dot(v, f)
    return [cx + (F * dot(v, r)) / d, cy - (F * dot(v, u)) / d, (F * BALL_FT) / d]
  }
}

export const PLATE_FRONT = 17 / 12

// THE REAL FLIGHT of one Savant pitch row (headToHead.js `pitchOf`). Savant
// gives velocity (vx0, vy0, vz0) and acceleration (ax, ay, az) at y = 50 ft.
// Solve y(t) = 50 + vy0 t + ay t^2 / 2 for the plate (y = 17/12) and for
// release (y = release[1]); back the start out from plate_x / plate_z, so the
// path ends exactly where Savant put the pitch. Null when a field is missing.
// Returns { T: flight seconds, at(u): [x, y, z] for u in [0, 1] }.
export function realFlight(p) {
  const need = [p?.vx0, p?.vy0, p?.vz0, p?.ax, p?.ay, p?.az, p?.px, p?.pz, p?.release?.[1]]
  if (need.some((v) => typeof v !== 'number' || !Number.isFinite(v))) return null
  const a = 0.5 * p.ay
  const b = p.vy0
  const root = (y) => {
    const c = 50 - y
    const disc = b * b - 4 * a * c
    if (disc < 0) return null
    return a === 0 ? -c / b : (-b - Math.sqrt(disc)) / (2 * a)
  }
  const tp = root(PLATE_FRONT)
  const tr = root(p.release[1])
  if (tp == null || tr == null || !(tp > tr)) return null
  const x0 = p.px - p.vx0 * tp - 0.5 * p.ax * tp * tp
  const z0 = p.pz - p.vz0 * tp - 0.5 * p.az * tp * tp
  const pos = (t) => [x0 + p.vx0 * t + 0.5 * p.ax * t * t, 50 + p.vy0 * t + 0.5 * p.ay * t * t, z0 + p.vz0 * t + 0.5 * p.az * t * t]
  return { T: tp - tr, at: (u) => pos(tr + u * (tp - tr)) }
}
