import { HIT_COORD_FT_PER_UNIT } from '../../../../../lib/ballpark/hitProjection.js'

// The Contact card's ball flight (#2073): the canvas drag-and-lift sketch, fitted to the
// measured distance, played at half speed. Only the motion reads it; the card prints no
// height or hang time from it. Pure: no React, no clock. lib/ballpark/ballFlight.js is a
// different thing (a static plan-view bow), so it is not reused here.

export const LEAD_MS = 260 // the plate pulse before the ball leaves
export const SETTLE_MS = 1400 // the longest landed beat (the trace fade); the clock stops after it
export const CANVAS_DOT_R = 2.1 // the canvas dot, the base for marks that sit on a dot
export const UNIT = HIT_COORD_FT_PER_UNIT // one canvas unit, in diagram feet
export const ZK = 0.24 * UNIT // height in feet to diagram units up the frame
const K = 40 // samples per flight

const cl = (x) => Math.min(1, Math.max(0, x))
const eo = (x) => 1 - (1 - cl(x)) ** 3
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100

// One flight: x along the ground and z up, in feet, every 10ms, until it lands.
export function simFlight(ev, la, lift) {
  const G = 32.174, RHO = 0.002284, A = 0.04585, MS = 0.009955, CD = 0.35, dt = 0.01
  const v0 = ev * 1.46667
  const a = (la * Math.PI) / 180
  let x = 0, z = 3, vx = v0 * Math.cos(a), vz = v0 * Math.sin(a), t = 0
  const kd = (0.5 * RHO * A * CD) / MS
  const kl = (0.5 * RHO * A * lift) / MS
  const pts = [[0, 3, 0]]
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

// The model of one ball: T (s), sf (share of the ground covered) and sz (height, ft) at
// K + 1 even steps, and ms (the flight on screen). A ball in the air with a speed, an
// angle and a distance is fitted: the lift is bisected until the sim lands at the
// distance. Anything else hops along the ground. `chord` is home to the landing point
// in diagram feet, the stand-in for a missing distance.
// True for a ball the model flies through the air: a lift of 8 degrees or more, with a speed and a
// distance. Anything else hops, and the panel's in-flight label reads the same predicate.
export const isAirFlight = (ball) => ball.launchAngle != null && ball.launchAngle >= 8 && ball.exitVelo != null && Boolean(ball.distance)

export function flightModel(ball, chord) {
  const ev = ball.exitVelo, la = ball.launchAngle, dist = ball.distance || chord
  const sf = [], sz = []
  let T
  if (isAirFlight(ball)) {
    let lo = 0, hi = 0.45, s
    if (dist <= simFlight(ev, la, lo).dist) s = lo
    else if (dist >= simFlight(ev, la, hi).dist) s = hi
    else {
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2
        if (simFlight(ev, la, mid).dist < dist) lo = mid
        else hi = mid
      }
      s = (lo + hi) / 2
    }
    const f = simFlight(ev, la, s)
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

// One model per ball object (the bisection runs ~20 sims; a tap must not repeat it).
const CACHE = new WeakMap()
export function flightOf(ball, chord) {
  let f = CACHE.get(ball)
  if (!f) {
    f = flightModel(ball, chord)
    CACHE.set(ball, f)
  }
  return f
}

const path = (pts) => pts.map(([x, y], j) => `${j ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('')

// Every mark at time t (ms since the tap). t = Infinity is the settled landed state: the
// reduced-motion frame. `home` and `land` are diagram points; `dotR` is the tapped dot's
// radius; `hr` adds the second ring.
export function flightFrame(f, t, { home, land, dotR, hr }) {
  const M = dotR / CANVAS_DOT_R
  const around = (cr) => dotR + (cr - CANVAS_DOT_R) * UNIT
  const el = t - LEAD_MS
  const u = cl(el / f.ms)
  const flying = t < LEAD_MS + f.ms
  const since = el - f.ms
  const last = f.sf.length - 1
  const s = u * last
  const i0 = Math.min(last - 1, Math.floor(s))
  const q = s - i0
  const fr = f.sf[i0] + (f.sf[i0 + 1] - f.sf[i0]) * q
  const z = f.sz[i0] + (f.sz[i0 + 1] - f.sz[i0]) * q
  const at = (g, h) => [home.x + (land.x - home.x) * g, home.y + (land.y - home.y) * g - h * ZK]
  const [gx, gy] = at(fr, 0)
  const pq = cl(t / (LEAD_MS + 420))
  const pulse = { r: r2((3 + pq * 12) * UNIT), op: t < LEAD_MS + 420 ? r2(0.8 * (1 - pq)) : 0 }
  if (flying) {
    const pts = f.sf.slice(0, i0 + 1).map((g, k) => at(g, f.sz[k]))
    pts.push(at(fr, z))
    return {
      flying, fr, pulse,
      track: { d: `M${home.x} ${home.y}L${r1(gx)} ${r1(gy)}`, op: el > 0 ? 0.55 : 0 },
      trace: { d: el > 0 ? path(pts) : '', op: 0.85 },
      shadow: { x: r1(gx), y: r1(gy), rx: r2((2.2 + z / 120) * M), ry: r2((1 + z / 300) * M), op: r2(Math.max(0.12, 0.35 - z / 400)) },
      drop: z > 4 ? { d: `M${r1(gx)} ${r1(gy - z * ZK)}L${r1(gx)} ${r1(gy)}`, op: r2(Math.min(0.6, z / 40)) } : null,
      ball: { x: r1(gx), y: r1(gy - z * ZK), r: r2((2.3 + (z / 100) * 1.6) * M) },
      ring: null, ring2: null, sel: null,
    }
  }
  const a = eo(since / 260)
  const lq = cl(since / 900)
  const lq2 = cl((since - 140) / 1100)
  return {
    flying, fr: 1, pulse,
    track: { d: `M${home.x} ${home.y}L${land.x} ${land.y}`, op: r2(0.55 - 0.15 * cl(since / 600)) },
    trace: { d: path(f.sf.map((g, k) => at(g, f.sz[k]))), op: r2(0.85 * (1 - cl(since / 1400))) },
    ring: { x: land.x, y: land.y, r: r2(around(3 + lq * 12)), op: since < 900 ? r2(0.9 * (1 - lq)) : 0 },
    ring2: { x: land.x, y: land.y, r: r2(around(3 + lq2 * 22)), op: hr && since < 1240 ? r2(0.7 * (1 - lq2)) : 0 },
    sel: { x: land.x, y: land.y, r: r2(around(6.5 * (1 + 0.6 * (1 - a)))), op: r2(Math.min(1, since / 160)) },
    shadow: null, drop: null, ball: null,
  }
}
