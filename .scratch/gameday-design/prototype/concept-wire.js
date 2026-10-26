// Debug renderer: lines only. Checks the geometry, the cameras and the timeline.
GD.register({ id: 'wire', name: 'Wire (debug)', create(cv) {
  const g = cv.getContext('2d')
  return { draw(st, W, H) {
    const L = st.L, T = L.t
    let cam = GD.CAMS.home()
    if (L.ball && st.t >= T.contactEnd) cam = GD.CAMS.blend(GD.CAMS.home(), GD.CAMS.chase(st), (st.t - T.contactEnd) / 0.7)
    const P = (p) => GD.project(cam, p, W, H)
    g.fillStyle = '#0b1a10'; g.fillRect(0, 0, W, H)
    const line = (pts, col, w = 2) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); let on = false; for (const p of pts) { const q = P(p); if (!q) { on = false; continue } on ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); on = true } g.stroke() }
    const B = GD.BASES
    line([B.home, B['1B'], B['2B'], B['3B'], B.home], '#c96')
    line([B.home, GD.polar(45, 330)], '#fff', 1); line([B.home, GD.polar(-45, 330)], '#fff', 1)
    const wl = GD.wallLine(); line(wl.map((w) => w.foot), '#3a6'); line(wl.map((w) => w.top), '#3a6')
    for (const w of wl.filter((_, i) => i % 3 === 0)) line([w.foot, w.top], '#3a6', 1)
    // zone
    const zt = L.last.szTop, zb = L.last.szBot
    line([[-0.83, 1.42, zb], [0.83, 1.42, zb], [0.83, 1.42, zt], [-0.83, 1.42, zt], [-0.83, 1.42, zb]], '#888', 1)
    for (let i = 0; i < st.dotsShown; i++) { const p = L.pitches[i]; const q = P([p.px, 1.42, p.pz]); if (q) { g.fillStyle = '#ccc'; g.beginPath(); g.arc(q.x, q.y, 6, 0, 7); g.fill(); g.fillStyle = '#000'; g.fillText(String(i + 1), q.x - 3, q.y + 3) } }
    const fig = (j, bones, col) => { for (const [a, b] of bones) line([j[a], j[b]], col, 3) }
    fig(st.batter, GD.BONES, '#9cf'); line([st.batter.hands, st.batter.batTip], '#fc6', 4)
    fig(st.pitcher, GD.PBONES, '#f99')
    for (const k in st.fielders) { const q = P(st.fielders[k]); if (q) { g.fillStyle = '#f99'; g.fillRect(q.x - 3, q.y - 8, 6, 8) } }
    for (const r of st.runners) if (!r.gone) { const q = P(r.pos); if (q) { g.fillStyle = '#9cf'; g.fillRect(q.x - 3, q.y - 8, 6, 8) } }
    const b = st.pitchPos || st.ballPos
    if (b) { const q = P(b), s = P([b[0], b[1], 0]); if (s) { g.fillStyle = '#0006'; g.beginPath(); g.ellipse(s.x, s.y, 5, 2, 0, 0, 7); g.fill() } if (q) { g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, Math.max(3, q.s * 0.24), 0, 7); g.fill() } }
    g.fillStyle = '#fff'; g.font = '22px monospace'; g.fillText(st.phase + ' t=' + st.t.toFixed(2), 10, 26)
  } }
} })
