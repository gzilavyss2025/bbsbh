// Stage concept: BROADCAST FLAT (design round, #2568). Not app code.
// Flat TV-graphics illustration in true perspective. Camera language: TV cuts.
//   1. pitch view behind home  2. at contact, a cut to high home that pans and zooms with the ball
//   3. on a long fly ball, a second cut to a low wall camera near the landing.
// draw(state, W, H) is a pure function of the state: no memory between frames except caches of static art.
;(function () {
  const { v3, clamp, lerp, smooth, polar } = GD

  // ---- Palette --------------------------------------------------------------------------------
  const C = {
    sky: '#86bfe6', skyLow: '#cbe4f4', haze: [203, 228, 244],
    grass: '#3f8d46', grassFoul: '#377d3e', dirt: '#c88a59', dirtDark: '#b47a4c', track: '#b5784b',
    chalk: '#f6f3ea', wall: '#2c5b3d', wallTop: '#1f4630', wallBoard: '#21392b',
    stand: '#3d4352', standTop: '#2b303c', tower: '#5d6470', light: '#f6f1d8',
    // Seattle road grey with navy and teal; Boston home white with red and navy.
    seaJersey: '#bfc4cb', seaPants: '#c8ccd2', seaNavy: '#0c2c56', seaTeal: '#00685e',
    bosJersey: '#f2efe6', bosPants: '#ece8dd', bosNavy: '#0d2b56', bosRed: '#bd3039',
    ump: '#1c2330', umpPants: '#4a505e', shoe: '#1a1d24', bat: '#dfbf88', batEnd: '#b38a50',
    ball: '#fffdf6', shadow: 'rgba(16,40,22,0.28)',
    hud: 'rgba(11,27,51,0.92)', hudLine: 'rgba(255,255,255,0.18)',
    callBall: '#2e9a57', callStrike: '#d8433a', callPlay: '#2b6fd6',
  }
  const SKIN = ['#c99272', '#8d5b3d', '#e2b48f', '#6e4631', '#b07a55']
  const skinOf = (name) => SKIN[[...(name || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % SKIN.length]
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const RGB = {}
  // Atmospheric fade: mix toward the horizon haze with depth (ft).
  function haze(hex, d, max = 0.42) {
    const c = RGB[hex] || (RGB[hex] = rgb(hex)), f = clamp((d - 140) / 1100, 0, max)
    return `rgb(${Math.round(lerp(c[0], C.haze[0], f))},${Math.round(lerp(c[1], C.haze[1], f))},${Math.round(lerp(c[2], C.haze[2], f))})`
  }

  // ---- Camera space, near clipping, projection ----------------------------------------------------
  const NEAR = 1
  function toCam(cam, p) { const q = v3.sub(p, cam.pos); return [v3.dot(q, cam.r), v3.dot(q, cam.u), v3.dot(q, cam.f)] }
  function clipNear(pts) {
    const out = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ia = a[2] >= NEAR, ib = b[2] >= NEAR
      if (ia) out.push(a)
      if (ia !== ib) { const u = (NEAR - a[2]) / (b[2] - a[2]); out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u), NEAR]) }
    }
    return out
  }
  const scr = (cam, c, W, H) => { const h = H / 2; return [W / 2 + (c[0] * cam.k / c[2]) * h, H / 2 - (c[1] * cam.k / c[2]) * h] }
  // Trace a world polygon (clipped) into the current path. Returns the mean depth, or -1 when off.
  function trace(g, cam, pts, W, H) {
    const c = clipNear(pts.map((p) => toCam(cam, p)))
    if (c.length < 3) return -1
    let d = 0
    c.forEach((q, i) => { const s = scr(cam, q, W, H); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); d += q[2] })
    g.closePath()
    return d / c.length
  }
  function fillPoly(g, cam, pts, W, H, col, fade = true) {
    g.beginPath()
    const d = trace(g, cam, pts, W, H)
    if (d < 0) return -1
    g.fillStyle = fade && typeof col === 'string' && col[0] === '#' ? haze(col, d) : col
    g.fill()
    return d
  }
  const P = (cam, p, W, H) => GD.project(cam, p, W, H)

  // ---- Static world geometry (built once) -------------------------------------------------------------
  const arc = (c, r, a0, a1, n, z = 0) => Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n); return [c[0] + r * Math.sin(a), c[1] + r * Math.cos(a), z] })
  const disc = (c, r, n = 20, z = 0) => arc(c, r, 0, 2 * Math.PI, n, z).slice(0, n)
  const WL = GD.wallLine(46)
  const inner = (off) => WL.map((w) => polar(w.deg, GD.wallAt(w.deg).ft - off))
  const FAIR = [[0, 0, 0], ...inner(0)]
  const GRASS_FAIR = [[0, 0, 0], ...inner(15)]
  const TRACK = [...WL.map((w) => w.foot), ...inner(15).reverse()]
  const DIRT = [[0, 0, 0], [90.2, 90.2, 0], ...arc([0, 60.5, 0], 95, (71.8 * Math.PI) / 180, (-71.8 * Math.PI) / 180, 18), [-90.2, 90.2, 0]]
  const IG = 59.4, IGC = 63.64
  const INFIELD_GRASS = [[0, IGC - IG, 0], [IG, IGC, 0], [0, IGC + IG, 0], [-IG, IGC, 0]]
  const FOUL_GROUND = [[-900, -260, 0], [900, -260, 0], [900, 900, 0], [-900, 900, 0]]
  // Mowing: two sets of diagonal bands, overlaid, give a checker.
  const BANDS = []
  for (const dir of [1, -1]) {
    for (let k = -14; k < 16; k += 2) {
      const a = k * 30, b = a + 30, L0 = -40, L1 = 520
      // (u, v) → (x, y): u along one diagonal, v along the other.
      const xy = (u, v) => (dir > 0 ? [(u - v) / Math.SQRT2, (u + v) / Math.SQRT2, 0] : [(v - u) / Math.SQRT2, (u + v) / Math.SQRT2, 0])
      BANDS.push([xy(a, L0 - 300), xy(b, L0 - 300), xy(b, L1), xy(a, L1)].map((p) => [p[0], p[1], 0]))
    }
  }
  // Foul lines as thin ground strips, to the wall.
  const strip = (a, b, w) => { const d = v3.norm(v3.sub(b, a)), n = [-d[1] * w / 2, d[0] * w / 2, 0]; return [v3.add(a, n), v3.add(b, n), v3.sub(b, n), v3.sub(a, n)] }
  const FOUL_L = strip([0, 0, 0.01], polar(-45, GD.wallAt(-45).ft, 0.01), 0.35)
  const FOUL_R = strip([0, 0, 0.01], polar(45, GD.wallAt(45).ft, 0.01), 0.35)
  const B = GD.BASES
  const BASE_PATHS = [strip(B.home, B['1B'], 6), strip(B['1B'], B['2B'], 6), strip(B['2B'], B['3B'], 6), strip(B['3B'], B.home, 6)]
  const box = (x0) => [[x0, -2.3, 0.02], [x0 + 4 * Math.sign(x0), -2.3, 0.02], [x0 + 4 * Math.sign(x0), 3.7, 0.02], [x0, 3.7, 0.02]]
  const BOXES = [box(-1.25), box(1.25)]
  const PLATE = [[-0.708, 1.417, 0.03], [0.708, 1.417, 0.03], [0.708, 0.708, 0.03], [0, 0, 0.03], [-0.708, 0.708, 0.03]]
  const baseSq = (c) => [[c[0], c[1] - 1.06, 0.15], [c[0] + 1.06, c[1], 0.15], [c[0], c[1] + 1.06, 0.15], [c[0] - 1.06, c[1], 0.15]]
  // Stands: a rake from the wall top back and up; the Monster seats sit on the Monster.
  const STANDS = []
  for (let i = 0; i < WL.length - 1; i++) {
    const a = WL[i], b = WL[i + 1], wa = GD.wallAt(a.deg), wb = GD.wallAt(b.deg)
    const back = (w, deg) => polar(deg, w.ft + 110, w.h + 58)
    STANDS.push({ pts: [a.top, b.top, back(wb, b.deg), back(wa, a.deg)], roof: [back(wa, a.deg), back(wb, b.deg), polar(b.deg, wb.ft + 118, wb.h + 66), polar(a.deg, wa.ft + 118, wa.h + 66)] })
  }
  // Grandstands behind foul ground, from near the dugouts to the poles.
  const GRAND = []
  for (const sgn of [-1, 1]) {
    const d = polar(45 * sgn, 1), n = [d[1] * sgn, -d[0] * sgn, 0]
    const at = (along, off, z) => [d[0] * along + n[0] * off, d[1] * along + n[1] * off, z]
    const end = GD.wallAt(45 * sgn).ft
    for (let a = 30; a < end; a += 40) {
      const b = Math.min(end, a + 40)
      GRAND.push({ pts: [at(a, 48, 4), at(b, 48, 4), at(b, 150, 62), at(a, 150, 62)], roof: [at(a, 150, 62), at(b, 150, 62), at(b, 158, 70), at(a, 158, 70)], face: [at(a, 48, 0), at(b, 48, 0), at(b, 48, 4), at(a, 48, 4)] })
    }
  }
  const WALLS = []
  for (let i = 0; i < WL.length - 1; i++) WALLS.push({ pts: [WL[i].foot, WL[i + 1].foot, WL[i + 1].top, WL[i].top], deg: WL[i].deg, h: WL[i].h })
  const TOWERS = [-32, -8, 18, 40].map((deg) => { const w = GD.wallAt(deg); return { base: polar(deg, w.ft + 150, w.h + 40), top: polar(deg, w.ft + 150, 175), deg } })

  // A flat crowd: dots of shirt colours on a dark rake, made once as a pattern.
  let crowdPat = null
  function crowd(g) {
    if (crowdPat) return crowdPat
    const c = document.createElement('canvas'); c.width = 48; c.height = 24
    const x = c.getContext('2d'); x.fillStyle = C.stand; x.fillRect(0, 0, 48, 24)
    const cols = ['#bd3039', '#e8e3d6', '#0d2b56', '#6a7280', '#c9a66b', '#8a3a3a', '#d9d4c6', '#2f5f8f']
    let s = 7
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    for (let y = 1; y < 24; y += 4) for (let xx = (y % 8 === 1 ? 0 : 2); xx < 48; xx += 4) { x.fillStyle = cols[Math.floor(rnd() * cols.length)]; x.fillRect(xx + rnd(), y, 2.2, 2.6) }
    crowdPat = g.createPattern(c, 'repeat')
    return crowdPat
  }

  // ---- Figures ------------------------------------------------------------------------------------
  // Each figure is a list of parts; parts from every figure are sorted far to near.
  const KIT = {
    sea: { jersey: C.seaJersey, pants: C.seaPants, cap: C.seaNavy, trim: C.seaTeal, sock: C.seaNavy, glove: C.seaNavy },
    bos: { jersey: C.bosJersey, pants: C.bosPants, cap: C.bosNavy, trim: C.bosRed, sock: C.bosRed, glove: '#7a4a24' },
    ump: { jersey: C.ump, pants: C.umpPants, cap: C.ump, trim: C.ump, sock: C.ump, glove: C.ump },
    catcher: { jersey: C.bosNavy, pants: C.bosPants, cap: C.bosNavy, trim: C.bosRed, sock: C.bosRed, glove: '#6b3f1f' },
  }
  function limb(parts, a, b, wFt, col) { parts.push({ k: 'limb', a, b, w: wFt, col }) }
  function figureParts(j, kit, skin, opts = {}) {
    const parts = [], H = j.hands || j.ball
    // legs
    limb(parts, j.lHip, j.lKnee, 0.5, kit.pants); limb(parts, j.rHip, j.rKnee, 0.5, kit.pants)
    limb(parts, j.lKnee, j.lFoot, 0.38, kit.pants); limb(parts, j.rKnee, j.rFoot, 0.38, kit.pants)
    limb(parts, v3.lerp(j.lKnee, j.lFoot, 0.55), j.lFoot, 0.36, kit.sock); limb(parts, v3.lerp(j.rKnee, j.rFoot, 0.55), j.rFoot, 0.36, kit.sock)
    parts.push({ k: 'dot', p: v3.add(j.lFoot, [0, 0, 0.12]), r: 0.3, col: C.shoe }, { k: 'dot', p: v3.add(j.rFoot, [0, 0, 0.12]), r: 0.3, col: C.shoe })
    // torso: shoulders to hips, with a belt
    // A body capsule under the torso, so a figure seen edge-on still has a chest.
    limb(parts, v3.lerp(j.neck, j.pelvis, 0.12), v3.lerp(j.neck, j.pelvis, 0.86), 1.0, kit.jersey)
    parts.push({ k: 'torso', pts: [j.lSho, j.rSho, j.rHip, j.lHip], col: kit.jersey, belt: [j.lHip, j.rHip], beltCol: kit.cap })
    // arms
    if (opts.batter) {
      limb(parts, j.lSho, j.lElb, 0.36, kit.jersey); limb(parts, j.rSho, j.rElb, 0.36, kit.jersey)
      limb(parts, j.lElb, H, 0.28, skin); limb(parts, j.rElb, H, 0.28, skin)
      parts.push({ k: 'dot', p: H, r: 0.22, col: kit.cap })
      parts.push({ k: 'bat', a: H, b: j.batTip })
    } else if (opts.pitcher) {
      limb(parts, j.lSho, j.lElb, 0.36, kit.jersey); limb(parts, j.rSho, j.rElb, 0.36, kit.jersey)
      const glove = v3.add(j.lElb, v3.mul(v3.sub(j.lElb, j.lSho), 0.55))
      limb(parts, j.lElb, glove, 0.27, skin); parts.push({ k: 'dot', p: glove, r: 0.36, col: kit.glove })
      limb(parts, j.rElb, j.ball, 0.27, skin)
    } else {
      limb(parts, j.lSho, j.lElb, 0.36, kit.jersey); limb(parts, j.rSho, j.rElb, 0.36, kit.jersey)
      limb(parts, j.lElb, j.lHand, 0.27, skin); limb(parts, j.rElb, j.rHand, 0.27, skin)
      if (opts.glove) parts.push({ k: 'dot', p: j.lHand, r: opts.mitt ? 0.5 : 0.36, col: kit.glove })
    }
    limb(parts, j.neck, j.head, 0.3, skin)
    parts.push({ k: 'head', p: j.head, r: 0.37, skin, cap: kit.cap, away: opts.away, helmet: opts.helmet, brim: opts.brim })
    return parts
  }
  // Generic bodies in a local frame (x' right, y' forward, z up) placed at `pos`, facing `face` (2D unit).
  function place(local, pos, face) {
    const r = [face[1], -face[0]], o = {}
    for (const k in local) { const p = local[k]; o[k] = [pos[0] + r[0] * p[0] + face[0] * p[1], pos[1] + r[1] * p[0] + face[1] * p[1], (pos[2] || 0) + p[2]] }
    return o
  }
  const READY = { head: [0, 0.35, 5.35], neck: [0, 0.25, 4.95], lSho: [-0.6, 0.15, 4.65], rSho: [0.6, 0.15, 4.65], lElb: [-0.85, 0.6, 3.75], rElb: [0.85, 0.6, 3.75], lHand: [-0.55, 1.1, 3.05], rHand: [0.55, 1.1, 3.05], pelvis: [0, 0, 3.0], lHip: [-0.4, 0, 3.0], rHip: [0.4, 0, 3.0], lKnee: [-0.75, 0.55, 1.65], rKnee: [0.75, 0.55, 1.65], lFoot: [-0.9, 0.1, 0], rFoot: [0.9, 0.1, 0] }
  function runPose(ph) {
    const s = Math.sin(ph), c = Math.cos(ph)
    return { head: [0, 0.7, 5.45], neck: [0, 0.55, 5.05], lSho: [-0.55, 0.4, 4.75], rSho: [0.55, 0.4, 4.75], lElb: [-0.7, -0.6 * s, 3.95], rElb: [0.7, 0.6 * s, 3.95], lHand: [-0.55, 0.5 - 1.0 * s, 3.55], rHand: [0.55, 0.5 + 1.0 * s, 3.55], pelvis: [0, 0, 3.0], lHip: [-0.35, 0, 3.0], rHip: [0.35, 0, 3.0], lKnee: [-0.35, 0.3 + 0.9 * s, 1.75 + 0.35 * Math.max(0, s)], rKnee: [0.35, 0.3 - 0.9 * s, 1.75 + 0.35 * Math.max(0, -s)], lFoot: [-0.35, -0.1 + 1.25 * s, 0.25 + 0.45 * Math.max(0, -c)], rFoot: [0.35, -0.1 - 1.25 * s, 0.25 + 0.45 * Math.max(0, c)] }
  }
  const CROUCH = { head: [0, 0.55, 3.75], neck: [0, 0.4, 3.4], lSho: [-0.65, 0.2, 3.15], rSho: [0.65, 0.2, 3.15], lElb: [-0.95, 0.8, 2.45], rElb: [0.8, 0.6, 2.3], lHand: [-0.45, 1.5, 2.6], rHand: [0.55, 0.8, 1.9], pelvis: [0, -0.3, 1.55], lHip: [-0.45, -0.35, 1.55], rHip: [0.45, -0.35, 1.55], lKnee: [-0.85, 0.75, 1.3], rKnee: [0.85, 0.75, 1.3], lFoot: [-0.75, -0.25, 0], rFoot: [0.75, -0.25, 0] }
  const UMP = { head: [0, 0.75, 4.6], neck: [0, 0.6, 4.2], lSho: [-0.7, 0.35, 3.95], rSho: [0.7, 0.35, 3.95], lElb: [-0.85, 0.6, 3.05], rElb: [0.85, 0.6, 3.05], lHand: [-0.45, 0.85, 2.55], rHand: [0.45, 0.85, 2.55], pelvis: [0, -0.4, 2.4], lHip: [-0.45, -0.4, 2.4], rHip: [0.45, -0.4, 2.4], lKnee: [-0.85, 0.35, 1.45], rKnee: [0.85, 0.35, 1.45], lFoot: [-0.95, -0.35, 0], rFoot: [0.95, -0.35, 0] }

  // Draw one part. Widths scale with depth (px per ft = q.s).
  function drawPart(g, cam, part, W, H) {
    if (part.k === 'limb') {
      const a = P(cam, part.a, W, H), b = P(cam, part.b, W, H)
      if (!a || !b) return
      g.strokeStyle = part.col; g.lineCap = 'round'; g.lineWidth = Math.max(1.2, part.w * (a.s + b.s) / 2)
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke()
    } else if (part.k === 'dot') {
      const a = P(cam, part.p, W, H); if (!a) return
      g.fillStyle = part.col; g.beginPath(); g.arc(a.x, a.y, Math.max(1, part.r * a.s), 0, 7); g.fill()
    } else if (part.k === 'torso') {
      const q = part.pts.map((p) => P(cam, p, W, H)); if (q.some((x) => !x)) return
      const s = q.reduce((a, x) => a + x.s, 0) / 4
      g.fillStyle = part.col; g.strokeStyle = part.col; g.lineJoin = 'round'; g.lineWidth = Math.max(1, 0.42 * s)
      g.beginPath(); q.forEach((x, i) => (i ? g.lineTo(x.x, x.y) : g.moveTo(x.x, x.y))); g.closePath(); g.fill(); g.stroke()
      const b0 = P(cam, part.belt[0], W, H), b1 = P(cam, part.belt[1], W, H)
      if (b0 && b1) { g.strokeStyle = part.beltCol; g.lineWidth = Math.max(1, 0.2 * s); g.beginPath(); g.moveTo(b0.x, b0.y); g.lineTo(b1.x, b1.y); g.stroke() }
    } else if (part.k === 'head') {
      const a = P(cam, part.p, W, H); if (!a) return
      const r = Math.max(1.5, part.r * a.s)
      g.fillStyle = part.skin; g.beginPath(); g.arc(a.x, a.y, r, 0, 7); g.fill()
      g.fillStyle = part.cap
      g.beginPath()
      if (part.away) g.arc(a.x, a.y - r * 0.05, r * 1.08, Math.PI * 0.82, Math.PI * 2.18)
      else g.arc(a.x, a.y - r * 0.12, r * 1.06, Math.PI * 1.02, Math.PI * 1.98)
      g.closePath(); g.fill()
      if (part.brim) { g.beginPath(); g.ellipse(a.x + part.brim * r * 0.55, a.y - r * 0.2, r * 0.75, r * 0.22, 0, 0, 7); g.fill() }
    } else if (part.k === 'bat') {
      const a = P(cam, part.a, W, H), b = P(cam, part.b, W, H); if (!a || !b) return
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l
      const w0 = Math.max(0.8, 0.06 * a.s), w1 = Math.max(1.6, 0.11 * b.s)
      g.fillStyle = C.bat; g.beginPath()
      g.moveTo(a.x + nx * w0, a.y + ny * w0); g.lineTo(b.x + nx * w1, b.y + ny * w1); g.lineTo(b.x - nx * w1, b.y - ny * w1); g.lineTo(a.x - nx * w0, a.y - ny * w0); g.closePath(); g.fill()
      g.fillStyle = C.batEnd; g.beginPath(); g.arc(b.x, b.y, w1, 0, 7); g.fill()
    }
  }
  const partDepth = (cam, part) => {
    const p = part.k === 'limb' || part.k === 'bat' ? v3.lerp(part.a, part.b, 0.5) : part.k === 'torso' ? v3.lerp(part.pts[0], part.pts[2], 0.5) : part.p
    return v3.dot(v3.sub(p, cam.pos), cam.f)
  }

  // ---- The batted ball, with the wall and the seats -------------------------------------------------
  // The engine's flight runs through the wall; here a ball that reaches the wall below its top hits it and
  // drops back, and a ball over the wall stops where it meets the rake of the seats. (Local; see report.)
  const ballCache = new Map()
  function ballInfo(L) {
    if (ballCache.has(L.play.ab)) return ballCache.get(L.play.ab)
    const b = L.ball, w = GD.wallAt(b.bearing)
    let tHit = null, hit = null, tSeat = null, seat = null, apexT = 0, apexZ = -1
    for (let t = 0; t <= b.T + 1e-9; t += 0.01) {
      const p = b.at(t), s = Math.hypot(p[0], p[1])
      if (p[2] > apexZ) { apexZ = p[2]; apexT = t }
      if (b.kind === 'air' && s >= w.ft - 0.6) {
        if (p[2] < w.h && tHit == null && tSeat == null) { tHit = t; hit = polar(b.bearing, w.ft - 0.6, p[2]); break }
        const rake = w.h + Math.max(0, s - w.ft) * (58 / 110)
        if (p[2] <= rake && s > w.ft && tSeat == null) { tSeat = t; seat = [p[0], p[1], rake]; break }
      }
    }
    const info = { tHit, hit, tSeat, seat, apexT, apexZ, w, long: b.kind === 'air' && (b.dist >= 280 || tSeat != null) }
    ballCache.set(L.play.ab, info)
    return info
  }
  function ballAt(L, bt) {
    const I = ballInfo(L)
    if (I.tHit != null && bt > I.tHit) { // off the wall: back toward home, falling
      const u = bt - I.tHit, back = Math.min(u * 22, 40)
      const s = GD.wallAt(L.ball.bearing).ft - 0.6 - back
      return polar(L.ball.bearing, s, Math.max(0, I.hit[2] + 6 * u - 16.1 * u * u))
    }
    if (I.tSeat != null && bt > I.tSeat) return I.seat
    return L.ball.at(bt)
  }

  // ---- Cameras: TV cuts ----------------------------------------------------------------------------
  function pickCam(st, W, H) {
    const L = st.L, T = L.t, aspect = W / H
    const home = GD.camera([0, -27, 10.2], [0, 36, -1.6], GD.vfovFor(22, 11, aspect))
    if (!L.ball || st.t < T.contactEnd) return { cam: home, view: 'home' }
    const I = ballInfo(L), bt = st.ballT, b = ballAt(L, bt)
    const settle = st.phase === 'settle' || st.phase === 'result'
    // 3. The wall camera on a long fly ball, once the ball starts down.
    if (I.long && (bt >= Math.max(I.apexT, L.ball.T * 0.42) || settle)) {
      const deg = L.ball.bearing, side = deg < 0 ? 1 : -1, w = I.w
      const pos = polar(deg + side * 30, Math.min(w.ft * 0.6, 220), 16)
      const aim = polar(deg, Math.min(L.ball.dist, w.ft), Math.min(w.h, 30) * 0.6 + 14)
      // Let the frame drift with the ball a little, so it is not a locked shot.
      const tgt = v3.lerp(aim, [b[0], b[1], b[2] * 0.8], settle ? 0.15 : 0.5)
      return { cam: GD.camera(pos, tgt, GD.vfovFor(40, 24, aspect)), view: 'wall' }
    }
    // 2. High home: fixed position, pans and zooms to keep the ball (and its shadow) in frame.
    const pos = [0, -165, 108]
    const fielder = L.fielder && st.fielders[L.fielder]
    const end = L.ball.kind === 'ground' && settle && fielder ? fielder : b
    const follow = smooth(clamp(bt / 0.9, 0, 1))
    const aimPt = [end[0], end[1], end[2] * 0.55]
    const tgt = v3.lerp([0, 150, 0], aimPt, follow * 0.9)
    const dist = v3.len(v3.sub(tgt, pos))
    const flat = Math.hypot(end[0], end[1])
    const halfFt = Math.max(55, end[2] * 0.55 + 40, flat * 0.22 + 30)
    const zoomV = clamp((2 * Math.atan(halfFt / dist) * 180) / Math.PI, 14, 50)
    const vfov = lerp(46, zoomV, follow)
    return { cam: GD.camera(pos, tgt, GD.vfovFor(vfov, vfov * 0.62, aspect)), view: 'high' }
  }

  // ---- Draw --------------------------------------------------------------------------------------------
  function create(canvas) {
    const g = canvas.getContext('2d')
    function draw(st, W, H) {
      const L = st.L, T = L.t
      const { cam, view } = pickCam(st, W, H)
      const unit = Math.min(W, H) / 300
      // Sky: two flat bands split at the horizon.
      const hz = P(cam, v3.add(cam.pos, [cam.f[0] * 5000, cam.f[1] * 5000, 0]), W, H)
      const hy = hz ? clamp(hz.y, -H, 2 * H) : H / 2
      const sky = g.createLinearGradient(0, hy - H * 0.9, 0, hy)
      sky.addColorStop(0, C.sky); sky.addColorStop(1, C.skyLow)
      g.fillStyle = sky; g.fillRect(0, 0, W, H)

      // Far ground, light towers, seats, wall.
      fillPoly(g, cam, FOUL_GROUND, W, H, C.grassFoul)
      for (const tw of TOWERS) {
        const a = P(cam, tw.base, W, H), b = P(cam, tw.top, W, H)
        if (!a || !b) continue
        g.strokeStyle = haze(C.tower, a.d); g.lineWidth = Math.max(1, 2.2 * b.s); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke()
        const bw = 14 * b.s, bh = 8 * b.s
        g.fillStyle = haze(C.tower, b.d); g.fillRect(b.x - bw / 2 - 1, b.y - bh, bw + 2, bh + 1)
        g.fillStyle = C.light
        for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) g.fillRect(b.x - bw / 2 + (i + 0.15) * bw / 4, b.y - bh + (k + 0.2) * bh / 2, bw / 4 * 0.7, bh / 2 * 0.6)
      }
      const pat = crowd(g)
      const sorted = (arr, get) => arr.map((o) => ({ o, d: v3.dot(v3.sub(get(o), cam.pos), cam.f) })).sort((a, b) => b.d - a.d)
      for (const { o } of sorted(STANDS, (o) => v3.lerp(o.pts[0], o.pts[2], 0.5))) {
        g.beginPath(); const d = trace(g, cam, o.pts, W, H)
        if (d > 0) { g.fillStyle = pat; g.fill(); g.fillStyle = `rgba(${C.haze.join(',')},${clamp((d - 140) / 1100, 0, 0.4)})`; g.fill() }
        fillPoly(g, cam, o.roof, W, H, C.standTop)
      }
      for (const { o } of sorted(GRAND, (o) => v3.lerp(o.pts[0], o.pts[2], 0.5))) {
        fillPoly(g, cam, o.face, W, H, C.wallTop)
        g.beginPath(); const d = trace(g, cam, o.pts, W, H)
        if (d > 0) { g.fillStyle = pat; g.fill(); g.fillStyle = `rgba(${C.haze.join(',')},${clamp((d - 140) / 1100, 0, 0.4)})`; g.fill() }
        fillPoly(g, cam, o.roof, W, H, C.standTop)
      }
      for (const { o } of sorted(WALLS, (o) => v3.lerp(o.pts[0], o.pts[2], 0.5))) {
        const d = fillPoly(g, cam, o.pts, W, H, o.h > 30 ? C.wall : C.wallTop)
        if (d > 0 && o.h > 30 && o.deg > -36 && o.deg < -26) { // the Monster's hand-turned scoreboard
          const at = (deg, z) => polar(deg, GD.wallAt(deg).ft - 0.2, z)
          fillPoly(g, cam, [at(o.deg, 12), at(o.deg + 2, 12), at(o.deg + 2, 21), at(o.deg, 21)], W, H, C.wallBoard)
          for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
            const d0 = o.deg + 0.2 + c * 0.45, z0 = 13.5 + r * 4
            fillPoly(g, cam, [at(d0, z0), at(d0 + 0.3, z0), at(d0 + 0.3, z0 + 2.4), at(d0, z0 + 2.4)], W, H, '#e9e6da')
          }
        }
      }
      // Wall cap line.
      g.strokeStyle = haze(C.wallTop, 300); g.lineWidth = Math.max(1, unit * 1.2); g.beginPath()
      let on = false
      for (const w of WL) { const q = P(cam, w.top, W, H); if (!q) { on = false; continue } on ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); on = true }
      g.stroke()

      // The field.
      fillPoly(g, cam, FAIR, W, H, C.track)
      g.save(); g.beginPath()
      if (trace(g, cam, GRASS_FAIR, W, H) > 0) {
        g.fillStyle = C.grass; g.fill(); g.clip()
        g.fillStyle = 'rgba(255,255,255,0.055)'
        for (const band of BANDS) { g.beginPath(); if (trace(g, cam, band, W, H) > 0) g.fill() }
      }
      g.restore()
      fillPoly(g, cam, DIRT, W, H, C.dirt)
      fillPoly(g, cam, INFIELD_GRASS, W, H, C.grass)
      g.save(); g.beginPath(); if (trace(g, cam, INFIELD_GRASS, W, H) > 0) { g.clip(); g.fillStyle = 'rgba(255,255,255,0.055)'; for (const band of BANDS) { g.beginPath(); if (trace(g, cam, band, W, H) > 0) g.fill() } } g.restore()
      for (const bp of BASE_PATHS) fillPoly(g, cam, bp, W, H, C.dirt)
      fillPoly(g, cam, disc([0, 0.6, 0], 13, 24), W, H, C.dirt)
      for (const k of ['1B', '2B', '3B']) fillPoly(g, cam, disc(B[k], 7, 14), W, H, C.dirt)
      fillPoly(g, cam, disc([0, 59.5, 0], 9.5, 22), W, H, C.dirtDark)
      fillPoly(g, cam, disc([0, 59.5, 0.8], 8.2, 22, 0.8), W, H, C.dirt)
      fillPoly(g, cam, [[-1, 60.3, 0.82], [1, 60.3, 0.82], [1, 60.8, 0.82], [-1, 60.8, 0.82]], W, H, C.chalk, false)
      fillPoly(g, cam, FOUL_L, W, H, C.chalk); fillPoly(g, cam, FOUL_R, W, H, C.chalk)
      for (const bx of BOXES) {
        const c = P(cam, v3.lerp(bx[0], bx[2], 0.5), W, H)
        g.beginPath(); if (trace(g, cam, bx, W, H) > 0) { g.strokeStyle = C.chalk; g.lineWidth = Math.max(0.8, 0.28 * (c ? c.s : 1)); g.stroke() }
      }
      fillPoly(g, cam, PLATE, W, H, C.chalk, false)
      for (const k of ['1B', '2B', '3B']) fillPoly(g, cam, baseSq(B[k]), W, H, C.chalk, false)

      // Shadows under people and the ball.
      const shadowAt = (p, r) => { const q = P(cam, [p[0], p[1], 0.05], W, H); if (!q) return; g.fillStyle = C.shadow; g.beginPath(); g.ellipse(q.x, q.y, r * q.s, r * q.s * 0.32, 0, 0, 7); g.fill() }

      // People.
      const parts = []
      // The batter becomes a runner once he leaves the box: after contact, or on a walk.
      const walks = !L.ball && L.play.runners.some((r) => r.start == null && !r.out)
      const runnerOn = (L.ball || walks) && st.t >= T.contactEnd + 0.3
      const batterAway = view === 'home'
      if (!runnerOn) {
        const sideSign = L.play.batter.side === 'L' ? -1 : 1
        parts.push(...figureParts(st.batter, KIT.sea, skinOf(L.play.batter.name), { batter: true, away: batterAway, helmet: true, brim: sideSign }))
        shadowAt(st.batter.pelvis, 1.6)
      }
      parts.push(...figureParts(st.pitcher, KIT.bos, skinOf(L.play.pitcher.name), { pitcher: true, away: false }))
      shadowAt(st.pitcher.pelvis, 1.6)
      if (st.t < T.windupEnd + 0.02) parts.push({ k: 'dot', p: st.pitcher.ball, r: 0.13, col: C.ball })
      const toHome = (p) => { const d = Math.hypot(p[0], p[1]) || 1; return [-p[0] / d, -p[1] / d] }
      for (const k of ['1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF']) {
        const at = st.fielders[k], from = GD.POS[k], mv = Math.hypot(at[0] - from[0], at[1] - from[1])
        const running = mv > 0.6 && st.phase !== 'result'
        const face = running ? [(at[0] - from[0]) / mv, (at[1] - from[1]) / mv] : toHome(at)
        const local = running ? runPose(st.t * 11 + k.length) : READY
        const j = place(local, at, face)
        parts.push(...figureParts(j, KIT.bos, skinOf(k + 'f'), { glove: true, away: v3.dot([face[0], face[1], 0], cam.f) > 0.2 }))
        shadowAt(at, 1.5)
      }
      // The catcher and the umpire sit on the camera's line to the zone, so the pitch view leaves them
      // out (as MLB Gameday's pitch view does); the other cameras show them.
      if (view !== 'home') parts.push(...figureParts(place(CROUCH, [0, -3.4, 0], [0, 1]), KIT.catcher, skinOf('catcher'), { glove: true, mitt: true, away: true }))
      if (view !== 'home') parts.push(...figureParts(place(UMP, [L.play.batter.side === 'L' ? 1.3 : -1.3, -6.6, 0], [0, 1]), KIT.ump, skinOf('ump'), { away: true }))
      for (const r of st.runners) {
        if (r.gone || (r.batter && !runnerOn)) continue // a strikeout leaves no runner
        const dir = runDir(r.pos)
        const moving = st.phase === 'chase' || st.phase === 'settle'
        const j = place(moving ? runPose(st.t * 12 + r.name.length) : READY, r.pos, dir)
        parts.push(...figureParts(j, KIT.sea, skinOf(r.name), { away: v3.dot([dir[0], dir[1], 0], cam.f) > 0.2, helmet: true }))
        shadowAt(r.pos, 1.4)
      }
      parts.map((p) => ({ p, d: partDepth(cam, p) })).sort((a, b) => b.d - a.d).forEach(({ p }) => drawPart(g, cam, p, W, H))

      // Graphics layer: zone, pitch dots, ball, flash, tag, mini-map.
      if (view === 'home') drawZone(g, cam, st, W, H, unit)
      drawBall(g, cam, st, W, H, unit, view)
      if (st.phase === 'contact' && L.ball) {
        const sw = v3.lerp(st.batter.hands, st.batter.batTip, 0.72), q = P(cam, sw, W, H)
        const u = clamp((st.t - T.pitchEnd) / (T.contactEnd - T.pitchEnd), 0, 1)
        if (q) {
          g.strokeStyle = `rgba(255,255,255,${1 - u})`; g.lineWidth = Math.max(1, (1 - u) * 0.5 * q.s + unit)
          g.beginPath(); g.arc(q.x, q.y, (0.5 + 2.6 * u) * q.s, 0, 7); g.stroke()
          g.fillStyle = `rgba(255,255,255,${0.7 * (1 - u)})`; g.beginPath(); g.arc(q.x, q.y, 0.45 * q.s * (1 - u) + unit, 0, 7); g.fill()
        }
      }
      if (view === 'home' && st.t >= T.pitchEnd) drawTag(g, cam, st, W, H, unit)
      if (L.ball && (st.phase === 'chase' || st.phase === 'settle')) drawMiniMap(g, st, W, H, unit)
    }
    return { draw, destroy() {} }
  }

  // Runners face along the base path toward the next base.
  function runDir(p) {
    const order = [GD.BASES.home, GD.BASES['1B'], GD.BASES['2B'], GD.BASES['3B'], GD.BASES.home]
    let best = 0, bd = 1e9
    for (let i = 0; i < 4; i++) {
      const a = order[i], b = order[i + 1], ab = v3.sub(b, a), u = clamp(v3.dot(v3.sub(p, a), ab) / v3.dot(ab, ab), 0, 1)
      const d = v3.len(v3.sub(p, v3.add(a, v3.mul(ab, u))))
      if (d < bd - 0.01 && u < 0.999) { bd = d; best = i }
    }
    const d = v3.norm(v3.sub(order[best + 1], order[best]))
    return [d[0], d[1]]
  }

  const callOf = (code) => ('XDE'.includes(code) ? 'X' : code === 'B' || code === '*B' || code === 'P' || code === 'I' || code === 'V' || code === 'H' ? 'B' : 'S')
  const callCol = (c) => (c === 'X' ? C.callPlay : c === 'B' ? C.callBall : C.callStrike)
  const FONT = "'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif"

  function drawZone(g, cam, st, W, H, unit) {
    const L = st.L, zt = L.last.szTop, zb = L.last.szBot, y = 1.42, x = 0.83
    const c = [[-x, y, zt], [x, y, zt], [x, y, zb], [-x, y, zb]].map((p) => P(cam, p, W, H))
    if (c.some((q) => !q)) return
    const arm = Math.min(c[1].x - c[0].x, c[3].y - c[0].y) * 0.24
    g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = Math.max(1.5, unit * 1.6); g.lineCap = 'square'
    const corner = (q, sx, sy) => { g.beginPath(); g.moveTo(q.x + sx * arm, q.y); g.lineTo(q.x, q.y); g.lineTo(q.x, q.y + sy * arm); g.stroke() }
    corner(c[0], 1, 1); corner(c[1], -1, 1); corner(c[2], -1, -1); corner(c[3], 1, -1)
    // Earlier pitches, numbered; the decision pitch once it has crossed.
    const n = st.dotsShown + (st.t >= L.t.pitchEnd ? 1 : 0)
    for (let i = 0; i < n && i < L.pitches.length; i++) {
      const p = L.pitches[i], q = P(cam, [p.px, y, p.pz], W, H); if (!q) continue
      const call = callOf(p.code), last = i === L.pitches.length - 1
      const r = Math.max(5.5 * unit, 0.16 * q.s)
      g.fillStyle = callCol(call); g.beginPath(); g.arc(q.x, q.y, r, 0, 7); g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = Math.max(1, unit * (last ? 1.4 : 0.8)); g.stroke()
      g.fillStyle = '#fff'; g.font = `${Math.round(r * 1.25)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(last && call === 'X' ? 'X' : String(i + 1), q.x, q.y + r * 0.06)
    }
  }

  function drawBall(g, cam, st, W, H, unit, view) {
    const L = st.L, T = L.t
    let pts = []
    if (st.pitchPos && st.t < T.pitchEnd) {
      for (let k = 0; k <= 8; k++) pts.push(GD.pitchAt(L.last, clamp(st.pitchU - 0.22 * (k / 8), 0, 1)))
    } else if (L.ball && st.t >= T.contactEnd) {
      const bt = st.ballT, I = ballInfo(L), stop = I.tSeat ?? I.tHit ?? L.ball.T
      const moving = bt < stop - 0.01 && st.phase === 'chase'
      for (let k = 0; k <= 8; k++) pts.push(ballAt(L, Math.max(0, bt - (moving ? 0.28 * (k / 8) : 0))))
      const q0 = pts[0], s = P(cam, [q0[0], q0[1], 0.05], W, H)
      if (s && q0[2] > 0.3 && view !== 'home') { g.fillStyle = 'rgba(10,30,15,0.35)'; g.beginPath(); g.ellipse(s.x, s.y, Math.max(1.5 * unit, 0.5 * s.s), Math.max(0.6 * unit, 0.17 * s.s), 0, 0, 7); g.fill() }
    } else if (st.t >= T.pitchEnd && st.t < T.contactEnd && L.ball) pts = [GD.pitchAt(L.last, 1)]
    if (!pts.length) return
    const qs = pts.map((p) => P(cam, p, W, H))
    const head = qs[0]; if (!head) return
    const r = Math.max((view === 'home' ? 2.4 : 3.1) * unit, 0.13 * head.s)
    // Soft motion trail.
    for (let k = qs.length - 1; k >= 1; k--) {
      const a = qs[k], b = qs[k - 1]; if (!a || !b) continue
      g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k / qs.length)})`; g.lineCap = 'round'; g.lineWidth = r * 2 * (1 - k / (qs.length + 2))
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke()
    }
    g.fillStyle = C.ball; g.strokeStyle = 'rgba(20,30,40,0.55)'; g.lineWidth = Math.max(0.8, unit * 0.7)
    g.beginPath(); g.arc(head.x, head.y, r, 0, 7); g.fill(); g.stroke()
  }

  // The Show 10's pitch tag: mph over the pitch code, and a B/S/X badge, beside the crossing point.
  function drawTag(g, cam, st, W, H, unit) {
    const p = st.L.last, q = P(cam, [p.px, 1.42, p.pz], W, H); if (!q) return
    const call = callOf(p.code), u = clamp((st.t - st.L.t.pitchEnd) / 0.18, 0, 1)
    const w = 30 * unit, h = 30 * unit, side = q.x > W * 0.62 ? -1 : 1
    const x = q.x + side * (Math.max(7 * unit, 0.18 * q.s) + 6 * unit) - (side < 0 ? w : 0), y = q.y - h / 2
    g.globalAlpha = u
    g.fillStyle = C.hud; g.fillRect(x, y, w, h)
    g.fillStyle = callCol(call); g.fillRect(x, y + h - 2.2 * unit, w, 2.2 * unit)
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'
    g.font = `${Math.round(15 * unit)}px ${FONT}`; g.fillText(String(Math.round(p.mph)), x + w / 2, y + 14.5 * unit)
    g.font = `${Math.round(10 * unit)}px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText(p.type || '', x + w / 2, y + 25 * unit)
    const bx = x + (side > 0 ? w + 7 * unit : -7 * unit), by = y + 6 * unit
    g.fillStyle = callCol(call); g.beginPath(); g.arc(bx, by, 6 * unit, 0, 7); g.fill()
    g.fillStyle = '#fff'; g.font = `${Math.round(9.5 * unit)}px ${FONT}`; g.textBaseline = 'middle'; g.fillText(call, bx, by + 0.4 * unit)
    g.globalAlpha = 1
  }

  // The Show 15's corner mini-map: a diamond frame with home at the bottom vertex; the ball is a red dot.
  function drawMiniMap(g, st, W, H, unit) {
    // Top-down, centre field up: the foul lines run along the frame's two lower edges.
    const s = Math.min(W, H) * 0.12, cx = W - s - 10 * unit, cy = 10 * unit + s, sc = (2 * s) / 430
    const m = (p) => [cx + p[0] * sc, cy + s - p[1] * sc]
    // frame: home at the bottom vertex (cx, cy + s)
    g.save()
    g.fillStyle = 'rgba(11,27,51,0.82)'; g.beginPath(); g.moveTo(cx, cy - s - 4 * unit); g.lineTo(cx + s + 4 * unit, cy); g.lineTo(cx, cy + s + 4 * unit); g.lineTo(cx - s - 4 * unit, cy); g.closePath(); g.fill()
    g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s, cy); g.closePath(); g.clip()
    g.fillStyle = '#2f6b3a'; g.beginPath()
    const fan = [[0, 0, 0], ...WL.map((w) => w.foot)].map(m); fan.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill()
    g.fillStyle = '#b98557'; g.beginPath(); const dm = [GD.BASES.home, GD.BASES['1B'], GD.BASES['2B'], GD.BASES['3B']].map(m); dm.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill()
    g.fillStyle = '#fff'
    for (const k of ['1B', '2B', '3B']) { const p = m(GD.BASES[k]); g.fillRect(p[0] - 1.6 * unit, p[1] - 1.6 * unit, 3.2 * unit, 3.2 * unit) }
    g.fillStyle = 'rgba(255,255,255,0.85)'
    for (const k of ['1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'P']) { const p = m(st.fielders[k]); g.beginPath(); g.arc(p[0], p[1], 1.5 * unit, 0, 7); g.fill() }
    g.fillStyle = '#7fd8cf'
    for (const r of st.runners) if (!r.gone) { const p = m(r.pos); g.beginPath(); g.arc(p[0], p[1], 1.7 * unit, 0, 7); g.fill() }
    g.restore()
    const b = ballAt(st.L, st.ballT), p = m(b)
    g.fillStyle = '#e8322b'; g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, unit * 0.8)
    g.beginPath(); g.arc(clamp(p[0], cx - s * 1.1, cx + s * 1.1), clamp(p[1], cy - s * 1.1, cy + s * 1.1), 2.6 * unit, 0, 7); g.fill(); g.stroke()
  }

  GD.register({
    id: 'broadcast',
    name: 'Broadcast flat',
    look: 'Flat TV-graphics illustration in true perspective: mown stripes, chalk, the Green Monster, club kits, a pitch tag like The Show.',
    camera: 'cuts',
    dims: '2D',
    notes: [
      'The pitch view is a TV look from behind the plate, with corner brackets for the zone and numbered pitch dots.',
      'Contact cuts to a high home camera that pans and zooms with the ball, with a mini-map in the corner.',
      'A long fly ball gets a second cut to a low camera near the wall, so a home run clears the Monster into the seats.',
      'A walk or a strikeout stays on the pitch view and ends on the pitch tag.',
    ],
    create,
  })
})()
