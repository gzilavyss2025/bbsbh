// Concept: PAPER DIORAMA. A printed tabletop board seen through the engine camera, with die-cut paper
// standees. One continuous camera: no cut from the pitch view to the chase. Design round, #2568.
// draw() is a pure function of the state; the only caches are static art (the paper tile) and
// per-play constants (where a home run comes to rest in the seats).
;(function () {
  const { v3, clamp, lerp, smooth, ease, project, camera, polar, wallAt, wallLine, BASES, BONES, PBONES } = GD

  // ---- Palette: flat printed paper, few colours ------------------------------------------------
  const C = {
    room: '#3B332D', table: '#6B4A2E', tableEdge: '#4E3420',
    board: '#EAE0C4', grass: '#7E9F5A', stripe: '#75964F', dirt: '#C79A69', track: '#B98C5E', chalk: '#F6F0DF',
    monster: '#2F5A3B', wall: '#3A5A46', wallTop: '#D8CAA4', wallBack: '#27392D', board2: '#1E2E25',
    stands: '#56606C', standsRow: '#454E59', crowd: ['#C8353C', '#1F3A5F', '#A9B4C0', '#E2B33C', '#8C949C', '#7A2E35'],
    sky: '#B9D0D6', cloud: '#EEF2EA', boxEdge: '#8FA9B0', pin: '#C8353C',
    cut: '#FBF8EF', shadow: 'rgba(48,32,18,0.20)', stand: '#3A3835', standTop: '#5C5955',
    ink: '#1B2A3A', label: '#FBF6E9', burst: '#F2C14E', ball: '#FFFFFF', ballEdge: '#9B9488',
    skin: '#B9825A', shoe: '#1B1B1B', bat: '#C9985A', batEnd: '#8E6534', glove: '#8A5A2B',
  }
  const SEA = { jersey: '#A9ADB2', pants: '#A9ADB2', sleeve: '#0C2C56', cap: '#0C2C56', trim: '#005C5C', sock: '#0C2C56' }
  const BOS = { jersey: '#F3EFE4', pants: '#F3EFE4', sleeve: '#0C2340', cap: '#0C2340', trim: '#BD3039', sock: '#BD3039' }
  const FONT = (px) => `600 ${px}px 'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif`

  // ---- Static art: a paper-fibre tile, made once ------------------------------------------------
  let paperTile = null
  function paper() {
    if (paperTile) return paperTile
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d')
    let s = 7
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 1400; i++) {
      const dark = rnd() < 0.55
      g.fillStyle = dark ? `rgba(60,45,25,${0.05 + rnd() * 0.08})` : `rgba(255,252,240,${0.06 + rnd() * 0.1})`
      g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 1.5, 1 + rnd() * 1.5)
    }
    for (let i = 0; i < 70; i++) { // fibres
      const x = rnd() * 128, y = rnd() * 128, a = rnd() * Math.PI, l = 3 + rnd() * 7
      g.strokeStyle = rnd() < 0.5 ? 'rgba(70,50,30,0.10)' : 'rgba(255,250,235,0.14)'
      g.lineWidth = 0.6
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke()
    }
    paperTile = c
    return c
  }

  // ---- Geometry helpers -------------------------------------------------------------------------
  const NEAR = 1.5
  function toCam(cam, p) { const q = v3.sub(p, cam.pos); return [v3.dot(q, cam.r), v3.dot(q, cam.u), v3.dot(q, cam.f)] }
  function scr(cam, c, W, H) { const h = H / 2; return [W / 2 + (c[0] * cam.k / c[2]) * h, H / 2 - (c[1] * cam.k / c[2]) * h] }
  // Sutherland-Hodgman against the near plane, in camera space.
  function clipNear(cs) {
    const out = []
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = cs[(i + 1) % cs.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR
      if (ain) out.push(a)
      if (ain !== bin) { const u = (NEAR - a[2]) / (b[2] - a[2]); out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u), NEAR]) }
    }
    return out
  }
  const ring = (cx, cy, r, n = 28, z = 0) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI), z])

  // ---- Per-play constants: where a ball over the wall comes to rest in the stands -------------------
  const STAND = (h) => (h > 30 ? { depth: 26, rise: 13 } : { depth: 74, rise: 40 })
  function standsZ(deg, r) {
    const w = wallAt(deg), s = STAND(w.h)
    if (r < w.ft + 5) return null
    return w.h + clamp((r - w.ft - 5) / s.depth, 0, 1) * s.rise
  }
  const stopCache = new Map()
  function ballStop(L) {
    if (stopCache.has(L.play.ab)) return stopCache.get(L.play.ab)
    let stop = L.ball ? L.ball.T : 0
    if (L.ball && L.ball.kind === 'air') {
      for (let t = 0; t <= L.ball.T; t += 0.01) {
        const p = L.ball.at(t), r = Math.hypot(p[0], p[1]), z = standsZ(L.ball.bearing, r)
        if (z != null && p[2] <= z + 0.4) { stop = t; break }
      }
    }
    stopCache.set(L.play.ab, stop)
    return stop
  }

  // ---- Camera: one continuous move -------------------------------------------------------------------
  // `a` = W / H: a tall phone stage widens the vertical view so the batter and the plate stay in frame.
  const HOME = (a) => camera([0, -40, 7.0], [0, 24, 3.0], GD.vfovFor(15, 9.5, a))
  const ZONE = (L, a) => { const p = L.last; return camera([p.px * 0.3, -26, 4.8], [p.px * 0.6, 1.4, (p.szTop + p.szBot) / 2 + 0.1], GD.vfovFor(7.5, 3.4, a)) }
  // Widen the field of view until every point fits with a margin. Pure.
  function fit(cam, pts, W, H, base) {
    let need = Math.tan((base * Math.PI) / 360)
    const asp = W / H
    for (const p of pts) {
      const c = toCam(cam, p)
      if (c[2] < 2) continue
      need = Math.max(need, (Math.abs(c[1]) / c[2]) * 1.22, (Math.abs(c[0]) / c[2] / asp) * 1.22)
    }
    return camera(cam.pos, cam.target, (2 * Math.atan(need) * 180) / Math.PI)
  }
  function camFor(st, W, H, ballNow) {
    const L = st.L, T = L.t, a = W / H
    if (!L.ball) {
      if (st.t < T.pitchEnd) return HOME(a)
      return GD.CAMS.blend(HOME(a), ZONE(L, a), (st.t - T.pitchEnd) / 0.9)
    }
    if (st.t < T.pitchEnd) return HOME(a)
    const b = ballNow || L.ball.at(0), dir = polar(L.ball.bearing, 1)
    const g = [b[0], b[1], 0], r = Math.hypot(b[0], b[1])
    const rest = smooth(clamp((st.t - T.contactEnd - ballStop(L)) / 1.3, 0, 1))
    // A crane: it rises with the ball and stays a little above it, so the ball reads against the board.
    const lag = (52 + 0.2 * r) * (1 + 0.45 * rest), up = (26 + 0.5 * b[2] + 0.1 * r + 0.75 * Math.max(0, b[2] - 40)) * (1 + 0.35 * rest)
    // Swing a little to the side of the line, so the flight reads as an arc and not a dot.
    const side = [dir[1] * 0.22 * lag, -dir[0] * 0.22 * lag, 0]
    const pos = v3.add(v3.add(v3.sub(g, v3.mul(dir, lag)), side), [0, 0, up])
    const target = v3.add(g, [dir[0] * 18, dir[1] * 18, b[2] * (b[2] > 60 ? 0.6 : 0.45)])
    const base = GD.vfovFor(44, 22, a)
    const follow = fit(camera(pos, target, base), [b, g], W, H, base)
    return GD.CAMS.blend(HOME(a), follow, (st.t - T.pitchEnd) / 1.0)
  }

  // ---- Drawing ----------------------------------------------------------------------------------------
  function make(cv) {
    const g = cv.getContext('2d')
    let cam, W, H, R
    const P = (p) => project(cam, p, W, H)
    function poly(pts, fill, stroke, lw) {
      const cs = clipNear(pts.map((p) => toCam(cam, p)))
      if (cs.length < 3) return
      g.beginPath()
      cs.forEach((c, i) => { const s = scr(cam, c, W, H); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]) })
      g.closePath()
      if (fill) { g.fillStyle = fill; g.fill() }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke() }
    }
    function pathPoly(pts) {
      const cs = clipNear(pts.map((p) => toCam(cam, p)))
      if (cs.length < 3) return false
      cs.forEach((c, i) => { const s = scr(cam, c, W, H); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]) })
      g.closePath()
      return true
    }
    // A chalk line on the board: a thin quad so it shrinks with distance like print.
    function chalk(a, b, w = 0.35, col = C.chalk) {
      const d = v3.norm(v3.sub(b, a)), n = [-d[1] * w / 2, d[0] * w / 2, 0]
      poly([v3.add(a, n), v3.add(b, n), v3.sub(b, n), v3.sub(a, n)], col)
    }
    const px = (ft, q, min = 1) => Math.max(min, ft * q.s)

    function drawBoard() {
      // The table and the room.
      g.fillStyle = C.room; g.fillRect(0, 0, W, H)
      poly([[-4000, -4000, -2], [4000, -4000, -2], [4000, 4000, -2], [-4000, 4000, -2]], C.table)
      // The board itself, with a little thickness at its edge.
      const bx = 372, by0 = -130, by1 = 500
      poly([[-bx, by0, -2], [bx, by0, -2], [bx, by0, 0], [-bx, by0, 0]], C.tableEdge)
      poly([[-bx, by1, -2], [bx, by1, -2], [bx, by1, 0], [-bx, by1, 0]], C.tableEdge)
      poly([[-bx, by0, 0], [bx, by0, 0], [bx, by1, 0], [-bx, by1, 0]], C.board)
      // The diorama box: three printed sky cards standing at the board's back and sides.
      const HB = 340
      const walls = [[[-bx, by1], [bx, by1]], [[-bx, by0], [-bx, by1]], [[bx, by1], [bx, by0]]]
      for (const [a, b] of walls) {
        poly([[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], HB], [a[0], a[1], HB]], C.sky)
        poly([[a[0], a[1], HB], [b[0], b[1], HB], [b[0], b[1], HB + 3], [a[0], a[1], HB + 3]], C.boxEdge)
      }
      // Printed clouds on the back card: flat paper puffs.
      for (const [cx, cz, r] of [[-250, 150, 26], [-215, 158, 20], [-30, 175, 30], [5, 168, 22], [190, 140, 24], [222, 147, 18]]) poly(Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return [cx + Math.cos(a) * r * 1.6, by1 - 0.5, cz + Math.sin(a) * r * 0.7] }), C.cloud)
      // The printed field, inset from the board's margin.
      const m = 12
      poly([[-bx + m, by0 + m, 0], [bx - m, by0 + m, 0], [bx - m, by1 - m, 0], [-bx + m, by1 - m, 0]], C.grass)
      // Mowing stripes, clipped to fair ground.
      const wl = wallLine(30)
      const fair = [[0, 0, 0], ...wl.map((w) => w.foot)]
      g.save(); g.beginPath()
      if (pathPoly(fair)) {
        g.clip()
        for (let y = 150, i = 0; y < 440; y += 26, i++) if (i % 2 === 0) poly([[-400, y, 0], [400, y, 0], [400, y + 13, 0], [-400, y + 13, 0]], C.stripe)
      }
      g.restore()
      // Warning track along the wall.
      const track = [...wl.map((w) => polar(w.deg, w.foot ? Math.hypot(w.foot[0], w.foot[1]) - 12 : 300)), ...wl.slice().reverse().map((w) => w.foot)]
      poly(track, C.track)
      // Infield dirt: an arc of 95 ft from the rubber, foul line to foul line.
      const arc = []
      for (let a = -48; a <= 48; a += 4) { const r = (a * Math.PI) / 180; arc.push([95 * Math.sin(r), 60.5 + 95 * Math.cos(r), 0]) }
      poly([[0, 0, 0], [B90 * 1.48, B90 * 1.48, 0], ...arc.reverse(), [-B90 * 1.48, B90 * 1.48, 0]].reverse(), C.dirt)
      // Infield grass, a square inside the bases.
      const ctr = [0, B90, 0], k = 0.8
      const corner = (b, kk = k) => v3.add(ctr, v3.mul(v3.sub(BASES[b], ctr), kk))
      poly([corner('home', 0.7), corner('1B'), corner('2B'), corner('3B')], C.grass)
      poly(ring(0, 0.8, 13, 26), C.dirt) // home circle
      poly(ring(0, 59, 9, 22), C.dirt) // mound
      // Chalk: foul lines, boxes, plate, bases, rubber.
      chalk([0, 0, 0], polar(45, wallAt(45).ft))
      chalk([0, 0, 0], polar(-45, wallAt(-45).ft))
      for (const s of [-1, 1]) {
        const x0 = s * 1.21, x1 = s * 5.21
        chalk([x0, -2.6, 0], [x0, 3.4, 0], 0.22); chalk([x1, -2.6, 0], [x1, 3.4, 0], 0.22)
        chalk([x0, -2.6, 0], [x1, -2.6, 0], 0.22); chalk([x0, 3.4, 0], [x1, 3.4, 0], 0.22)
      }
      poly([[0, 0, 0.02], [0.708, 0.708, 0.02], [0.708, 1.417, 0.02], [-0.708, 1.417, 0.02], [-0.708, 0.708, 0.02]], C.chalk)
      for (const b of ['1B', '2B', '3B']) { const p = BASES[b]; poly([[p[0] - 0.75, p[1] - 0.75, 0.05], [p[0] + 0.75, p[1] - 0.75, 0.05], [p[0] + 0.75, p[1] + 0.75, 0.05], [p[0] - 0.75, p[1] + 0.75, 0.05]], C.chalk) }
      poly([[-1, 60.3, 0.6], [1, 60.3, 0.6], [1, 60.8, 0.6], [-1, 60.8, 0.6]], C.chalk)
    }
    const B90 = 90 / Math.SQRT2

    // The wall as a folded card strip, the stands as printed cards behind it. Returns depth-sorted items.
    function wallItems(items) {
      const wl = wallLine(46)
      // The stands are one group, always behind the wall from the field: backs, then seats and crowd.
      const standsDraw = [], standsTop = []
      items.push({ d: 1e9, draw: () => { for (const f of standsDraw) f(); for (const f of standsTop) f() } })
      for (let i = 0; i < wl.length - 1; i++) {
        const a = wl[i], b = wl[i + 1]
        if (!a.foot || !b.foot) continue
        const mid = v3.lerp(a.foot, b.foot, 0.5), q = P([mid[0], mid[1], (a.h + b.h) / 4])
        if (!q) continue
        const out = (w, d) => polar(w.deg, Math.hypot(w.foot[0], w.foot[1]) + d, w.h)
        const monster = a.h > 30 && b.h > 30
        // Stands first (they are behind the wall).
        const sa = STAND(a.h), sb = STAND(b.h)
        const s0a = out(a, 5), s0b = out(b, 5)
        const s1a = polar(a.deg, Math.hypot(a.foot[0], a.foot[1]) + 5 + sa.depth, a.h + sa.rise)
        const s1b = polar(b.deg, Math.hypot(b.foot[0], b.foot[1]) + 5 + sb.depth, b.h + sb.rise)
        standsDraw.push(() => poly([s1a, s1b, v3.add(s1b, [0, 0, -sb.rise - b.h]), v3.add(s1a, [0, 0, -sa.rise - a.h])], C.board2))
        standsTop.push(() => {
          poly([s0a, s0b, s1b, s1a], C.stands)
          for (const f of [0.25, 0.5, 0.75]) { const l0 = v3.lerp(s0a, s1a, f), l1 = v3.lerp(s0b, s1b, f); poly([l0, l1, v3.add(l1, [0, 0, 0.8]), v3.add(l0, [0, 0, 0.8])], C.standsRow) }
          // A printed crowd: a few dots per card, placed by a fixed hash.
          let h = (i * 2654435761) >>> 0
          const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296)
          for (let k = 0; k < 9; k++) {
            const u = rnd(), v = 0.1 + rnd() * 0.85
            const p = v3.lerp(v3.lerp(s0a, s0b, u), v3.lerp(s1a, s1b, u), v)
            const qq = P(v3.add(p, [0, 0, 1.4]))
            if (!qq) continue
            const r = Math.max(0.8, 1.1 * qq.s)
            g.fillStyle = C.crowd[k % C.crowd.length]
            g.fillRect(qq.x - r, qq.y - r * 1.3, r * 2, r * 2.6)
          }
        })
        items.push({ d: q.d, draw: () => {
          poly([a.foot, b.foot, b.top, a.top], monster ? C.monster : C.wall)
          if (monster && a.deg > -25 && a.deg < -19) { // the manual scoreboard, printed
            const lo = 9, hi = 24, u0 = 0.1, u1 = 0.9
            const pa = v3.lerp(a.foot, b.foot, u0), pb = v3.lerp(a.foot, b.foot, u1)
            poly([[pa[0], pa[1] - 0.2, lo], [pb[0], pb[1] - 0.2, lo], [pb[0], pb[1] - 0.2, hi], [pa[0], pa[1] - 0.2, hi]], '#24452E')
            for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
              const x0 = lerp(u0, u1, 0.1 + c * 0.3), x1 = x0 + 0.2, z0 = lo + 2 + r * 6.5, z1 = z0 + 4
              const p0 = v3.lerp(a.foot, b.foot, x0), p1 = v3.lerp(a.foot, b.foot, x1)
              poly([[p0[0], p0[1] - 0.3, z0], [p1[0], p1[1] - 0.3, z0], [p1[0], p1[1] - 0.3, z1], [p0[0], p0[1] - 0.3, z1]], '#E9E4D2')
            }
          }
          // The card's cut top edge, so the wall has thickness.
          poly([a.top, b.top, out(b, 1.6), out(a, 1.6)], C.wallTop)
        } })
      }
    }

    // A die-cut standee drawn from the skeleton: shadow, white cut, then the print.
    function standee(j, bones, kit, opts) {
      const keys = Object.keys(j)
      const q = {}
      for (const k of keys) q[k] = P(j[k])
      if (keys.some((k) => !q[k])) return
      const ref = q.pelvis || q.neck
      const W_ = { torso: 1.25, arm: 0.42, leg: 0.6, head: 0.44 }
      const segs = [] // [a, b, widthFt, colour]
      const add = (a, b, w, col) => { if (q[a] && q[b]) segs.push([a, b, w, col]) }
      add('lHip', 'lKnee', W_.leg, kit.pants); add('rHip', 'rKnee', W_.leg, kit.pants)
      add('lKnee', 'lFoot', W_.leg * 0.85, kit.sock); add('rKnee', 'rFoot', W_.leg * 0.85, kit.sock)
      add('neck', 'pelvis', W_.torso * 0.9, kit.jersey)
      add('lSho', 'lElb', W_.arm, kit.sleeve); add('rSho', 'rElb', W_.arm, kit.sleeve)
      if (j.hands) { add('lElb', 'hands', W_.arm * 0.9, kit.sleeve); add('rElb', 'hands', W_.arm * 0.9, kit.sleeve) }
      if (j.ball && !j.hands) add('rElb', 'ball', W_.arm * 0.9, kit.sleeve)
      const torso = ['lSho', 'rSho', 'rHip', 'lHip'].map((k) => q[k])
      const bat = j.batTip && j.hands ? [q.hands, q.batTip] : null
      const pw = (ft) => Math.max(1.4, ft * ref.s)
      // 1. Shadow on the board: the figure flattened along the light.
      const sh = (p) => P([p[0] + p[2] * 0.42, p[1] + p[2] * 0.3, 0.03])
      g.lineCap = 'round'; g.lineJoin = 'round'
      g.strokeStyle = C.shadow
      for (const [a, b, w] of segs) { const sa = sh(j[a]), sb = sh(j[b]); if (!sa || !sb) continue; g.lineWidth = pw(w * 1.25); g.beginPath(); g.moveTo(sa.x, sa.y); g.lineTo(sb.x, sb.y); g.stroke() }
      if (j.head) { const s = sh(j.head); if (s) { g.fillStyle = C.shadow; g.beginPath(); g.arc(s.x, s.y, pw(W_.head * 1.2), 0, 7); g.fill() } }
      // 2. The base stand under the feet.
      if (j.lFoot && j.rFoot) {
        const fm = v3.lerp(j.lFoot, j.rFoot, 0.5)
        poly(ring(fm[0], fm[1], 1.25, 16, 0.05), C.stand)
        poly(ring(fm[0], fm[1], 1.0, 16, 0.25), C.standTop)
      }
      // 3. The white die-cut, a border around the whole silhouette.
      const cut = pw(0.16)
      g.strokeStyle = C.cut; g.fillStyle = C.cut
      for (const [a, b, w] of segs) { g.lineWidth = pw(w) + cut * 2; g.beginPath(); g.moveTo(q[a].x, q[a].y); g.lineTo(q[b].x, q[b].y); g.stroke() }
      g.beginPath(); torso.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.lineWidth = cut * 2; g.stroke(); g.fill()
      if (q.head) { g.beginPath(); g.arc(q.head.x, q.head.y, pw(W_.head) + cut, 0, 7); g.fill() }
      if (bat) { g.lineWidth = pw(0.2) + cut * 2; g.beginPath(); g.moveTo(bat[0].x, bat[0].y); g.lineTo(bat[1].x, bat[1].y); g.stroke() }
      // 4. The print.
      for (const [a, b, w, col] of segs) { g.strokeStyle = col; g.lineWidth = pw(w); g.beginPath(); g.moveTo(q[a].x, q[a].y); g.lineTo(q[b].x, q[b].y); g.stroke() }
      g.beginPath(); torso.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = kit.jersey; g.fill()
      g.strokeStyle = kit.trim; g.lineWidth = pw(0.08); g.stroke()
      // Shoes.
      for (const f of ['lFoot', 'rFoot']) if (q[f]) { g.fillStyle = C.shoe; g.beginPath(); g.arc(q[f].x, q[f].y, pw(0.32), 0, 7); g.fill() }
      // Head: face, then the cap or helmet with its brim toward where he faces.
      if (q.head) {
        const r = pw(W_.head)
        g.fillStyle = C.skin; g.beginPath(); g.arc(q.head.x, q.head.y, r, 0, 7); g.fill()
        const face = opts.face ? P(v3.add(j.head, opts.face)) : null
        const fx = face ? Math.sign(face.x - q.head.x) || 1 : 1
        g.fillStyle = kit.cap
        g.beginPath(); g.arc(q.head.x, q.head.y - r * 0.12, r * 1.02, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill()
        g.fillRect(Math.min(q.head.x, q.head.x + fx * r * 1.55), q.head.y - r * 0.28, r * 1.55, r * 0.3)
        if (opts.helmet) { g.beginPath(); g.arc(q.head.x - fx * r * 0.35, q.head.y + r * 0.1, r * 0.55, 0, 7); g.fill() }
      }
      // Glove (pitcher) and the ball in the hand during the windup.
      if (opts.glove && q.lElb && q.lSho) { const gx = q.lElb.x + (q.lElb.x - q.lSho.x) * 0.45, gy = q.lElb.y + (q.lElb.y - q.lSho.y) * 0.45; g.fillStyle = C.glove; g.beginPath(); g.arc(gx, gy, pw(0.42), 0, 7); g.fill() }
      if (opts.ballInHand && q.ball) { g.fillStyle = C.ball; g.beginPath(); g.arc(q.ball.x, q.ball.y, pw(0.16), 0, 7); g.fill() }
      // The bat, tapered, over the figure.
      if (bat) {
        const [a, b] = bat, dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l
        const w0 = pw(0.06), w1 = pw(0.13)
        g.fillStyle = C.bat; g.beginPath()
        g.moveTo(a.x + nx * w0, a.y + ny * w0); g.lineTo(b.x + nx * w1, b.y + ny * w1); g.lineTo(b.x - nx * w1, b.y - ny * w1); g.lineTo(a.x - nx * w0, a.y - ny * w0); g.closePath(); g.fill()
        g.fillStyle = C.batEnd; g.beginPath(); g.arc(b.x, b.y, w1, 0, 7); g.fill()
      }
    }

    // A simple game piece: a card standing up and facing the camera, a printed player on it.
    function piece(pos, kit, scale, running) {
      const right = v3.norm([cam.r[0], cam.r[1], 0]), w = 2.6 * scale, h = 6.4 * scale
      const base = [pos[0], pos[1], 0]
      const c = (u, v) => P(v3.add(v3.add(base, v3.mul(right, (u - 0.5) * w)), [0, 0, v * h]))
      const q00 = c(0, 0), q10 = c(1, 0), q11 = c(1, 1), q01 = c(0, 1)
      if (!q00 || !q10 || !q11 || !q01) return
      // Shadow: the card laid along the light.
      const sh = (u, v) => P(v3.add(v3.add(base, v3.mul(right, (u - 0.5) * w)), [v * h * 0.42, v * h * 0.3, 0.03]))
      const s = [sh(0, 0), sh(1, 0), sh(1, 1), sh(0, 1)]
      if (s.every(Boolean)) { g.fillStyle = C.shadow; g.beginPath(); s.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill() }
      poly(ring(pos[0], pos[1], w * 0.42, 12, 0.05), C.stand)
      // The card.
      const lw = Math.max(1, q00.s * 0.12 * scale)
      g.fillStyle = C.cut; g.strokeStyle = 'rgba(60,45,25,0.35)'; g.lineWidth = lw
      g.beginPath(); [q00, q10, q11, q01].forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill(); g.stroke()
      // The printed player, in card space (u across, v up).
      const at = (u, v) => { const a = { x: lerp(q00.x, q10.x, u), y: lerp(q00.y, q10.y, u) }, b = { x: lerp(q01.x, q11.x, u), y: lerp(q01.y, q11.y, u) }; return { x: lerp(a.x, b.x, v), y: lerp(a.y, b.y, v) } }
      const cw = Math.hypot(q10.x - q00.x, q10.y - q00.y), ch = Math.hypot(q01.x - q00.x, q01.y - q00.y)
      const stroke = (u0, v0, u1, v1, wr, col) => { const a = at(u0, v0), b = at(u1, v1); g.strokeStyle = col; g.lineWidth = Math.max(1, wr * cw); g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke() }
      const sw = running ? 0.14 : 0.06
      stroke(0.44, 0.48, 0.5 - sw, 0.12, 0.17, kit.pants); stroke(0.56, 0.48, 0.5 + sw, 0.12, 0.17, kit.pants)
      stroke(0.5 - sw, 0.16, 0.5 - sw - 0.02, 0.06, 0.15, kit.sock); stroke(0.5 + sw, 0.16, 0.5 + sw + 0.02, 0.06, 0.15, kit.sock)
      stroke(0.5, 0.5, 0.5, 0.74, 0.36, kit.jersey)
      stroke(0.34, 0.72, running ? 0.22 : 0.26, 0.5, 0.12, kit.sleeve); stroke(0.66, 0.72, running ? 0.8 : 0.74, 0.5, 0.12, kit.sleeve)
      const hd = at(0.5, 0.85)
      g.fillStyle = C.skin; g.beginPath(); g.arc(hd.x, hd.y, Math.max(1, 0.12 * cw), 0, 7); g.fill()
      g.fillStyle = kit.cap; g.beginPath(); g.arc(hd.x, hd.y - 0.02 * ch, Math.max(1, 0.125 * cw), Math.PI, 0); g.fill()
      stroke(0.5, 0.6, 0.5, 0.64, 0.38, kit.trim)
    }

    function drawZone(st) {
      const L = st.L, p = L.last
      const zb = p.szBot, zt = p.szTop, y = 1.42
      const q0 = P([0, y, (zb + zt) / 2])
      if (!q0) return
      const lw = Math.max(1.2, 0.035 * q0.s)
      g.globalAlpha = 0.85
      const corners = [[-0.83, y, zb], [0.83, y, zb], [0.83, y, zt], [-0.83, y, zt]].map(P)
      if (corners.every(Boolean)) {
        g.strokeStyle = C.chalk; g.lineWidth = lw; g.setLineDash([lw * 3, lw * 2])
        g.beginPath(); corners.forEach((c, i) => (i ? g.lineTo(c.x, c.y) : g.moveTo(c.x, c.y))); g.closePath(); g.stroke(); g.setLineDash([])
        g.globalAlpha = 0.3; g.lineWidth = lw * 0.6
        for (const f of [1 / 3, 2 / 3]) {
          const a = P([-0.83 + 1.66 * f, y, zb]), b = P([-0.83 + 1.66 * f, y, zt]), c = P([-0.83, y, zb + (zt - zb) * f]), d = P([0.83, y, zb + (zt - zb) * f])
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.moveTo(c.x, c.y); g.lineTo(d.x, d.y); g.stroke()
        }
      }
      g.globalAlpha = 1
    }
    const callOf = (c) => ('B*'.includes(c[0]) && c !== 'BB' ? 'B' : 'XDE'.includes(c) ? 'X' : 'S')
    function token(p, label, kind, q0) {
      const q = P([p.px, 1.42, p.pz])
      if (!q) return
      const r = Math.max(0.17 * q.s, R * 0.024)
      g.fillStyle = 'rgba(48,32,18,0.25)'; g.beginPath(); g.arc(q.x + r * 0.18, q.y + r * 0.22, r, 0, 7); g.fill()
      const strike = kind === 'S', inPlay = kind === 'X'
      g.fillStyle = inPlay ? C.burst : strike ? C.ink : C.label
      g.strokeStyle = C.ink; g.lineWidth = Math.max(1, r * 0.14)
      g.beginPath(); g.arc(q.x, q.y, r, 0, 7); g.fill(); g.stroke()
      g.fillStyle = strike ? C.label : C.ink
      g.font = FONT(Math.round(r * 1.35)); g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(label, q.x, q.y + r * 0.06)
    }
    function tag(st) {
      const p = st.L.last, q = P([p.px, 1.42, p.pz])
      if (!q || q.x < 0 || q.x > W || q.y < 0 || q.y > H) return
      const mph = Math.round(p.mph), txt = `${mph} ${p.type} · ${callOf(p.code)}`
      const fs = Math.max(11, R * 0.042)
      g.font = FONT(Math.round(fs))
      const w = g.measureText(txt).width + fs * 0.9, h = fs * 1.45
      const r = Math.max(0.17 * q.s, R * 0.024)
      let x = q.x + r * 1.6, y = q.y - h - r * 0.6
      if (x + w > W - 6) x = q.x - r * 1.6 - w
      y = clamp(y, 4, H - h - 4)
      g.fillStyle = 'rgba(48,32,18,0.28)'; g.fillRect(x + 3, y + 3, w, h)
      g.fillStyle = C.label; g.fillRect(x, y, w, h)
      g.strokeStyle = C.ink; g.lineWidth = Math.max(1, fs * 0.08); g.strokeRect(x, y, w, h)
      g.fillStyle = C.ink; g.textAlign = 'left'; g.textBaseline = 'middle'
      g.fillText(txt, x + fs * 0.45, y + h / 2 + 1)
    }
    function burst(at, u) {
      const q = P(at); if (!q) return
      const rad = Math.max(0.9 * q.s, R * 0.06) * (0.55 + 0.6 * Math.sin(Math.min(1, u) * Math.PI * 0.9))
      g.beginPath()
      for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, rr = i % 2 ? rad * 0.55 : rad; i ? g.lineTo(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr) : g.moveTo(q.x + rr, q.y) }
      g.closePath(); g.fillStyle = C.burst; g.fill(); g.strokeStyle = C.ink; g.lineWidth = Math.max(1, rad * 0.06); g.stroke()
    }
    function ballDisc(b, shadow) {
      const q = P(b); if (!q) return
      const r = Math.max(0.2 * q.s, R * 0.013)
      if (shadow && b[2] > 0.3) {
        const s = P([b[0] + b[2] * 0.42 * 0.02, b[1], 0.04])
        if (s) { g.fillStyle = 'rgba(48,32,18,0.3)'; g.beginPath(); g.ellipse(s.x, s.y, r * 1.1, r * 0.45, 0, 0, 7); g.fill() }
      }
      g.fillStyle = C.ball; g.strokeStyle = C.ink; g.lineWidth = Math.max(1, r * 0.22)
      g.beginPath(); g.arc(q.x, q.y, r, 0, 7); g.fill(); g.stroke()
    }
    // A paper pennant on a pin, stuck where the ball's flight ends: in the seats, at the catch, at the glove.
    function pin(at, u) {
      const base = P(at), top = P(v3.add(at, [0, 0, 9]))
      if (!base || !top) return
      const h = Math.max(top.y < base.y ? base.y - top.y : 0, R * 0.07) * (0.4 + 0.6 * smooth(clamp(u, 0, 1)))
      const x = base.x, y0 = base.y, y1 = base.y - h
      g.strokeStyle = C.ink; g.lineWidth = Math.max(1.2, R * 0.004)
      g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke()
      g.fillStyle = C.pin; g.beginPath(); g.moveTo(x, y1); g.lineTo(x + h * 0.55, y1 + h * 0.17); g.lineTo(x, y1 + h * 0.34); g.closePath(); g.fill()
      g.strokeStyle = C.ink; g.lineWidth = Math.max(1, R * 0.003); g.stroke()
      g.fillStyle = C.ink; g.beginPath(); g.arc(x, y0, Math.max(1.5, R * 0.005), 0, 7); g.fill()
    }

    return {
      draw(st, w, h) {
        W = w; H = h; R = Math.min(h, w * 0.8)
        const L = st.L, T = L.t
        // The ball, held where it comes to rest in the stands.
        const stop = ballStop(L)
        const bt = Math.min(st.ballT, stop)
        const ballNow = L.ball && st.t >= T.contactEnd ? L.ball.at(bt) : null
        cam = camFor(st, W, H, ballNow)
        g.save()
        g.lineCap = 'round'; g.lineJoin = 'round'
        drawBoard()
        // Paper fibre over the printed board.
        g.globalAlpha = 0.9; g.fillStyle = g.createPattern(paper(), 'repeat'); g.fillRect(0, 0, W, H); g.globalAlpha = 1
        // Everything that stands up, far to near.
        const items = []
        wallItems(items)
        const showBatter = !(st.t > (L.ball ? T.contactEnd + 0.45 : T.pitchEnd + 0.6) && st.runners.some((r) => r.batter && !r.out))
        const bq = P(st.batter.pelvis)
        if (bq && showBatter) items.push({ d: bq.d, draw: () => standee(st.batter, BONES, SEA, { helmet: true, face: [st.play.batter.side === 'L' ? -1 : 1, 0, 0] }) })
        const pq = P(st.pitcher.pelvis)
        if (pq) items.push({ d: pq.d, draw: () => standee(st.pitcher, PBONES, BOS, { glove: true, face: [0, -1, 0], ballInHand: st.t < T.windupEnd }) })
        for (const k in st.fielders) {
          if (k === 'P' || k === 'C') continue
          const p = st.fielders[k], q = P(p)
          const moving = k === L.fielder && st.t > T.contactEnd
          if (q) items.push({ d: q.d, draw: () => piece(p, BOS, 1.3, moving) })
        }
        for (const r of st.runners) {
          if (r.gone) continue
          if (r.batter && (st.t < (L.ball ? T.contactEnd + 0.45 : T.pitchEnd + 0.6) || r.out)) continue
          const q = P(r.pos)
          if (q) items.push({ d: q.d, draw: () => piece(r.pos, SEA, 1.3, st.t > T.contactEnd) })
        }
        // The batted ball, sorted with the rest so the wall can hide or show it.
        if (ballNow) { const q = P(ballNow); if (q) items.push({ d: q.d - (bt >= stop && stop < L.ball.T ? 3 : 0), draw: () => ballDisc(ballNow, true) }) }
        const stopAt = L.ball ? T.contactEnd + stop : Infinity
        if (L.ball && st.t >= stopAt) { const end = L.ball.at(stop), q = P(end); if (q) items.push({ d: q.d - 4, draw: () => pin(end, (st.t - stopAt) / 0.35) }) }
        items.sort((a, b) => b.d - a.d)
        // The zone and the tokens sit behind the batter in depth but are drawn as print on the air:
        // draw them before the near figures.
        const zoneD = (P([0, 1.42, 2.5]) || { d: 0 }).d
        let zoneDone = false
        const zoneLayer = () => {
          if (zoneDone) return; zoneDone = true
          if (st.t >= T.contactEnd + 0.15 && L.ball) return
          drawZone(st)
          for (let i = 0; i < st.dotsShown; i++) token(L.pitches[i], String(i + 1), callOf(L.pitches[i].code))
          if (st.t >= T.pitchEnd) token(L.last, callOf(L.last.code) === 'X' ? 'X' : String(L.pitches.length), callOf(L.last.code))
        }
        for (const it of items) { if (it.d < zoneD) zoneLayer(); it.draw() }
        zoneLayer()
        // The pitch in flight, with a short trail of paper discs.
        if (st.pitchPos) {
          for (let i = 5; i >= 1; i--) {
            const u = st.pitchU - i * 0.045; if (u < 0) continue
            const q = P(GD.pitchAt(L.last, u)); if (!q) continue
            g.globalAlpha = 0.12 + (5 - i) * 0.08; g.fillStyle = C.ball
            g.beginPath(); g.arc(q.x, q.y, Math.max(0.12 * q.s, R * 0.008), 0, 7); g.fill()
          }
          g.globalAlpha = 1
          ballDisc(st.pitchPos, false)
        }
        if (L.ball && st.t >= T.pitchEnd && st.t < T.contactEnd + 0.25) burst(GD.pitchAt(L.last, 1), (st.t - T.pitchEnd) / 0.4)
        if (st.t >= T.pitchEnd && !(L.ball && st.t >= T.contactEnd + 0.15)) tag(st)
        g.restore()
      },
      destroy() {},
    }
  }

  GD.register({
    id: 'diorama',
    name: 'Paper diorama',
    look: 'A printed tabletop board with die-cut paper standees, like a board game come to life.',
    camera: 'continuous',
    dims: '2.5D',
    notes: [
      'One camera move, no cut: it rises off the plate and follows the ball across the board.',
      'Players are flat paper standees with a white die-cut edge, a plastic stand and a shadow.',
      'The ball over the Monster comes to rest in the printed Monster seats.',
      'A walk or strikeout pushes in on the zone so the last pitch can be read.',
    ],
    create(canvas) { return make(canvas) },
  })
})()
