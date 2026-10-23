// The real flight of one tracked pitch: pure math over Savant's fields, no
// React, no drawing, no feed reads. Lifted out of pitcherCard/camera.js (#2602)
// so the Gameday stage can import the physics without the old cameras, the
// same way hitProjection.js was lifted out of hitchart.js. camera.js re-exports
// both names, so the Now Pitching card, the Scout modal and atBat.js are
// unchanged; test/pitch-flight.test.js pins it, test/scout-scene.test.js pins
// the re-export.
//
// FEET, Statcast's frame: x = right of the plate's centre as the catcher sees
// it (first-base side +x), y = toward the mound from the plate's back point
// (the front edge is at y = 17/12), z = up.

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
