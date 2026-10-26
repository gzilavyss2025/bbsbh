// Stage concept: 16-bit sprites (design round, #2568), the round 1 baseline. Not app code.
// Round 2 adds the palette swap (create's opts.palette); the drawing is round 1's.
// The scene renders at about 256 px wide into a palette-limited buffer, then scales up by a whole
// number with nearest-neighbour, so every pixel stays square. Two views share one slot: the pitch
// view behind home, and on contact a hard cut to a high fielding view that scrolls with the ball.
// draw() is a pure function of the state; only static art (the two backgrounds) is cached.
;(function () {
  const { clamp, lerp, v3 } = GD

  // ---- Palette: 30 colours, chosen as one 16-bit set ------------------------------------------
  const HEX = {
    sky0: '#5b9be0', sky1: '#a3d3f2', crowd0: '#2a2640', crowd1: '#5c4a6c', crowd2: '#ad6258', crowd3: '#d9b06e',
    mon0: '#1b4530', mon1: '#2c6644', mon2: '#47885a', grass0: '#3c8838', grass1: '#55a644', grassFar: '#2e6c32', foul: '#357b35',
    dirt0: '#b4743d', dirt1: '#d29a5b', chalk: '#f2efe2', ink: '#121418', shadow: '#1d4524', dirtShadow: '#7e4f28',
    navy: '#1d2b4f', teal: '#2a9893', grey: '#aab0ba', greyD: '#6c7280', red: '#c3323b', skin: '#e2a67b', skinD: '#9a6445',
    wood: '#dba45f', gold: '#f5cf3e',
    // Round 2: the zone map's five temperatures (MLB's own words for hotColdZones).
    zoneCold: '#3b6fb6', zoneCool: '#8fb3df', zoneLuke: '#e8e2cf', zoneWarm: '#e8a76a', zoneHot: '#c3323b',
  }
  const packHex = (h) => { h = h.trim(); return (255 << 24) | (parseInt(h.slice(5, 7), 16) << 16) | (parseInt(h.slice(3, 5), 16) << 8) | parseInt(h.slice(1, 3), 16) }
  const C = {}
  for (const k in HEX) C[k] = packHex(HEX[k])
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
  const dith = (x, y, f) => f > BAYER[(y & 3) * 4 + (x & 3)]

  // A crowd the old way: rows of heads in a few shirt colours over a dark stand.
  function crowdPx(x, y, row) {
    if ((y & 1) === 0) return (row & 3) === 0 ? C.crowd1 : C.crowd0
    const hsh = (((x * 73856093) ^ (y * 19349663) ^ (row * 83492791)) >>> 0) % 100
    return hsh < 30 ? C.crowd0 : hsh < 55 ? C.crowd1 : hsh < 80 ? C.crowd2 : hsh < 92 ? C.crowd3 : C.chalk
  }

  // Seats seen from above: sections split by aisles, people in 2x2 blocks.
  function seatPx(x, y) {
    if (x % 30 < 2 || y % 12 === 0) return C.crowd0
    const hsh = ((((x >> 1) * 73856093) ^ ((y >> 1) * 19349663)) >>> 0) % 100
    return hsh < 50 ? C.crowd0 : hsh < 84 ? C.crowd1 : hsh < 95 ? C.crowd2 : C.crowd3
  }

  // ---- 3x5 pixel font -------------------------------------------------------------------------
  const GLYPH = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111', 4: '101101111001001',
    5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101',
    L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
    W: '101101111111101', X: '101101010101101', Y: '101101010010010', ' ': '000000000000000',
  }

  // ---- A frame buffer of packed pixels ----------------------------------------------------------
  function makeBuf(w, h) {
    const img = new ImageData(w, h)
    return { w, h, img, px: new Uint32Array(img.data.buffer) }
  }
  const put = (b, x, y, c) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.px[y * b.w + x] = c }
  const rect = (b, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c) }
  function text(b, s, x, y, c) {
    for (const ch of s) {
      const g = GLYPH[ch] || GLYPH[' ']
      for (let i = 0; i < 15; i++) if (g[i] === '1') put(b, x + (i % 3), y + ((i / 3) | 0), c)
      x += 4
    }
  }
  const textW = (s) => s.length * 4 - 1

  // ---- Shared geometry --------------------------------------------------------------------------
  const deg = (x, y) => (Math.atan2(x, y) * 180) / Math.PI
  const HOME_PLATE = (x, y) => Math.abs(x) <= 0.708 && y >= 0 && y <= 1.417 && (y >= 0.708 || Math.abs(x) <= y)
  // What the ground is at a world point: one palette colour, with dithered mowing and distance shade.
  function ground(x, y, sx, sy, far) {
    const d = Math.hypot(x, y), a = deg(x, y)
    const fair = Math.abs(a) <= 45
    // chalk: foul lines, batter's boxes
    if (d < 340 && Math.abs(Math.abs(a) - 45) * (Math.PI / 180) * d < 0.28 && y > -1) return C.chalk
    for (const m of [-1, 1]) {
      const bx0 = m * 1.21, bx1 = m * 5.21, y0 = -2.29, y1 = 3.71
      const inX = (x - Math.min(bx0, bx1)) * (x - Math.max(bx0, bx1)) <= 0, inY = y >= y0 && y <= y1
      if (inY && inX && (Math.abs(x - bx0) < 0.17 || Math.abs(x - bx1) < 0.17)) return C.chalk
      if (inX && (Math.abs(y - y0) < 0.17 || Math.abs(y - y1) < 0.17)) return C.chalk
    }
    if (HOME_PLATE(x, y)) return C.chalk
    for (const b of [GD.BASES['1B'], GD.BASES['2B'], GD.BASES['3B']]) if (Math.abs(x - b[0]) < 0.9 && Math.abs(y - b[1]) < 0.9) return C.chalk
    const dm = Math.hypot(x, y - 59)
    if (dm < 1.0 && Math.abs(y - 60.5) < 0.35) return C.chalk // the rubber
    // dirt: home circle, mound, the skin of the infield, the base cutouts, the warning track
    const inDiamond = Math.abs(x) + Math.abs(y - 63.64) < 57
    const skin = fair && Math.hypot(x, y - 60.5) < 95 && !inDiamond
    const cut = [GD.BASES['1B'], GD.BASES['2B'], GD.BASES['3B']].some((b) => Math.hypot(x - b[0], y - b[1]) < 10)
    const path = Math.abs(Math.abs(x) - (y < 63.64 ? y : 127.28 - y)) < 2.6 && y > 0 && y < 127.28 && Math.abs(x) < 64
    if (d < 13 || dm < 9 || skin || cut || path) return dith(sx, sy, 0.22) ? C.dirt0 : C.dirt1
    if (fair) {
      const w = GD.wallAt(a).ft
      if (d > w - 14 && d <= w) return dith(sx, sy, 0.3) ? C.dirt0 : C.dirt1
    }
    if (!fair) return dith(sx, sy, far * 0.8) ? C.grassFar : C.foul
    const stripe = ((Math.floor((x + y) / 22) + Math.floor((y - x) / 22)) & 1) === 0
    const base = stripe ? C.grass1 : C.grass0
    return dith(sx, sy, far) ? C.grassFar : base
  }

  // ---- The pitch view background: Mode-7-style raycast, once per buffer size ---------------------
  function pitchBg(w, h, cam) {
    const b = makeBuf(w, h), half = h / 2, P = cam.pos
    for (let sy = 0; sy < h; sy++) {
      for (let sx = 0; sx < w; sx++) {
        const nx = (sx + 0.5 - w / 2) / half / cam.k, ny = (half - sy - 0.5) / half / cam.k
        const dir = v3.norm(v3.add(cam.f, v3.add(v3.mul(cam.r, nx), v3.mul(cam.u, ny))))
        // where the ray meets the wall line (horizontal distance from home = wall distance)
        const horiz = (s) => { const x = P[0] + dir[0] * s, y = P[1] + dir[1] * s; return Math.hypot(x, y) - GD.wallAt(deg(x, y)).ft }
        let lo = 0, hi = 2000
        if (horiz(hi) < 0) hi = 4000
        for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (horiz(m) < 0) lo = m; else hi = m }
        const sw = hi, tg = dir[2] < 0 ? -P[2] / dir[2] : Infinity
        let c
        if (tg < sw) {
          const x = P[0] + dir[0] * tg, y = P[1] + dir[1] * tg
          const far = clamp((Math.hypot(x, y) - 170) / 260, 0, 0.55)
          c = ground(x, y, sx, sy, far)
        } else {
          const x = P[0] + dir[0] * sw, y = P[1] + dir[1] * sw, z = P[2] + dir[2] * sw, a = deg(x, y), wl = GD.wallAt(a)
          if (z <= wl.h) {
            // the wall: Fenway green, panel seams, and the manual scoreboard on the Monster
            const seam = Math.round(a * 1.6) % 4 === 0 && Math.abs(a * 1.6 - Math.round(a * 1.6)) < 0.12
            const board = a > -36 && a < -27 && z > 6 && z < 21
            if (board) c = ((sx + sy) & 1) && (sy & 1) && z > 8 ? C.chalk : C.mon0
            else c = seam ? C.mon0 : z > wl.h - 1.2 ? C.mon2 : dith(sx, sy, z / wl.h * 0.5) ? C.mon2 : C.mon1
          } else {
            // stands rise behind the wall; above them the sky
            let s = sw, hit = false, row = 0
            for (let i = 0; i < 60; i++) {
              s += 6
              const xx = P[0] + dir[0] * s, yy = P[1] + dir[1] * s, zz = P[2] + dir[2] * s
              const beyond = Math.hypot(xx, yy) - GD.wallAt(deg(xx, yy)).ft
              const stand = wl.h + Math.min(34, beyond * 0.5)
              if (zz <= stand) { hit = true; row = beyond; break }
            }
            if (hit) c = crowdPx(sx, sy, Math.floor(row / 6))
            else c = dith(sx, sy, clamp(sy / (h * 0.3), 0, 1)) ? C.sky1 : C.sky0
          }
        }
        b.px[sy * w + sx] = c
      }
    }
    return b
  }

  // ---- The field map for the high fielding view: oblique, height lifts up the screen ---------------
  const Q = 0.62, ZK = 0.8, X0 = -340, X1 = 340, Y1 = 470, TOP = 90
  const zLift = (z) => (z < 50 ? z : 50 + (z - 50) * 0.35) * ZK
  // `viewH` is the slot's height in low-res pixels: a tall phone slot gets a deeper map behind home.
  function fieldMap(S, viewH) {
    const Y0 = Math.min(-50, Y1 - (viewH + 40 - TOP) / (S * Q))
    const w = Math.ceil((X1 - X0) * S), h = Math.ceil((Y1 - Y0) * S * Q + TOP)
    const b = makeBuf(w, h)
    const toMap = (x, y, z = 0) => [(x - X0) * S, TOP + (Y1 - y) * S * Q - zLift(z) * S]
    for (let my = 0; my < h; my++) {
      for (let mx = 0; mx < w; mx++) {
        const x = X0 + mx / S, y = Y1 - (my - TOP) / (S * Q), d = Math.hypot(x, y), a = deg(x, y)
        let c
        const beyond = Math.abs(a) <= 45 ? d - GD.wallAt(a).ft : (Math.abs(a) > 45 && d > 300 ? 1 : -1)
        if (y < -62 && y > -66 && Math.abs(x) < 75) c = C.mon0 // the backstop
        else if (beyond > 0 || y > 440 || y < -66) c = seatPx(mx, my)
        else c = ground(x, y, mx, my, 0)
        b.px[my * w + mx] = c
      }
    }
    // The wall: a vertical band from its foot up by its height, drawn column by column.
    for (let i = 0; i <= 900; i++) {
      const a = -45 + (90 * i) / 900, wl = GD.wallAt(a)
      const foot = GD.polar(a, wl.ft), [fx, fy] = toMap(foot[0], foot[1]), top = fy - zLift(wl.h) * S
      for (let yy = Math.floor(top); yy <= Math.ceil(fy); yy++) {
        const z = ((fy - yy) / (fy - top || 1)) * wl.h
        const board = a > -36 && a < -27 && z > 6 && z < 21
        let c = yy - top < 1.5 ? C.mon2 : dith(Math.round(fx), yy, 0.35) ? C.mon0 : C.mon1
        if (board) c = (Math.round(fx) + yy) % 2 && yy % 2 && z > 8 ? C.chalk : C.mon0
        put(b, Math.round(fx), yy, c)
      }
    }
    return { b, toMap, S }
  }

  // ---- Figures: the engine skeleton, rasterised as a chunky sprite with a 1 px ink outline ---------
  // `mask` holds colour per pixel for one figure; the outline is every empty pixel next to it.
  function figure(fb, cam, joints, parts, opts = {}) {
    const { w, h } = fb, half = h / 2
    const P = {}
    for (const k in joints) { const p = GD.project(cam, joints[k], w, h); if (!p) return; P[k] = p }
    let x0 = w, y0 = h, x1 = 0, y1 = 0
    for (const k in P) { x0 = Math.min(x0, P[k].x); x1 = Math.max(x1, P[k].x); y0 = Math.min(y0, P[k].y); y1 = Math.max(y1, P[k].y) }
    const sc = P.pelvis ? P.pelvis.s : 1
    const pad = Math.ceil(1.6 * sc) + 3
    x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(w - 1, Math.ceil(x1 + pad)); y1 = Math.min(h - 1, Math.ceil(y1 + pad))
    if (x1 < x0 || y1 < y0) return
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, mask = new Uint32Array(bw * bh)
    const cap = (a, b, rFt, c, shade) => {
      if (!a || !b) return
      const r = Math.max(opts.minR ?? 0.6, rFt * (a.s + b.s) / 2)
      const lx = Math.max(x0, Math.floor(Math.min(a.x, b.x) - r)), hx = Math.min(x1, Math.ceil(Math.max(a.x, b.x) + r))
      const ly = Math.max(y0, Math.floor(Math.min(a.y, b.y) - r)), hy = Math.min(y1, Math.ceil(Math.max(a.y, b.y) + r))
      const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1
      for (let y = ly; y <= hy; y++) for (let x = lx; x <= hx; x++) {
        const px = x + 0.5, py = y + 0.5, u = clamp(((px - a.x) * dx + (py - a.y) * dy) / L2, 0, 1)
        const ex = px - (a.x + dx * u), ey = py - (a.y + dy * u), dd = ex * ex + ey * ey
        if (dd <= r * r) {
          const side = (ex * 0.8 + ey * 0.6) / r
          mask[(y - y0) * bw + (x - x0)] = shade && side > 0.35 && ((x + y) & 1) ? shade : c
        }
      }
    }
    const quad = (pts, c, shade) => {
      if (pts.some((p) => !p)) return
      const lx = Math.max(x0, Math.floor(Math.min(...pts.map((p) => p.x)))), hx = Math.min(x1, Math.ceil(Math.max(...pts.map((p) => p.x))))
      const ly = Math.max(y0, Math.floor(Math.min(...pts.map((p) => p.y)))), hy = Math.min(y1, Math.ceil(Math.max(...pts.map((p) => p.y))))
      for (let y = ly; y <= hy; y++) for (let x = lx; x <= hx; x++) {
        let inside = true, sgn = 0
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], q = pts[(i + 1) % pts.length], cr = (q.x - p.x) * (y + 0.5 - p.y) - (q.y - p.y) * (x + 0.5 - p.x)
          const s = Math.sign(cr); if (s !== 0) { if (sgn === 0) sgn = s; else if (s !== sgn) { inside = false; break } }
        }
        if (inside) mask[(y - y0) * bw + (x - x0)] = shade && ((x + y) & 1) && x > (pts[0].x + pts[1].x) / 2 ? shade : c
      }
    }
    // Paint far parts first, near parts last.
    const order = parts.map((p, i) => ({ p, i, d: p.at.reduce((s, k) => s + (P[k] ? P[k].d : 0), 0) / p.at.length })).sort((a, b) => b.d - a.d || a.i - b.i)
    for (const { p } of order) {
      if (p.kind === 'cap') cap(P[p.at[0]], P[p.at[1]], p.r, p.c, p.shade)
      else if (p.kind === 'quad') quad(p.at.map((k) => P[k]), p.c, p.shade)
      else if (p.kind === 'head') {
        const a = P[p.at[0]], r = Math.max(1.2, p.r * a.s)
        for (let y = Math.floor(a.y - r - 1); y <= Math.ceil(a.y + r); y++) for (let x = Math.floor(a.x - r - 1); x <= Math.ceil(a.x + r + 1); x++) {
          if (x < x0 || x > x1 || y < y0 || y > y1) continue
          const dx = x + 0.5 - a.x, dy = y + 0.5 - a.y
          if (dx * dx + dy * dy <= r * r) mask[(y - y0) * bw + (x - x0)] = dy < -r * 0.05 ? p.hat : p.c
          else if (p.brim && dy > -r * 0.25 && dy < r * 0.2 && Math.abs(dx) <= r + 1.2 && dx * p.brim > 0) mask[(y - y0) * bw + (x - x0)] = p.hat
        }
      }
    }
    // Compose with the outline, or as a 50% checker (see-through) when asked.
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const m = mask[(y - y0) * bw + (x - x0)]
      if (opts.ghost && ((x + y) & 1)) continue
      if (m) fb.px[y * w + x] = m
      else if (!opts.noOutline) {
        const n = (xx, yy) => xx >= x0 && xx <= x1 && yy >= y0 && yy <= y1 && mask[(yy - y0) * bw + (xx - x0)]
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) fb.px[y * w + x] = C.ink
      }
    }
  }

  // Kits: which colour each body part wears.
  const kit = (jersey, jerseyShade, pants, trim, hat, sleeve) => [
    { kind: 'cap', at: ['lHip', 'lKnee'], r: 0.3, c: pants, shade: jerseyShade }, { kind: 'cap', at: ['rHip', 'rKnee'], r: 0.3, c: pants, shade: jerseyShade },
    { kind: 'cap', at: ['lKnee', 'lFoot'], r: 0.24, c: trim }, { kind: 'cap', at: ['rKnee', 'rFoot'], r: 0.24, c: trim },
    { kind: 'quad', at: ['lSho', 'rSho', 'rHip', 'lHip'], c: jersey, shade: jerseyShade }, { kind: 'cap', at: ['neck', 'pelvis'], r: 0.48, c: jersey, shade: jerseyShade },
    { kind: 'cap', at: ['lSho', 'lElb'], r: 0.22, c: sleeve }, { kind: 'cap', at: ['rSho', 'rElb'], r: 0.22, c: sleeve },
    { kind: 'head', at: ['head'], r: 0.48, c: C.skin, hat, brim: 0 },
  ]
  const BATTER = (side) => [
    ...kit(C.grey, C.greyD, C.grey, C.navy, C.navy, C.navy),
    { kind: 'cap', at: ['lElb', 'hands'], r: 0.19, c: C.skin }, { kind: 'cap', at: ['rElb', 'hands'], r: 0.19, c: C.skin },
    { kind: 'cap', at: ['hands', 'batTip'], r: 0.11, c: C.wood }, { kind: 'cap', at: ['hands', 'hands'], r: 0.2, c: C.teal },
  ]
  const PITCHER = [...kit(C.chalk, C.grey, C.chalk, C.navy, C.navy, C.red), { kind: 'cap', at: ['rElb', 'ball'], r: 0.19, c: C.skin }, { kind: 'cap', at: ['lElb', 'lElb'], r: 0.32, c: C.dirt0 }]
  const FIELDER = [...kit(C.chalk, C.grey, C.chalk, C.navy, C.navy, C.red)]
  // A fielder's ready stance, turned to face home from `pos`.
  function fielderJoints(pos) {
    const pose = GD.pitcherPose(0), f = v3.norm([-pos[0], -pos[1], 0]), r = [f[1], -f[0], 0], o = {}
    for (const k of GD.PJ) { const p = pose[k]; o[k] = v3.add(pos, v3.add(v3.add(v3.mul(r, p[0]), v3.mul(f, p[1] * 0.3)), [0, 0, p[2]])) }
    return o
  }
  const CATCHER = { head: [0, 0.2, 3.5], neck: [0, 0.1, 3.05], lSho: [-0.62, 0.15, 2.9], rSho: [0.62, 0.15, 2.9], lElb: [-0.75, 0.75, 2.3], rElb: [0.7, 0.55, 2.2], pelvis: [0, -0.3, 1.8], lHip: [-0.5, -0.3, 1.8], rHip: [0.5, -0.3, 1.8], lKnee: [-0.95, 0.7, 1.5], rKnee: [0.95, 0.7, 1.5], lFoot: [-0.8, -0.2, 0], rFoot: [0.8, -0.2, 0], ball: [0, 0, 0] }
  const CATCHER_PARTS = [...kit(C.navy, C.ink, C.chalk, C.navy, C.navy, C.navy), { kind: 'cap', at: ['lElb', 'lElb'], r: 0.42, c: C.dirt0 }]

  // ---- Sprites for the fielding view: hand-placed pixel art ------------------------------------------
  // H hat/helmet, F face, J jersey, T trim, P pants, S sock, K shoe, s skin. Two run frames.
  const SPR = {
    stand: ['..HHH..', '.HHHHH.', '..FFF..', '.JJJJJ.', 'sJTJTJs', 's.JJJ.s', '..PPP..', '..P.P..', '..S.S..', '.KK.KK.'],
    run0: ['..HHH..', '.HHHHH.', '..FFF..', 'sJJJJJ.', '.JTJTJs', '..JJJ..', '..PPP..', '.PP..P.', '.S...S.', 'KK...KK'],
    run1: ['..HHH..', '.HHHHH.', '..FFF..', '.JJJJJs', 'sJTJTJ.', '..JJJ..', '..PPP..', '..PP...', '..SS...', '..KKK..'],
  }
  function sprite(fb, rows, x, y, pal, flip) {
    const h = rows.length, w = rows[0].length, x0 = Math.round(x - w / 2), y0 = Math.round(y - h)
    const at = (i, j) => { if (j < 0 || j >= h || i < 0 || i >= w) return '.'; return rows[j][flip ? w - 1 - i : i] }
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
      const ch = at(i, j)
      if (ch !== '.') put(fb, x0 + i, y0 + j, pal[ch])
      else if ([at(i - 1, j), at(i + 1, j), at(i, j - 1), at(i, j + 1)].some((c) => c !== '.')) put(fb, x0 + i, y0 + j, C.ink)
    }
  }
  const HOME_KIT = { H: C.navy, F: C.skin, J: C.chalk, T: C.red, P: C.chalk, S: C.navy, K: C.ink, s: C.skin }
  const ROAD_KIT = { H: C.navy, F: C.skin, J: C.grey, T: C.teal, P: C.grey, S: C.navy, K: C.ink, s: C.skin }
  const UMP_KIT = { H: C.ink, F: C.skin, J: C.ink, T: C.navy, P: C.greyD, S: C.ink, K: C.ink, s: C.skin }

  // ---- Pitch marks ---------------------------------------------------------------------------------
  const CALL = (code) => ('XDE'.includes(code) ? 'X' : 'B*HVIP'.includes(code[0]) ? 'B' : 'S')
  function dot(fb, x, y, label, fill, ink) {
    const R = [[-2, 2], [-3, 3], [-4, 4], [-4, 4], [-4, 4], [-4, 4], [-4, 4], [-3, 3], [-2, 2]]
    x = Math.round(x); y = Math.round(y)
    for (let j = 0; j < 9; j++) for (let i = R[j][0] - 1; i <= R[j][1] + 1; i++) put(fb, x + i, y - 4 + j, C.ink)
    put(fb, x - 3, y - 5, C.ink); put(fb, x + 3, y - 5, C.ink); for (let i = -2; i <= 2; i++) { put(fb, x + i, y - 5, C.ink); put(fb, x + i, y + 5, C.ink) }
    for (let j = 0; j < 9; j++) for (let i = R[j][0]; i <= R[j][1]; i++) put(fb, x + i, y - 4 + j, fill)
    text(fb, label, x - 1, y - 2, ink)
  }

  // ---- The concept -------------------------------------------------------------------------------------
  GD.register({
    id: 'sprites', name: '16-bit sprites', camera: 'cut', dims: '2D',
    look: 'Square pixels and a 30-colour palette, like a Super Nintendo or Game Boy Advance baseball game.',
    notes: [
      'The pitch view is drawn like a Mode 7 field, the same way 16-bit games drew a floor in depth.',
      'On contact the slot cuts to a high fielding view that scrolls with the ball. The ball floats over its shadow, so its height reads at a glance.',
      'Figures are the engine skeleton drawn as chunky sprites with an ink outline. The catcher is see-through, so the zone stays clear.',
      'Size and spacing are exaggerated in the fielding view, as the old games did, so a fielder still reads on a phone.',
    ],
    // Round 2: `opts.palette` maps each of the 29 slots in HEX to a colour (from the stage tokens). The scene
    // is drawn in the base palette and every pixel is swapped on the way out, as 16-bit hardware swapped a
    // palette: every pixel is exactly one slot, so nothing else changes.
    slots: Object.keys(HEX),
    create(canvas, opts = {}) {
      const g = canvas.getContext('2d')
      const cache = {}
      const swap = opts.palette ? new Map(Object.keys(HEX).map((k) => [C[k] >>> 0, packHex(opts.palette[k] || HEX[k]) >>> 0])) : null
      const low = document.createElement('canvas'), lg = low.getContext('2d')
      return {
        destroy() {},
        draw(st, W, H) {
          const scale = Math.max(1, Math.round(W / 256)), w = Math.ceil(W / scale), h = Math.ceil(H / scale)
          const key = w + 'x' + h
          if (!cache[key]) cache[key] = {}
          const K = cache[key]
          const L = st.L, T = L.t
          const fb = K.fb || (K.fb = makeBuf(w, h))
          ZONES = opts.zones || null
          const cut = L.ball && st.t >= T.contactEnd
          if (!cut) drawPitchView(fb, K, st, w, h)
          else drawFieldView(fb, K, st, w, h)
          if (low.width !== w || low.height !== h) { low.width = w; low.height = h }
          let img = fb.img
          if (swap) {
            const o = K.out || (K.out = makeBuf(w, h))
            for (let i = 0; i < fb.px.length; i++) o.px[i] = swap.get(fb.px[i]) ?? fb.px[i]
            img = o.img
          }
          lg.putImageData(img, 0, 0)
          g.imageSmoothingEnabled = false
          g.drawImage(low, 0, 0, w * scale, h * scale)
        },
      }
    },
  })

  let ZONES = null
  function homeCam(w, h) { return GD.CAMS.home(w / h) }

  function drawPitchView(fb, K, st, w, h) {
    const cam = homeCam(w, h), L = st.L, T = L.t
    if (!K.pitch) K.pitch = pitchBg(w, h, cam)
    fb.px.set(K.pitch.px)
    const P = (p) => GD.project(cam, p, w, h)
    // fielders, far to near; the umpire stays out of this view so the zone is clear
    const order = Object.keys(st.fielders).filter((k) => k !== 'P' && k !== 'C').sort((a, b) => P(st.fielders[b]).d - P(st.fielders[a]).d)
    for (const k of order) figure(fb, cam, fielderJoints(st.fielders[k]), FIELDER, { minR: 0.5 })
    // runners standing on their bases before the pitch
    for (const r of st.runners) if (!r.batter && !r.gone) {
      const p = P(r.pos); if (p) sprite(fb, SPR.stand, p.x, p.y, ROAD_KIT)
    }
    figure(fb, cam, st.pitcher, PITCHER, { minR: 0.6 })
    // the strike zone at the front of the plate: a light dotted frame
    const zt = L.last.szTop, zb = L.last.szBot, y = 17 / 12
    // Round 2: the zone map at rest (opts.zones: zone '01'..'09' -> temp), nine cells tinted on a 50% dither,
    // zone 1 top-left as the catcher sees it. Drawn only before the tap (the at-bat is sealed).
    if (ZONES && st.t === 0) {
      const TEMP = { cold: C.zoneCold, cool: C.zoneCool, lukewarm: C.zoneLuke, warm: C.zoneWarm, hot: C.zoneHot }
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const z = ZONES[String(r * 3 + c + 1).padStart(2, '0')]; if (!z) continue
        const a = P([-0.83 + c * 0.5533, y, zt - r * (zt - zb) / 3]), b = P([-0.83 + (c + 1) * 0.5533, y, zt - (r + 1) * (zt - zb) / 3])
        if (!a || !b) continue
        for (let yy = Math.round(a.y); yy < Math.round(b.y); yy++) for (let xx = Math.round(a.x); xx < Math.round(b.x); xx++) if (((xx + yy) & 1) === 0) put(fb, xx, yy, TEMP[z])
      }
    }
    const c0 = P([-0.83, y, zt]), c1 = P([0.83, y, zb])
    if (c0 && c1) {
      for (let x = Math.round(c0.x); x <= Math.round(c1.x); x++) if (x % 2 === 0) { put(fb, x, Math.round(c0.y), C.chalk); put(fb, x, Math.round(c1.y), C.chalk) }
      for (let yy = Math.round(c0.y); yy <= Math.round(c1.y); yy++) if (yy % 2 === 0) { put(fb, Math.round(c0.x), yy, C.chalk); put(fb, Math.round(c1.x), yy, C.chalk) }
    }
    // the catcher, see-through
    const cj = {}
    for (const k in CATCHER) cj[k] = [CATCHER[k][0], -3.6 + CATCHER[k][1], CATCHER[k][2]]
    // earlier pitches as numbered dots
    const arrived = st.t >= T.pitchEnd
    const n = L.pitches.length
    const shown = arrived ? n : st.dotsShown
    const marks = []
    for (let i = 0; i < shown; i++) {
      const p = L.pitches[i], q = P([p.px, y, p.pz]); if (!q) continue
      const call = CALL(p.code)
      const label = call === 'X' ? 'X' : String(i + 1)
      marks.push([q, label, call === 'B' ? C.chalk : call === 'X' ? C.gold : C.red, call === 'B' ? C.navy : call === 'X' ? C.ink : C.chalk, i === n - 1])
    }
    // the batter, then the ball on top
    figure(fb, cam, st.batter, BATTER(st.play.batter.side), { minR: 0.7 })
    for (const m of marks) dot(fb, m[0].x, m[0].y, m[1], m[2], m[3])
    // the decision pitch in flight, with a short trail
    if (st.pitchPos && st.t < T.pitchEnd) {
      for (let k = 4; k >= 1; k--) {
        const u = st.pitchU - k * 0.035; if (u <= 0) continue
        const q = P(GD.pitchAt(L.last, u)); if (q && k % 2 === 0) put(fb, Math.round(q.x), Math.round(q.y), C.chalk)
      }
      const q = P(st.pitchPos)
      if (q) { const r = Math.max(1, Math.round(q.s * 0.15)); rect(fb, Math.round(q.x - r), Math.round(q.y - r), r * 2, r * 2, C.chalk); put(fb, Math.round(q.x + r - 1), Math.round(q.y + r - 1), C.grey) }
    }
    // contact: a two-frame burst at the bat
    if (L.ball && st.phase === 'contact' && st.t >= T.pitchEnd + 0.1) {
      const q = P(GD.pitchAt(L.last, 1)), f = Math.floor((st.t - T.pitchEnd - 0.1) / 0.04) % 2
      if (q) {
        const R = f ? 7 : 4
        for (let a = 0; a < 8; a++) {
          const dx = Math.cos((a * Math.PI) / 4), dy = Math.sin((a * Math.PI) / 4)
          for (let s = 2; s <= R; s++) put(fb, Math.round(q.x + dx * s), Math.round(q.y + dy * s), s > R - 2 ? C.gold : C.chalk)
        }
        rect(fb, Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 3, C.chalk)
      }
    }
    // the decision pitch's tag
    if (arrived) {
      const p = L.last, q = P([p.px, y, p.pz])
      if (q) {
        const s = `${Math.round(p.mph)} ${p.type || ''} ${CALL(p.code)}`.trim(), tw = textW(s) + 4
        let tx = Math.round(q.x + 8), ty = Math.round(q.y - 4)
        if (tx + tw > w - 2) tx = Math.round(q.x - 8 - tw)
        ty = clamp(ty, 2, h - 9)
        rect(fb, tx, ty, tw, 9, C.ink); rect(fb, tx + 1, ty + 1, tw - 2, 7, C.navy)
        text(fb, s, tx + 2, ty + 2, C.gold)
      }
    }
  }

  function drawFieldView(fb, K, st, w, h) {
    const L = st.L, T = L.t
    const S = w / 210
    if (!K.map) K.map = fieldMap(S, h)
    const M = K.map, mb = M.b
    const ball = st.ballPos
    // centre between the ball and its shadow, so both stay in the slot; a ball past the wall is framed
    // with the wall it cleared
    const bd = Math.hypot(ball[0], ball[1]), bb = (Math.atan2(ball[0], ball[1]) * 180) / Math.PI, wf = GD.wallAt(bb).ft
    const focus = bd > wf ? GD.polar(bb, (bd + wf) / 2) : ball
    const [gx, gy] = M.toMap(focus[0], focus[1], 0)
    const lift = zLift(ball[2]) * S
    let cx = Math.round(gx - w / 2), cy = Math.round(gy - lift / 2 - h * 0.55)
    cx = clamp(cx, 0, mb.w - w); cy = clamp(cy, 0, mb.h - h)
    for (let y = 0; y < h; y++) fb.px.set(mb.px.subarray((cy + y) * mb.w + cx, (cy + y) * mb.w + cx + w), y * w)
    const toScr = (p) => { const [x, y] = M.toMap(p[0], p[1], p[2] || 0); return [x - cx, y - cy] }
    // who moved since a moment ago (a pure look-back, no carried state)
    const prev = GD.stateAt(st.play, Math.max(0, st.t - 0.06))
    const frame = Math.floor(st.t / 0.12) & 1
    const people = []
    for (const k in st.fielders) {
      if (k === 'C') continue
      const p = st.fielders[k], q = prev.fielders[k], moving = Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05
      people.push({ p, rows: moving ? (frame ? SPR.run0 : SPR.run1) : SPR.stand, kit: HOME_KIT, flip: moving && p[0] < q[0] })
    }
    people.push({ p: [0, -3.6, 0], rows: SPR.stand, kit: HOME_KIT })
    people.push({ p: [0.6, -7, 0], rows: SPR.stand, kit: UMP_KIT })
    st.runners.forEach((r, i) => {
      if (r.gone) return
      const q = prev.runners[i], moving = q && Math.hypot(r.pos[0] - q.pos[0], r.pos[1] - q.pos[1]) > 0.05
      people.push({ p: r.pos, rows: moving ? (frame ? SPR.run0 : SPR.run1) : SPR.stand, kit: ROAD_KIT, flip: moving && r.pos[0] < q.pos[0] })
    })
    people.sort((a, b) => b.p[1] - a.p[1])
    // the ball's shadow sits on the ground under it
    const [sx, sy] = toScr([ball[0], ball[1], 0])
    const onDirt = M.b.px[(Math.round(sy + cy)) * mb.w + Math.round(sx + cx)] === C.dirt0 || M.b.px[(Math.round(sy + cy)) * mb.w + Math.round(sx + cx)] === C.dirt1
    const behindWall = Math.abs(GD.polar(0, 0)[0]) >= 0 && Math.hypot(ball[0], ball[1]) > GD.wallAt((Math.atan2(ball[0], ball[1]) * 180) / Math.PI).ft
    if (!behindWall || ball[2] <= 0.5) {
      const sc = onDirt ? C.dirtShadow : C.shadow, X = Math.round(sx), Y = Math.round(sy)
      rect(fb, X - 2, Y - 1, 5, 1, sc); rect(fb, X - 3, Y, 7, 1, sc); rect(fb, X - 2, Y + 1, 5, 1, sc)
    }
    for (const m of people) { const [x, y] = toScr(m.p); sprite(fb, m.rows, x, y + 1, m.kit, m.flip) }
    // the ball: bigger the higher it flies, the old games' way of showing height
    const [bx, by] = toScr(ball)
    const r = ball[2] > 90 ? 3 : ball[2] > 35 ? 2 : 1
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r) put(fb, Math.round(bx) + i, Math.round(by) + j, C.chalk)
    for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) {
      const inside = i * i + j * j <= r * r + r, edge = i * i + j * j <= (r + 1) * (r + 1) + r + 1
      if (!inside && edge) put(fb, Math.round(bx) + i, Math.round(by) + j, C.ink)
    }
    if (r >= 2) put(fb, Math.round(bx) + 1, Math.round(by) + 1, C.red)
    // a ball that came down in the seats gets a gold ring, so it reads against the crowd
    if (st.t >= T.chaseEnd && Math.hypot(ball[0], ball[1]) > GD.wallAt((Math.atan2(ball[0], ball[1]) * 180) / Math.PI).ft) {
      const R = 5 + (Math.floor(st.t / 0.25) & 1)
      for (let a = 0; a < 32; a++) put(fb, Math.round(bx + Math.cos((a * Math.PI) / 16) * R), Math.round(by + Math.sin((a * Math.PI) / 16) * R * 0.8), C.gold)
    }
    // a short trail behind the ball while it is in the air
    if (st.phase === 'chase' && L.ball.kind === 'air') {
      for (let k = 1; k <= 3; k++) {
        const p = L.ball.at(Math.max(0, st.ballT - k * 0.09)), [x, y] = toScr(p)
        if (k !== 2) put(fb, Math.round(x), Math.round(y), C.chalk)
      }
    }
  }
})()
