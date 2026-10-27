// Gameday's 16-bit stage: drawStage(state, w, h) is a pure function of stateAt()'s output and the
// buffer size, and returns a buffer of palette-slot indices. Two views share the slot: the pitch
// view behind home plate (the field drawn in depth, Mode-7 style), and on contact a hard cut to a
// high field view that scrolls with the ball. Only the two static backgrounds are cached.
import { PLATE_FRONT } from '../../../../lib/pitch/pitchFlight.js'
import { BASES, bearingOf, clamp, homeCamera, polar, v3, project } from './scene.js'
import { stateAt } from './play.js'
import { BATTER, CATCHER, CATCHER_PARTS, FIELDER, KIT, PITCHER, S, SPR, dith, figure, mark, newBuf, put, rect, sprite, text, textW } from './pixels.js'
import { fielderJoints } from './windup.js'

// The buffer is about 256 px wide and the canvas scales it by a whole number, so every pixel stays square.
export const stageScale = (W) => Math.max(1, Math.round(W / 256))

const HOME_PLATE = (x, y) => Math.abs(x) <= 0.708 && y >= 0 && y <= 1.417 && (y >= 0.708 || Math.abs(x) <= y)

// The ground at a world point: one slot, with dithered mowing and distance shade.
function ground(wall, x, y, sx, sy, far) {
  const d = Math.hypot(x, y), a = bearingOf(x, y), fair = Math.abs(a) <= 45
  if (d < 340 && Math.abs(Math.abs(a) - 45) * (Math.PI / 180) * d < 0.28 && y > -1) return S.chalk
  for (const m of [-1, 1]) {
    const bx0 = m * 1.21, bx1 = m * 5.21, inX = (x - Math.min(bx0, bx1)) * (x - Math.max(bx0, bx1)) <= 0
    if (y >= -2.29 && y <= 3.71 && inX && (Math.abs(x - bx0) < 0.17 || Math.abs(x - bx1) < 0.17)) return S.chalk
    if (inX && (Math.abs(y + 2.29) < 0.17 || Math.abs(y - 3.71) < 0.17)) return S.chalk
  }
  if (HOME_PLATE(x, y)) return S.chalk
  for (const k of ['1B', '2B', '3B']) if (Math.abs(x - BASES[k][0]) < 0.9 && Math.abs(y - BASES[k][1]) < 0.9) return S.chalk
  const dm = Math.hypot(x, y - 59)
  if (dm < 1.0 && Math.abs(y - 60.5) < 0.35) return S.chalk
  const skin = fair && Math.hypot(x, y - 60.5) < 95 && Math.abs(x) + Math.abs(y - 63.64) >= 57
  const cut = ['1B', '2B', '3B'].some((k) => Math.hypot(x - BASES[k][0], y - BASES[k][1]) < 10)
  const path = Math.abs(Math.abs(x) - (y < 63.64 ? y : 127.28 - y)) < 2.6 && y > 0 && y < 127.28 && Math.abs(x) < 64
  if (d < 13 || dm < 9 || skin || cut || path) return dith(sx, sy, 0.22) ? S.dirt : S.dirtLit
  if (fair && d > wall(a).ft - 14 && d <= wall(a).ft) return dith(sx, sy, 0.3) ? S.dirt : S.dirtLit
  if (!fair) return dith(sx, sy, far * 0.8) ? S.grassFar : S.grassFoul
  const stripe = (Math.floor((x + y) / 22) + Math.floor((y - x) / 22)) & 1
  return dith(sx, sy, far) ? S.grassFar : stripe ? S.grassLit : S.grass
}

// A crowd the old way: rows of heads over a dark stand.
function crowd(x, y, row) {
  if ((y & 1) === 0) return (row & 3) === 0 ? S.crowd2 : S.crowd1
  const h = (((x * 73856093) ^ (y * 19349663) ^ (row * 83492791)) >>> 0) % 100
  return h < 30 ? S.crowd1 : h < 55 ? S.crowd2 : h < 80 ? S.crowd3 : h < 92 ? S.crowd4 : S.chalk
}
// Seats seen from above: sections split by aisles, people in 2x2 blocks.
function seats(x, y) {
  if (x % 30 < 2 || y % 12 === 0) return S.crowd1
  const h = ((((x >> 1) * 73856093) ^ ((y >> 1) * 19349663)) >>> 0) % 100
  return h < 50 ? S.crowd1 : h < 84 ? S.crowd2 : h < 95 ? S.crowd3 : S.crowd4
}

