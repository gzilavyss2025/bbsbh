import { HIT_COORD_FT_PER_UNIT } from '../../../../../lib/ballpark/hitProjection.js'
import { simFlight, flightModel, isAirFlight } from '../../../../../lib/ballpark/flightModel.js'

// The Contact card's ball flight (#2073): the canvas drag-and-lift sketch, fitted to the
// measured distance, played at half speed. Only the motion reads it; the card prints no
// height or hang time from it. Pure: no React, no clock. lib/ballpark/ballFlight.js is a
// different thing (a static plan-view bow), so it is not reused here.

export const LEAD_MS = 260 // the plate pulse before the ball leaves
export const SETTLE_MS = 1400 // the longest landed beat (the trace fade); the clock stops after it
export const CANVAS_DOT_R = 2.1 // the canvas dot, the base for marks that sit on a dot
export const UNIT = HIT_COORD_FT_PER_UNIT // one canvas unit, in diagram feet
export const ZK = 0.24 * UNIT // height in feet to diagram units up the frame

const cl = (x) => Math.min(1, Math.max(0, x))
const eo = (x) => 1 - (1 - cl(x)) ** 3
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100

export { simFlight, flightModel, isAirFlight }

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
