// The batted ball's path for Gameday's chase camera (#2603, data half of #2569):
// which tier of ball data a play has, and a time-stamped path from the bat to
// where the feed puts the ball. Pure: no React, no clock, no drawing, no DOM.
//
// SPOILER FOOTING. The input is one play's `hitData`, a result (a ball in the
// seats is a home run), so a caller passes only a REVEALED ball, from inside a
// SealBox reveal render function (ADR-0001, ADR-0002). This module reads no feed
// itself, which is why it lives in src/lib/ and not src/api/gameday/.
//
// THE TIERS (#2569):
//   A  'measured'  exit velocity, launch angle, distance and the landing
//                  coordinate: the path is fitted to the measured launch.
//   B  'drawn'     a trajectory class and the landing coordinate, no exit
//                  velocity or launch angle (AA, High-A, most Single-A): the
//                  path is fitted to the class's typical launch (TYPICAL_LAUNCH).
//   C  null        no landing coordinate, or no class to assume from: no path.
// Even tier A is modeled between the bat and the landing; only its two ends
// are measured (docs/contact-replay.md, "ink and pencil").
//
// WHERE IT LANDS. Every path ends exactly on the hit coordinate, the point the
// field drawing plots: its bearing from ballBearing and its distance from
// HIT_COORD_FT_PER_UNIT. Not on `totalDistance`. Measured 2026-10-26 over 134
// MLB games (.scratch/gameday-engine/measure-moments.mjs): totalDistance over
// the coordinate's distance has a median of 1.00 for fly balls (p10 0.98, p90
// 1.02) but 0.13 for ground balls, whose coordinate is where the ball was
// FIELDED (ADR-0051), not where it first touched down.
//
// THE PHYSICS is ../ballpark/flightModel.js's flightModel: a ball in the air is
// fitted (simFlight, fitLift), anything else hops along the ground. Its ground
// share runs 0 to 1, so the last point is the coordinate by construction even
// when the fit clamps.

import { flightModel } from '../ballpark/flightModel.js'
import { ballBearing } from '../ballpark/ballFlight.js'
import { hitCoordToSvg, HIT_COORD_ORIGIN, HIT_COORD_FT_PER_UNIT } from '../ballpark/hitProjection.js'

// The median launch of each trajectory class, from the same 134-game sample:
//   class          n      median EV  median LA
//   fly_ball       1,873  93.0       36
//   line_drive     1,670  95.6       16
//   ground_ball    2,807  88.3       -8
//   popup          465    79.0       67
//   bunt_grounder  71     31.0       -35
//   bunt_popup     7      28.6       67
export const TYPICAL_LAUNCH = {
  fly_ball: { exitVelo: 93, launchAngle: 36 },
  line_drive: { exitVelo: 95.6, launchAngle: 16 },
  ground_ball: { exitVelo: 88.3, launchAngle: -8 },
  popup: { exitVelo: 79, launchAngle: 67 },
  bunt_grounder: { exitVelo: 31, launchAngle: -35 },
  bunt_popup: { exitVelo: 28.6, launchAngle: 67 },
}

const num = (v) => typeof v === 'number' && Number.isFinite(v)

// The landing in feet from home plate: `distance` along the ground and
// `bearing` in degrees off straightaway center (negative toward left field).
function landingOf(hitData) {
  const x = hitData?.coordinates?.coordX
  const y = hitData?.coordinates?.coordY
  if (!num(x) || !num(y)) return null
  const svg = hitCoordToSvg(x, y)
  const distance = Math.hypot(x - HIT_COORD_ORIGIN.x, HIT_COORD_ORIGIN.y - y) * HIT_COORD_FT_PER_UNIT
  return { distance, bearing: ballBearing(svg) }
}

// 'A', 'B' or 'C' for one revealed ball, with its data tag.
export function ballTier(hitData) {
  if (!landingOf(hitData)) return { tier: 'C', tag: null }
  if (num(hitData.launchSpeed) && num(hitData.launchAngle) && num(hitData.totalDistance)) {
    return { tier: 'A', tag: 'measured' }
  }
  if (TYPICAL_LAUNCH[hitData.trajectory]) return { tier: 'B', tag: 'drawn' }
  return { tier: 'C', tag: null }
}

// The path, or null for tier C: { tier, tag, T, distance, bearing, points },
// where `points` are { t (s), x, y, z } in feet from home plate (x toward right
// field, y toward center field, z up), evenly spaced in time from contact to
// the landing. `location` (the fielder or gap code) is passed through as a
// label; the coordinate decides the path.
export function flightPath(hitData) {
  const { tier, tag } = ballTier(hitData)
  if (tier === 'C') return null
  const { distance, bearing } = landingOf(hitData)
  const launch = tier === 'A'
    ? { exitVelo: hitData.launchSpeed, launchAngle: hitData.launchAngle }
    : TYPICAL_LAUNCH[hitData.trajectory]
  const model = flightModel({ ...launch, distance }, distance)
  const rad = (bearing * Math.PI) / 180
  const points = model.sf.map((share, i) => {
    const ground = share * distance
    return {
      t: (model.T * i) / (model.sf.length - 1),
      x: ground * Math.sin(rad),
      y: ground * Math.cos(rad),
      z: model.sz[i],
    }
  })
  return {
    tier,
    tag,
    T: model.T,
    distance,
    bearing,
    trajectory: hitData.trajectory ?? null,
    location: hitData.location ?? null,
    points,
  }
}