// The pitch view's background, once per size: each pixel's ray meets the ground, the wall, the
// stands behind it, or the sky.
function pitchBg(wall, w, h, cam) {
  const b = newBuf(w, h), half = h / 2, P = cam.pos
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const nx = (sx + 0.5 - w / 2) / half / cam.k, ny = (half - sy - 0.5) / half / cam.k
      const dir = v3.norm(v3.add(cam.f, v3.add(v3.mul(cam.r, nx), v3.mul(cam.u, ny))))
      const over = (s) => { const x = P[0] + dir[0] * s, y = P[1] + dir[1] * s; return Math.hypot(x, y) - wall(bearingOf(x, y)).ft }
      let lo = 0, hi = over(2000) < 0 ? 4000 : 2000
      for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (over(m) < 0) lo = m; else hi = m }
      const tg = dir[2] < 0 ? -P[2] / dir[2] : Infinity
      let c
      if (tg < hi) {
        const x = P[0] + dir[0] * tg, y = P[1] + dir[1] * tg
        c = ground(wall, x, y, sx, sy, clamp((Math.hypot(x, y) - 170) / 260, 0, 0.55))
      } else {
        const x = P[0] + dir[0] * hi, y = P[1] + dir[1] * hi, z = P[2] + dir[2] * hi, a = bearingOf(x, y), wl = wall(a)
        if (z <= wl.h) {
          const seam = Math.round(a * 1.6) % 4 === 0 && Math.abs(a * 1.6 - Math.round(a * 1.6)) < 0.12
          c = seam ? S.wallDeep : z > wl.h - 1.2 ? S.wallLit : dith(sx, sy, (z / wl.h) * 0.5) ? S.wallLit : S.wall
        } else {
          let s = hi, row = -1
          for (let i = 0; i < 60 && row < 0; i++) {
            s += 6
            const xx = P[0] + dir[0] * s, yy = P[1] + dir[1] * s, beyond = Math.hypot(xx, yy) - wall(bearingOf(xx, yy)).ft
            if (P[2] + dir[2] * s <= wl.h + Math.min(34, beyond * 0.5)) row = beyond
          }
          c = row >= 0 ? crowd(sx, sy, Math.floor(row / 6)) : dith(sx, sy, clamp(sy / (h * 0.3), 0, 1)) ? S.skyHaze : S.sky
        }
      }
      b.px[sy * w + sx] = c
    }
  }
  return b
}

// ---- The high field view: oblique, height lifts up the screen ----------------------------------
const Q = 0.62, ZK = 0.8, X0 = -340, X1 = 340, Y1 = 470, TOP = 90
const zLift = (z) => (z < 50 ? z : 50 + (z - 50) * 0.35) * ZK
// `viewH` is the slot's height in buffer px: a tall phone slot gets a deeper map behind home.
function fieldMap(wall, k, viewH) {
  const Y0 = Math.min(-50, Y1 - (viewH + 40 - TOP) / (k * Q))
  const w = Math.ceil((X1 - X0) * k), h = Math.ceil((Y1 - Y0) * k * Q + TOP), b = newBuf(w, h)
  const toMap = (x, y, z = 0) => [(x - X0) * k, TOP + (Y1 - y) * k * Q - zLift(z) * k]
  for (let my = 0; my < h; my++) {
    for (let mx = 0; mx < w; mx++) {
      const x = X0 + mx / k, y = Y1 - (my - TOP) / (k * Q), d = Math.hypot(x, y), a = bearingOf(x, y)
      const beyond = Math.abs(a) <= 45 ? d - wall(a).ft : Math.abs(a) > 45 && d > 300 ? 1 : -1
      b.px[my * w + mx] = y < -62 && y > -66 && Math.abs(x) < 75 ? S.wallDeep : beyond > 0 || y > 440 || y < -66 ? seats(mx, my) : ground(wall, x, y, mx, my, 0)
    }
  }
  // The wall: a band from its foot up by its height, column by column.
  for (let i = 0; i <= 900; i++) {
    const a = -45 + (90 * i) / 900, wl = wall(a), foot = polar(a, wl.ft), [fx, fy] = toMap(foot[0], foot[1]), top = fy - zLift(wl.h) * k
    for (let y = Math.floor(top); y <= Math.ceil(fy); y++) put(b, fx, y, y - top < 1.5 ? S.wallLit : dith(Math.round(fx), y, 0.35) ? S.wallDeep : S.wall)
  }
  return { b, toMap }
}

// Caches keyed by the park's wall function, then by buffer size.
const CACHE = new WeakMap()
const cacheOf = (wall, key) => { if (!CACHE.has(wall)) CACHE.set(wall, new Map()); const m = CACHE.get(wall); if (!m.has(key)) m.set(key, {}); return m.get(key) }

