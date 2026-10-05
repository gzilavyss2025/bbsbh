// The Now Pitching card's pitch scene (#1344): a behind-the-plate view of one
// arm's pitches, each drawn as a path from one release point to the plate.
// Pure math, no React, so `npm test` can pin it (test/pitcher-card-model.test.js).
// PitchScene.jsx draws what this returns.
//
// TWO VIEWS (#1490, ADR-0099). The card draws from behind the plate only. The
// Matchup Scout also draws its Pitcher's view, through the centre-field camera
// in camera.js; every function here that projects takes `view`, and 'hitter'
// (the default) is the card's own picture, byte for byte.
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

import { camera } from './camera.js'

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

// The projector for a view: the card's own `proj` for 'hitter', so the Now
// Pitching card cannot drift; the centre-field camera for 'pitcher'.
const PITCHER_CAM = camera('pitcher')
export const projFor = (view) => (view === 'pitcher' ? PITCHER_CAM : proj)

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

export function releasePoint(lefty, view = 'hitter') {
  return projFor(view)(ARM_X * (lefty ? -1 : 1), Y0, Z0)
}

// N + 1 projected points from release to the plate: constant acceleration
// chosen so the pitch ends at SPOT and breaks by MOVE over its flight time.
export function arc(code, mph, lefty, view = 'hitter') {
  const P = projFor(view)
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
    return P(X0 + vx * t + 0.5 * ax * t * t, Y0 - vy * t, Z0 + vz * t + 0.5 * az * t * t)
  })
}

// The scene's pitches, in the tiles' order (order of use): every tile with a
// shape. "Other" and KN/EP/SC keep their tile and get no arc.
export function scenePitches(tiles, lefty, view = 'hitter') {
  return tiles
    .filter((t) => !t.other && MOVE[t.code] && t.velo > 0)
    .map((t) => ({ ...t, T: flightTime(t.velo), pts: arc(t.code, t.velo, lefty, view) }))
}

// ONE REAL PITCH for the scene (the Scout's pitch modal): `flight` is
// camera.js realFlight, `t` the label fields { code, name, mph, family }.
// Same shape as a scenePitches entry, so PitchScene draws it unchanged.
export function realScenePitch(flight, t, view = 'hitter') {
  if (!flight) return null
  const P = projFor(view)
  return { ...t, T: flight.T, pts: Array.from({ length: N + 1 }, (_, i) => P(...flight.at(i / N))) }
}

export const SLOW = 3 // slow motion ×3
const HOLD = 0.9 // s at the plate

// Which pitch is in flight and how far along it is, `elapsed` seconds after
// the card mounted. Every pitch gets the same slot (the slowest flight ×3 plus
// the hold), so the rhythm does not change with the speed. `elapsed` null (no
// clock yet, or reduced motion) shows the first pitch at full length. `slow`
// is the slow-motion factor: 1 is real speed (the Scout's pitch modal).
export function sceneFrame(pitches, elapsed, slow = SLOW) {
  if (elapsed == null || pitches.length === 0) return { idx: 0, progress: 1 }
  const slot = Math.max(...pitches.map((p) => p.T)) * slow + HOLD
  const idx = Math.floor(elapsed / slot) % pitches.length
  return { idx, progress: Math.min(1, (elapsed % slot) / (pitches[idx].T * slow)) }
}

// The fixed ground and zone: sky over grass at the horizon, the mound, the
// plate dirt, and the zone as a box between the front (y = 17/12) and back
// (y = 0) of the plate. Each face is { x, y, w, h }. `zone` is [bottom, top]
// in ft; the card's nominal zone by default.
export function stage(zone = [1.6, 3.5]) {
  const [bot, top] = zone
  const face = (y) => {
    const a = proj(-17 / 24, y, top)
    const b = proj(17 / 24, y, bot)
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

// THE PITCHER'S-VIEW STAGE (the Scout, ADR-0099): the same parts as the card's
// stage, seen from centre field. The plate dirt (a 13-ft circle), both
// batter's boxes, the plate and the zone box are PROJECTED, so they sit where
// the pitches cross. The mound is PLACED: a fixed ellipse at the foot of the
// frame with the rubber on it. No honest camera shows the mound and a
// readable zone at once in this frame, so the zone camera is honest and the
// mound is there for orientation. Every shape is a list of [x, y] points.
const ring = (cx, cy, r, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)])
export function pitcherStage(zone = [1.6, 3.5]) {
  const P = projFor('pitcher')
  const flat = (pts) => pts.map(([x, y, z = 0]) => P(x, y, z).slice(0, 2))
  const [bot, top] = zone
  const X = 17 / 24
  const face = (y) => flat([[-X, y, top], [X, y, top], [X, y, bot], [-X, y, bot]])
  const front = face(YP)
  const back = face(0)
  const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
  // The 3x3 grid on the front face: two lines each way, between its edges.
  const [tl, tr, br, bl] = front
  const grid = [1, 2].flatMap((k) => [
    [lerp(tl, tr, k / 3), lerp(bl, br, k / 3)],
    [lerp(tl, bl, k / 3), lerp(tr, br, k / 3)],
  ])
  return {
    dirt: flat(ring(0, 0.7, 13).map(([x, y]) => [x, y, 0])),
    boxes: [-1, 1].map((sx) => flat([[sx * 1.2, 3], [sx * 3.2, 3], [sx * 3.2, -3], [sx * 1.2, -3]])),
    plate: flat([[-X, YP], [X, YP], [X, X], [0, 0], [-X, X]]),
    front,
    back,
    edges: front.map((p, i) => [p, back[i]]),
    grid,
    mound: { cx: SCENE_W / 2, cy: SCENE_H - 26 + 24, rx: 190, ry: 40 },
    rubber: { x: SCENE_W / 2 - 20, y: SCENE_H - 35, w: 40, h: 3 },
  }
}
