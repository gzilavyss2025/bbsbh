// The Now Pitching card's pitch scene (#1344): a behind-the-plate view of one
// arm's pitches, each drawn as a path from one release point to the plate.
// Pure math, no React, so `npm test` can pin it (test/pitcher-card-model.test.js).
// PitchScene.jsx draws what this returns.
//
// GENERIC SHAPES, NOT HIS. Each pitch type uses the 2026 MLB average movement
// for right-handers, mirrored for a left-hander, at HIS average speed. The end
// spots are typical locations. The card's (i) note says this to the reader.

// Baseball Savant pitch-movement leaderboard, 2026, right-handers, min 50
// pitches, averaged weighted by pitches (pulled 2026-10-01):
// [induced vertical break in, horizontal break in, side]. Side -1 = arm side,
// +1 = glove side. KC uses the CU value (Savant gave no KC rows). KN, EP and SC
// have no row: their tile shows, with no arc. To pull again:
// baseballsavant.mlb.com/leaderboard/pitch-movement?year=2026&min=50&hand=R&pitch_type={code}
//   &x=pitcher_break_x_hand&z=pitcher_break_z_induced&csv=true
export const MOVE = {
  FF: [15.7, 7.8, -1],
  SI: [7.5, 15.1, -1],
  FC: [8.0, 2.6, 1],
  SL: [1.3, 3.8, 1],
  ST: [1.0, 13.5, 1],
  CU: [-10.3, 9.1, 1],
  KC: [-10.3, 9.1, 1],
  SV: [-7.6, 11.0, 1],
  CH: [3.8, 14.2, -1],
  FS: [2.9, 11.3, -1],
}

// Typical end spot at the front of the plate, ft: [x, height]. A design
// choice, not data.
const SPOT = {
  FF: [0, 3.0],
  SI: [-0.45, 2.0],
  FC: [0.35, 2.5],
  SL: [0.55, 1.7],
  ST: [0.85, 2.1],
  CU: [0.25, 1.5],
  KC: [0.25, 1.5],
  SV: [0.55, 1.5],
  CH: [-0.4, 1.6],
  FS: [-0.15, 1.45],
}

export const SCENE_W = 336
export const SCENE_H = 204
// The navy name bar covers the scene's bottom 27 px; no path may go under it.
export const BAR_TOP = 177

// Camera: 6 ft behind the front of the plate, 4 ft high, looking at the mound.
// x = ft right of the plate's centre, y = ft toward the mound from the front of
// the plate, z = ft up. Returns [screen x, screen y, ball diameter px].
const F = 410
const CX = SCENE_W / 2
const CY = 26
export function proj(x, y, z) {
  const d = y + 6
  return [CX + (F * x) / d, CY - (F * (z - 4)) / d, (F * 0.242) / d]
}

const G = 32.17 // ft/s²
const Y0 = 54.2 // release, ft from the front of the plate
const YP = 17 / 12 // front of the plate to its back point
const Z0 = 5.8 // release height
const ARM_X = -1.9 // release side for a right-hander (his arm side, from behind)
const N = 40 // segments per path

// Flight time to the plate, s. 0.92 stands in for drag.
export function flightTime(mph) {
  return (Y0 - YP) / (mph * 1.4667 * 0.92)
}

export function releasePoint(lefty) {
  return proj(ARM_X * (lefty ? -1 : 1), Y0, Z0)
}

// N + 1 projected points from release to the plate: constant acceleration
// chosen so the pitch ends at SPOT and breaks by MOVE over its flight time.
export function arc(code, mph, lefty) {
  const hand = lefty ? -1 : 1
  const X0 = ARM_X * hand
  const [ivb, hb, side] = MOVE[code]
  const [sx, sz] = SPOT[code]
  const vy = mph * 1.4667 * 0.92
  const T = flightTime(mph)
  const ax = (hand * side * 2 * (hb / 12)) / (T * T)
  const az = -G + (2 * (ivb / 12)) / (T * T)
  const vx = (sx * hand - X0 - 0.5 * ax * T * T) / T
  const vz = (sz - Z0 - 0.5 * az * T * T) / T
  return Array.from({ length: N + 1 }, (_, i) => {
    const t = (T * i) / N
    return proj(X0 + vx * t + 0.5 * ax * t * t, Y0 - vy * t, Z0 + vz * t + 0.5 * az * t * t)
  })
}

// The scene's pitches, in the tiles' order (order of use): every tile with a
// shape. "Other" and KN/EP/SC keep their tile and get no arc.
export function scenePitches(tiles, lefty) {
  return tiles
    .filter((t) => !t.other && MOVE[t.code] && t.velo > 0)
    .map((t) => ({ ...t, T: flightTime(t.velo), pts: arc(t.code, t.velo, lefty) }))
}

const SLOW = 3 // slow motion ×3
const HOLD = 0.9 // s at the plate

// Which pitch is in flight and how far along it is, `elapsed` seconds after
// the card mounted. Every pitch gets the same slot (the slowest flight ×3 plus
// the hold), so the rhythm does not change with the speed. `elapsed` null (no
// clock yet, or reduced motion) shows the first pitch at full length.
export function sceneFrame(pitches, elapsed) {
  if (elapsed == null || pitches.length === 0) return { idx: 0, progress: 1 }
  const slot = Math.max(...pitches.map((p) => p.T)) * SLOW + HOLD
  const idx = Math.floor(elapsed / slot) % pitches.length
  return { idx, progress: Math.min(1, (elapsed % slot) / (pitches[idx].T * SLOW)) }
}

// The fixed ground and zone: sky over grass at the horizon, the mound, the
// plate dirt, and the zone as a box between the front (y = 17/12) and back
// (y = 0) of the plate. Each face is { x, y, w, h }.
export function stage() {
  const face = (y) => {
    const a = proj(-17 / 24, y, 3.5)
    const b = proj(17 / 24, y, 1.6)
    return { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1] }
  }
  const mound = proj(0, 60.5, 0.83)
  return {
    horizon: proj(0, 1e6, 4)[1],
    mound: { y: mound[1], rx: proj(9, 60.5, 0.83)[0] - mound[0] },
    dirtCy: proj(0, 13 + 17 / 12, 0)[1] + 180,
    front: face(17 / 12),
    back: face(0),
  }
}