// B ball, S strike (called, swinging, foul), X in play.
const callOf = (code) => ('XDE'.includes(code) ? 'X' : 'B*HVIP'.includes(code[0]) ? 'B' : 'S')

function pitchView(fb, K, st, w, h) {
  const play = st.play, { t: T, last } = play, cam = K.cam || (K.cam = homeCamera(w / h))
  fb.px.set(K.bg || (K.bg = pitchBg(play.wall, w, h, cam)).px)
  const P = (p) => project(cam, p, w, h)
  for (const k of Object.keys(st.fielders).filter((n) => n !== 'P' && n !== 'C').sort((a, c) => P(st.fielders[c]).d - P(st.fielders[a]).d)) {
    figure(fb, cam, fielderJoints(st.fielders[k]), FIELDER, { minR: 0.5 })
  }
  for (const r of st.runners) if (!r.batter && !r.gone) { const p = P(r.pos); if (p) sprite(fb, SPR.stand, p.x, p.y, KIT.road) }
  figure(fb, cam, st.pitcherPose, PITCHER, { minR: 0.6 })
  // The strike zone at the front of the plate: a dotted frame.
  const c0 = last && P([-0.83, PLATE_FRONT, last.szTop]), c1 = last && P([0.83, PLATE_FRONT, last.szBot])
  if (c0 && c1) {
    for (let x = Math.round(c0.x); x <= Math.round(c1.x); x += 2) { put(fb, x, c0.y, S.chalk); put(fb, x, c1.y, S.chalk) }
    for (let y = Math.round(c0.y); y <= Math.round(c1.y); y += 2) { put(fb, c0.x, y, S.chalk); put(fb, c1.x, y, S.chalk) }
  }
  const cj = {}
  for (const k in CATCHER) cj[k] = [CATCHER[k][0], -3.6 + CATCHER[k][1], CATCHER[k][2]]
  figure(fb, cam, cj, CATCHER_PARTS, { minR: 0.6, ghost: true })
  // Earlier pitches as numbered marks; the decision pitch's joins them when it arrives.
  const n = play.pitches.length, arrived = st.t >= T.pitch
  figure(fb, cam, st.batterPose, BATTER, { minR: 0.7 })
  for (let i = 0; i < (arrived ? n : st.marks); i++) {
    const p = play.pitches[i], q = p.px != null && P([p.px, PLATE_FRONT, p.pz])
    if (!q) continue
    const call = callOf(p.code)
    mark(fb, q.x, q.y, call === 'X' ? 'X' : String(p.n ?? i + 1), call === 'B' ? S.chalk : call === 'X' ? S.landing : S.kitRed, call === 'B' ? S.kitNavy : call === 'X' ? S.outline : S.chalk)
  }
  // The decision pitch in flight, with a short trail.
  if (st.pitchPos && st.t < T.pitch) {
    for (let k = 4; k >= 2; k -= 2) { const u = st.pitchU - k * 0.035, q = u > 0 && P(last.at(u)); if (q) put(fb, q.x, q.y, S.chalk) }
    const q = P(st.pitchPos)
    if (q) { const r = Math.max(1, Math.round(q.s * 0.15)); rect(fb, Math.round(q.x - r), Math.round(q.y - r), r * 2, r * 2, S.chalk) }
  }
  // Contact: a two-frame burst at the bat.
  if (play.ball && st.phase === 'contact' && st.t >= T.pitch + 0.1) {
    const q = P(last.at(1)), R = Math.floor((st.t - T.pitch - 0.1) / 0.04) % 2 ? 7 : 4
    if (q) {
      for (let a = 0; a < 8; a++) for (let s = 2; s <= R; s++) put(fb, q.x + Math.cos((a * Math.PI) / 4) * s, q.y + Math.sin((a * Math.PI) / 4) * s, s > R - 2 ? S.landing : S.chalk)
      rect(fb, Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 3, S.chalk)
    }
  }
  // The decision pitch's tag: speed, type, call.
  const q = arrived && last && last.px != null && P([last.px, PLATE_FRONT, last.pz])
  if (q) {
    const s = [last.mph != null && Math.round(last.mph), last.type, callOf(last.code)].filter(Boolean).join(' '), tw = textW(s) + 4
    const tx = q.x + 8 + tw > w - 2 ? q.x - 8 - tw : q.x + 8, ty = clamp(q.y - 4, 2, h - 9)
    rect(fb, Math.round(tx), Math.round(ty), tw, 9, S.outline); rect(fb, Math.round(tx) + 1, Math.round(ty) + 1, tw - 2, 7, S.kitNavy)
    text(fb, s, Math.round(tx) + 2, Math.round(ty) + 2, S.landing)
  }
}

