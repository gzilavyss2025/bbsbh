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

// The real flight of one tracked pitch lives in lib/pitch/pitchFlight.js (#2602),
// so the Gameday stage can import it without these cameras. Re-exported here
// so every importer of camera.js keeps working.
export { PLATE_FRONT, realFlight } from '../pitch/pitchFlight.js'

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
