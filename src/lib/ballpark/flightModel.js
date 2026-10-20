// The Contact card's ball-flight model, moved out of the card (#1771) so the replay can reuse it.
// Pure: no React, no clock. `h0` is the start height in ft (3 = today's fixed value).

const K = 40 // samples per flight

// One flight from h0 ft up (3 = the bat): x along the ground and z up, in feet, every 10ms, until it lands.
// `cd` is the drag coefficient: 0.35 is the replay's; the side view passes its own (ballFlight.js).
export function simFlight(ev, la, lift, h0 = 3, cd = 0.35) {
  const G = 32.174, RHO = 0.002284, A = 0.04585, MS = 0.009955, dt = 0.01
  const v0 = ev * 1.46667
  const a = (la * Math.PI) / 180
  let x = 0, z = h0, vx = v0 * Math.cos(a), vz = v0 * Math.sin(a), t = 0
  const kd = (0.5 * RHO * A * cd) / MS
  const kl = (0.5 * RHO * A * lift) / MS
  const pts = [[0, h0, 0]]
  while (t < 14) {
    const v = Math.hypot(vx, vz)
    vx += (-kd * v * vx - kl * v * vz) * dt
    vz += (-G - kd * v * vz + kl * v * vx) * dt
    x += vx * dt; z += vz * dt; t += dt
    pts.push([x, z, t])
    if (z <= 0 && t > 0.2) {
      const p = pts[pts.length - 2]
      const f = p[1] / (p[1] - z)
      return { dist: p[0] + (x - p[0]) * f, T: p[2] + dt * f, pts }
    }
  }
  return { dist: x, T: t, pts }
}

// The lift that lands the sim at `dist` ft, bisected within [lo, hi] and clamped to
// the nearer end when the range cannot reach it, with the flight it gives (the same
// h0 and cd, so a caller cannot fly it again with different ones). Shared by the
// replay (below) and the side view (ballFlight.js), which passes its own drag and range.
export function fitLift(ev, la, dist, { h0 = 3, cd = 0.35, lo = 0, hi = 0.45, iters = 18 } = {}) {
  const low = simFlight(ev, la, lo, h0, cd)
  if (dist <= low.dist) return { lift: lo, flight: low }
  const high = simFlight(ev, la, hi, h0, cd)
  if (dist >= high.dist) return { lift: hi, flight: high }
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2
    if (simFlight(ev, la, mid, h0, cd).dist < dist) lo = mid
    else hi = mid
  }
  const lift = (lo + hi) / 2
  return { lift, flight: simFlight(ev, la, lift, h0, cd) }
}

// True for a ball the model flies through the air: a lift of 8 degrees or more, with a speed and a
// distance. Anything else hops, and the panel's in-flight label reads the same predicate.
export const isAirFlight = (ball) => ball.launchAngle != null && ball.launchAngle >= 8 && ball.exitVelo != null && Boolean(ball.distance)

// The model of one ball: T (s), sf (share of the ground covered) and sz (height, ft) at
// K + 1 even steps, and ms (the flight on screen). A ball in the air with a speed, an
// angle and a distance is fitted: the lift is bisected until the sim lands at the
// distance. Anything else hops along the ground. `chord` is home to the landing point
// in diagram feet, the stand-in for a missing distance. `h0` is the start height in ft (3 = today's fixed value).
export function flightModel(ball, chord, h0 = 3) {
  const ev = ball.exitVelo, la = ball.launchAngle, dist = ball.distance || chord
  const sf = [], sz = []
  let T
  if (isAirFlight(ball)) {
    const { flight: f } = fitLift(ev, la, dist, { h0 })
    T = f.T
    let j = 1
    for (let i = 0; i <= K; i++) {
      const t = (T * i) / K
      while (j < f.pts.length - 1 && f.pts[j][2] < t) j++
      const p0 = f.pts[j - 1], p1 = f.pts[j]
      const q = p1[2] === p0[2] ? 0 : (t - p0[2]) / (p1[2] - p0[2])
      sf.push(Math.min(1, (p0[0] + (p1[0] - p0[0]) * q) / f.dist))
      sz.push(Math.max(0, p0[1] + (p1[1] - p0[1]) * q))
    }
    sf[K] = 1
    sz[K] = 0
  } else {
    T = Math.max(1.2, Math.min(3.6, dist / (Math.max(60, ev || 80) * 1.4667 * 0.42)))
    for (let i = 0; i <= K; i++) {
      const u = i / K
      sf.push(1 - (1 - u) ** 1.8)
      sz.push(i === K ? 0 : 3 * (1 - u) * Math.abs(Math.sin(3.4 * Math.PI * u)))
    }
  }
  return { T, sf, sz, ms: Math.max(700, Math.min(2800, T * 500)) }
}