function fieldView(fb, K, st, w, h) {
  const play = st.play, k = w / 210, M = K.map || (K.map = fieldMap(play.wall, k, h)), mb = M.b, ball = st.ballPos
  // Centre between the ball and its shadow so both stay in the slot; a ball past the wall is framed with it.
  const bd = Math.hypot(ball[0], ball[1]), ba = bearingOf(ball[0], ball[1]), wf = play.wall(ba).ft
  const [gx, gy] = M.toMap(...(bd > wf ? polar(ba, (bd + wf) / 2) : ball).slice(0, 2), 0)
  const cx = clamp(Math.round(gx - w / 2), 0, mb.w - w), cy = clamp(Math.round(gy - (zLiftPx(ball[2], k)) / 2 - h * 0.55), 0, mb.h - h)
  for (let y = 0; y < h; y++) fb.px.set(mb.px.subarray((cy + y) * mb.w + cx, (cy + y) * mb.w + cx + w), y * w)
  const toScr = (p) => { const [x, y] = M.toMap(p[0], p[1], p[2] || 0); return [x - cx, y - cy] }
  // Who moved since a moment ago: a look-back, no carried state.
  const prev = stateAt(play, Math.max(0, st.t - 0.06)), frame = Math.floor(st.t / 0.12) & 1
  const people = []
  const person = (p, q, kit) => {
    const moving = q && Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05
    people.push({ p, kit, rows: moving ? (frame ? SPR.run0 : SPR.run1) : SPR.stand, flip: moving && p[0] < q[0] })
  }
  for (const n in st.fielders) if (n !== 'C') person(st.fielders[n], prev.fielders[n], KIT.home)
  people.push({ p: [0, -3.6, 0], rows: SPR.stand, kit: KIT.home }, { p: [0.6, -7, 0], rows: SPR.stand, kit: KIT.ump })
  st.runners.forEach((r, i) => { if (!r.gone) person(r.pos, prev.runners[i]?.pos, KIT.road) })
  people.sort((a, c) => c.p[1] - a.p[1])
  const inSeats = bd > wf
  if (!inSeats || ball[2] <= 0.5) {
    const [sx, sy] = toScr([ball[0], ball[1], 0]), under = mb.px[Math.round(sy + cy) * mb.w + Math.round(sx + cx)]
    const c = under === S.dirt || under === S.dirtLit ? S.shadowDirt : S.shadow
    rect(fb, Math.round(sx) - 2, Math.round(sy) - 1, 5, 1, c); rect(fb, Math.round(sx) - 3, Math.round(sy), 7, 1, c); rect(fb, Math.round(sx) - 2, Math.round(sy) + 1, 5, 1, c)
  }
  for (const m of people) { const [x, y] = toScr(m.p); sprite(fb, m.rows, x, y + 1, m.kit, m.flip) }
  // The ball is bigger the higher it flies, the old games' way of showing height.
  const [bx, by] = toScr(ball), r = ball[2] > 90 ? 3 : ball[2] > 35 ? 2 : 1
  for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) {
    const d = i * i + j * j
    if (d <= r * r + r) put(fb, bx + i, by + j, S.chalk)
    else if (d <= (r + 1) * (r + 1) + r + 1) put(fb, bx + i, by + j, S.outline)
  }
  if (r >= 2) put(fb, bx + 1, by + 1, S.kitRed)
  // A ball that came down in the seats gets a ring, so it reads against the crowd.
  if (st.t >= play.t.chase && inSeats) {
    const R = 5 + (Math.floor(st.t / 0.25) & 1)
    for (let a = 0; a < 32; a++) put(fb, bx + Math.cos((a * Math.PI) / 16) * R, by + Math.sin((a * Math.PI) / 16) * R * 0.8, S.landing)
  }
  if (st.phase === 'chase' && play.ball.kind === 'air') {
    for (const j of [1, 3]) { const [x, y] = toScr(play.ball.at(Math.max(0, st.ballT - j * 0.09))); put(fb, x, y, S.chalk) }
  }
}
const zLiftPx = (z, k) => zLift(z) * k

// The whole stage at `st` = stateAt(play, t), in a w x h buffer of slot indices.
export function drawStage(st, w, h) {
  const K = cacheOf(st.play.wall, `${w}x${h}`), fb = K.fb || (K.fb = newBuf(w, h))
  if (st.view === 'field') fieldView(fb, K, st, w, h)
  else pitchView(fb, K, st, w, h)
  return { w, h, px: fb.px.slice() }
}
