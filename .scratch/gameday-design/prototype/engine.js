// Shared engine for the four stage concepts (design round, #2568). Not app code.
// World frame = Statcast's, in feet: x right of the plate as the catcher sees it (1B side +),
// y toward the mound from the plate's back point, z up. Home plate at the origin.
// The page owns the clock; a concept only draws `GD.stateAt(play, t)`.
;(function () {
  const D = window.GD_DATA
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const lerp = (a, b, u) => a + (b - a) * u
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)
  const smooth = (u) => u * u * (3 - 2 * u)
  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] },
    lerp: (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)],
  }

  // ---- Field --------------------------------------------------------------------------
  const B90 = 90 / Math.SQRT2
  const BASES = { home: [0, 0, 0], '1B': [B90, B90, 0], '2B': [0, 2 * B90, 0], '3B': [-B90, B90, 0] }
  const MOUND = [0, 60.5, 0]
  // Bearing in degrees off straightaway centre (negative = left field) and feet out.
  const polar = (deg, ft, z = 0) => [ft * Math.sin((deg * Math.PI) / 180), ft * Math.cos((deg * Math.PI) / 180), z]
  const POS = {
    P: [0, 58, 0], C: [0, -3.5, 0], '1B': polar(37, 108), '2B': polar(14, 148), SS: polar(-13, 146),
    '3B': polar(-36, 104), LF: polar(-26, 255), CF: polar(0, 318), RF: polar(28, 285),
  }
  // The wall: [deg, ft, height] every 5 degrees from the park layout (Fenway: the Monster is 37.3 ft).
  const WALL = D.wall.filter((w) => w[1] != null)
  function wallAt(deg) {
    const d = clamp(deg, WALL[0][0], WALL.at(-1)[0])
    for (let i = 1; i < WALL.length; i++) {
      if (d <= WALL[i][0]) {
        const a = WALL[i - 1], b = WALL[i], u = (d - a[0]) / (b[0] - a[0])
        return { ft: lerp(a[1], b[1], u), h: lerp(a[2] ?? 8, b[2] ?? 8, u) }
      }
    }
    return { ft: WALL.at(-1)[1], h: WALL.at(-1)[2] ?? 8 }
  }
  // Points along the wall top and foot, foul pole to foul pole.
  const wallLine = (n = 46) => Array.from({ length: n + 1 }, (_, i) => {
    const deg = -45 + (90 * i) / n, w = wallAt(deg)
    return { deg, foot: polar(deg, w.ft), top: polar(deg, w.ft, w.h), h: w.h }
  })

  // ---- Paths ----------------------------------------------------------------------------
  // One pitch: realFlight samples over T seconds (25 points), read at u in [0, 1].
  function pitchAt(pitch, u) {
    const P = pitch.path, f = clamp(u, 0, 1) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f))
    return v3.lerp(P[i], P[i + 1], f - i)
  }
  const HIT_ORIGIN = { x: 125.42, y: 198.27 }, FT_PER_UNIT = 2.51
  // The base a putout is made at, by the fielder's position: the bag he covers.
  const BAG = { '1B': '1B', P: '1B', '2B': '2B', SS: '2B', '3B': '3B', C: 'home' }
  // A throw after a ground ball: the first credit fields it, the first putout by someone else receives.
  function throwFor(play, field) {
    const first = play.credits[0], put = play.credits.find((c) => c[1] === 'f_putout' && c[0] !== first?.[0])
    if (!first || !put || first[1] === 'f_putout' || !BAG[put[0]]) return null
    return { by: first[0], toPos: put[0], to: BASES[BAG[put[0]]] }
  }
  // The batted ball as a time function. Air: simFlight points (ground distance, height, time) laid on the
  // bearing. Ground: the repo's hop model (flightModel.js, non-air branch) to the coordinate, where it was fielded.
  function ballPath(play) {
    const b = play.ball
    if (!b || b.bearing == null) return null
    const coordFt = Math.hypot(b.coord.coordX - HIT_ORIGIN.x, HIT_ORIGIN.y - b.coord.coordY) * FT_PER_UNIT
    const air = b.flight && b.la >= 8
    if (air) {
      // Stretched along the ground to land on the measured distance, as the repo's side view does
      // (ballFlight.js airPoints) when the fitted lift cannot reach it.
      const k = b.dist && b.flight.dist ? b.dist / b.flight.dist : 1
      const pts = b.flight.pts.map((p) => [p[0] * k, p[1], p[2]]), T = b.flight.T
      const at = (t) => {
        const tt = clamp(t, 0, T)
        let j = 1
        while (j < pts.length - 1 && pts[j][2] < tt) j++
        const a = pts[j - 1], c = pts[j], u = c[2] === a[2] ? 0 : clamp((tt - a[2]) / (c[2] - a[2]), 0, 1)
        const s = lerp(a[0], c[0], u), z = Math.max(0, lerp(a[1], c[1], u))
        return polar(b.bearing, s, z)
      }
      const apex = Math.max(...pts.map((p) => p[1]))
      // The wall. A fair ball that reaches the wall below its top hits it and drops at its foot; one that
      // clears it comes down in the stands, which rise behind the wall (drawn, not measured).
      const fair = Math.abs(b.bearing) <= 45, w = fair ? wallAt(b.bearing) : null
      const cross = w ? pts.findIndex((p) => p[0] >= w.ft) : -1
      if (cross > 0) {
        const a = pts[cross - 1], c = pts[cross], u = (w.ft - a[0]) / (c[0] - a[0] || 1)
        const tc = lerp(a[2], c[2], u), zc = lerp(a[1], c[1], u)
        if (zc < w.h) {
          const drop = 0.7, T2 = tc + drop, foot = w.ft - 5
          const at2 = (t) => {
            if (t <= tc) return at(t)
            const k = clamp((t - tc) / drop, 0, 1)
            return polar(b.bearing, lerp(w.ft - 0.5, foot, k), Math.max(0, zc * (1 - k * k)))
          }
          return { kind: 'air', T: T2, at: at2, land: polar(b.bearing, foot), dist: foot, apex, bearing: b.bearing, wall: { ...w, hit: true, z: zc } }
        }
        const seat = (sft) => w.h + (sft - w.ft) * 0.55
        let te = T
        for (let i = cross; i < pts.length; i++) if (pts[i][1] <= seat(pts[i][0])) { te = pts[i][2]; break }
        const at3 = (t) => at(Math.min(t, te))
        const end = at(te)
        return { kind: 'air', T: te, at: at3, land: end, dist: Math.hypot(end[0], end[1]), apex, bearing: b.bearing, wall: { ...w, hit: false, seats: true } }
      }
      const dist = b.flight.dist * k
      return { kind: 'air', T, at, land: polar(b.bearing, dist), dist, apex, bearing: b.bearing, wall: w ? { ...w, hit: false } : null }
    }
    const ev = b.ev || 80
    const T = clamp(coordFt / (Math.max(60, ev) * 1.4667 * 0.42), 1.2, 3.6)
    const at = (t) => {
      const u = clamp(t / T, 0, 1)
      const s = coordFt * (1 - (1 - u) ** 1.8)
      const z = u >= 1 ? 0 : 3 * (1 - u) * Math.abs(Math.sin(3.4 * Math.PI * u))
      return polar(b.bearing, s, z)
    }
    const field = polar(b.bearing, coordFt)
    // The throw. The fielding credits say who threw to whom (a 4-3: the second baseman to the first
    // baseman). Its timing is drawn: a quarter-second transfer, then 85 ft/s with a low arc.
    const thr = throwFor(play, field)
    if (thr) {
      const hold = 0.25, fly = v3.len(v3.sub(thr.to, field)) / 85, T2 = T + hold + fly
      const from = [field[0], field[1], 3.5], to = [thr.to[0], thr.to[1], 4.5]
      const at2 = (t) => {
        if (t <= T) return at(t)
        if (t <= T + hold) return from
        const u = clamp((t - T - hold) / fly, 0, 1), q = v3.lerp(from, to, u)
        return [q[0], q[1], q[2] + 7 * u * (1 - u)]
      }
      return { kind: 'ground', T: T2, at: at2, land: thr.to, field, dist: coordFt, apex: 6, bearing: b.bearing,
        throw: { by: thr.by, to: thr.toPos, start: T + hold, end: T2, from, target: to } }
    }
    return { kind: 'ground', T, at, land: field, field, dist: coordFt, apex: 3, bearing: b.bearing }
  }

  // ---- Bodies ---------------------------------------------------------------------------
  // A right-handed batter in his own frame: x' toward the plate (the way he faces), y' toward the
  // pitcher, z up, feet. Five keyframes: stance, load, launch (barrel lags), contact, finish.
  // DESIGN ONLY: these poses are what Gary approves or rejects in the Swing tab (rule of 2026-10-07).
  const J = ['head', 'neck', 'lSho', 'rSho', 'lElb', 'rElb', 'hands', 'pelvis', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lFoot', 'rFoot', 'batTip']
  const SWING = {
    stance: { head: [0.15, 0.05, 5.6], neck: [0.1, -0.05, 5.15], lSho: [0.15, 0.55, 4.85], rSho: [0.05, -0.65, 4.85], lElb: [0.55, -0.1, 4.45], rElb: [-0.05, -1.25, 4.75], hands: [0.25, -0.72, 4.95], pelvis: [0, 0, 3.2], lHip: [0, 0.45, 3.2], rHip: [0, -0.45, 3.2], lKnee: [0.35, 1.05, 1.75], rKnee: [0.25, -1.0, 1.75], lFoot: [0.1, 1.3, 0], rFoot: [0, -1.2, 0], batTip: [-0.05, -1.45, 7.4] },
    load: { head: [0.12, 0.0, 5.6], neck: [0.08, -0.1, 5.15], lSho: [0.25, 0.48, 4.8], rSho: [-0.05, -0.72, 4.85], lElb: [0.5, -0.3, 4.5], rElb: [-0.25, -1.35, 4.8], hands: [0.1, -1.05, 5.05], pelvis: [0, -0.1, 3.25], lHip: [0.05, 0.38, 3.25], rHip: [-0.05, -0.55, 3.25], lKnee: [0.45, 1.1, 1.95], rKnee: [0.25, -1.05, 1.7], lFoot: [0.15, 1.55, 0.3], rFoot: [0, -1.2, 0], batTip: [-0.35, -1.6, 7.35] },
    launch: { head: [0.15, 0.15, 5.5], neck: [0.12, 0.05, 5.05], lSho: [0.3, 0.6, 4.75], rSho: [0.0, -0.6, 4.7], lElb: [0.65, 0.1, 4.25], rElb: [0.1, -0.95, 4.2], hands: [0.4, -0.55, 4.45], pelvis: [0.05, 0.15, 3.1], lHip: [0.0, 0.6, 3.1], rHip: [0.1, -0.3, 3.1], lKnee: [0.4, 1.4, 1.75], rKnee: [0.35, -0.8, 1.6], lFoot: [0.15, 1.85, 0], rFoot: [0.02, -1.22, 0.05], batTip: [0.2, -3.0, 5.1] },
    contact: { head: [0.2, 0.3, 5.45], neck: [0.15, 0.2, 5.0], lSho: [-0.1, 0.6, 4.8], rSho: [0.45, -0.35, 4.7], lElb: [0.75, 0.6, 4.1], rElb: [0.8, -0.2, 3.85], hands: [1.25, 0.55, 3.45], pelvis: [0.1, 0.2, 3.05], lHip: [-0.15, 0.55, 3.05], rHip: [0.35, -0.2, 3.05], lKnee: [0.3, 1.6, 1.7], rKnee: [0.6, -0.65, 1.55], lFoot: [0.15, 1.9, 0], rFoot: [0.08, -1.25, 0.12], batTip: [3.6, 1.15, 3.0] },
    finish: { head: [0.1, 0.45, 5.45], neck: [0.05, 0.35, 5.0], lSho: [-0.45, 0.35, 4.85], rSho: [0.55, 0.25, 4.75], lElb: [-0.35, 0.95, 5.0], rElb: [0.45, 0.9, 4.9], hands: [-0.05, 0.85, 5.45], pelvis: [0.1, 0.3, 3.05], lHip: [-0.25, 0.5, 3.05], rHip: [0.45, 0.05, 3.05], lKnee: [0.25, 1.6, 1.75], rKnee: [0.75, -0.35, 1.55], lFoot: [0.15, 1.9, 0], rFoot: [0.25, -0.95, 0.35], batTip: [-1.75, -0.7, 5.9] },
  }
  const BONES = [['head', 'neck'], ['neck', 'pelvis'], ['lSho', 'rSho'], ['lSho', 'lElb'], ['lElb', 'hands'], ['rSho', 'rElb'], ['rElb', 'hands'], ['lHip', 'rHip'], ['lHip', 'lKnee'], ['lKnee', 'lFoot'], ['rHip', 'rKnee'], ['rKnee', 'rFoot']]
  function blendPose(a, b, u) { const o = {}; for (const k of J) o[k] = v3.lerp(a[k], b[k], u); return o }
  // The batter's pose for a swing clock `s`: <0 stance, 0..1 load, 1..2 launch, 2..2.4 contact, 2.4..3 finish.
  function swingPose(s, swings) {
    const K = SWING
    if (s <= 0) return K.stance
    if (s < 1) return blendPose(K.stance, K.load, ease(s))
    if (!swings) return blendPose(K.load, K.stance, ease(clamp(s - 1, 0, 1)))
    if (s < 2) return blendPose(K.load, K.launch, ease(s - 1))
    if (s < 2.4) return blendPose(K.launch, K.contact, smooth((s - 2) / 0.4))
    return blendPose(K.contact, K.finish, ease(clamp((s - 2.4) / 0.6, 0, 1)))
  }
  // Batter frame → world. A right-handed batter stands on the 3B side (x < 0) and faces +x;
  // a left-handed batter is the mirror image (x > 0, faces -x).
  function batterToWorld(pose, side) {
    const m = side === 'L' ? -1 : 1, bx = -2.75 * m, by = 0.6, o = {}
    for (const k of J) { const p = pose[k]; o[k] = [bx + m * p[0], by + p[1], p[2]] }
    return o
  }

  // A pitcher: set, kick, stride, release, finish. Pitcher frame: x' to his glove side for a RHP,
  // y' toward home (he faces -y in the world), z up. World = mound + (m*x', -y', z).
  const PITCH = {
    set: { head: [0, 0, 5.75], neck: [0, 0, 5.3], lSho: [0.55, 0.05, 5.0], rSho: [-0.55, -0.05, 5.0], lElb: [0.45, 0.45, 4.3], rElb: [-0.45, 0.4, 4.3], hands: [0, 0.6, 4.4], pelvis: [0, 0, 3.3], lHip: [0.4, 0, 3.3], rHip: [-0.4, 0, 3.3], lKnee: [0.45, 0.1, 1.75], rKnee: [-0.45, 0.1, 1.75], lFoot: [0.45, 0, 0], rFoot: [-0.45, 0, 0], ball: [0, 0.6, 4.4] },
    kick: { head: [0, -0.2, 5.75], neck: [0, -0.2, 5.3], lSho: [0.35, 0.3, 5.0], rSho: [-0.4, -0.5, 5.0], lElb: [0.6, 0.4, 4.4], rElb: [-0.2, 0.2, 4.4], hands: [0.15, 0.4, 4.6], pelvis: [0, -0.2, 3.4], lHip: [0.3, 0.1, 3.4], rHip: [-0.3, -0.45, 3.4], lKnee: [0.35, 0.9, 4.0], rKnee: [-0.35, -0.3, 1.8], lFoot: [0.3, 0.6, 2.6], rFoot: [-0.4, -0.3, 0], ball: [0.15, 0.4, 4.6] },
    stride: { head: [0, 1.1, 5.2], neck: [0, 1.0, 4.85], lSho: [0.5, 1.5, 4.7], rSho: [-0.5, 0.4, 4.8], lElb: [0.9, 2.2, 4.6], rElb: [-0.9, -0.3, 4.9], hands: [0, 0, 0], pelvis: [0, 0.8, 3.0], lHip: [0.35, 1.1, 3.0], rHip: [-0.35, 0.5, 3.0], lKnee: [0.35, 2.6, 1.9], rKnee: [-0.4, 0.1, 1.6], lFoot: [0.35, 3.6, 0], rFoot: [-0.4, -0.3, 0], ball: [-1.2, -0.7, 5.6] },
    release: { head: [-0.1, 2.3, 4.9], neck: [-0.1, 2.1, 4.55], lSho: [0.45, 2.1, 4.4], rSho: [-0.55, 2.0, 4.65], lElb: [0.55, 1.6, 3.9], rElb: [-0.8, 2.6, 5.4], hands: [0, 0, 0], pelvis: [0, 1.6, 2.8], lHip: [0.35, 1.9, 2.8], rHip: [-0.35, 1.3, 2.9], lKnee: [0.35, 3.3, 1.6], rKnee: [-0.35, 0.7, 1.5], lFoot: [0.35, 4.6, 0], rFoot: [-0.35, 0.2, 0.4], ball: [-0.55, 3.3, 5.8] },
    finish: { head: [0.2, 2.7, 4.3], neck: [0.15, 2.5, 4.0], lSho: [0.6, 2.2, 3.8], rSho: [-0.3, 2.8, 3.9], lElb: [0.8, 1.7, 3.4], rElb: [0.3, 3.4, 3.1], hands: [0, 0, 0], pelvis: [0, 1.8, 2.7], lHip: [0.35, 2.0, 2.7], rHip: [-0.35, 1.6, 2.9], lKnee: [0.4, 3.4, 1.5], rKnee: [-0.2, 1.6, 1.8], lFoot: [0.35, 4.6, 0], rFoot: [-0.1, 1.2, 1.5], ball: [0.6, 3.6, 2.8] },
  }
  const PJ = ['head', 'neck', 'lSho', 'rSho', 'lElb', 'rElb', 'pelvis', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lFoot', 'rFoot', 'ball']
  const PBONES = [['head', 'neck'], ['neck', 'pelvis'], ['lSho', 'rSho'], ['lSho', 'lElb'], ['rSho', 'rElb'], ['rElb', 'ball'], ['lHip', 'rHip'], ['lHip', 'lKnee'], ['lKnee', 'lFoot'], ['rHip', 'rKnee'], ['rKnee', 'rFoot']]
  function pitcherPose(s) {
    const K = PITCH, bl = (a, b, u) => { const o = {}; for (const k of PJ) o[k] = v3.lerp(a[k], b[k], u); return o }
    if (s <= 0) return K.set
    if (s < 1) return bl(K.set, K.kick, ease(s))
    if (s < 2) return bl(K.kick, K.stride, ease(s - 1))
    if (s < 2.35) return bl(K.stride, K.release, smooth((s - 2) / 0.35))
    return bl(K.release, K.finish, ease(clamp((s - 2.35) / 0.65, 0, 1)))
  }
  function pitcherToWorld(pose, hand, off = [0, 0, 0]) {
    const m = hand === 'L' ? -1 : 1, o = {}
    for (const k of PJ) { const p = pose[k]; o[k] = [MOUND[0] + m * p[0] + off[0], MOUND[1] - 1.5 - p[1] + off[1], 0.8 + p[2] + off[2]] }
    return o
  }
  // Shift the figure so the ball leaves his hand at the measured release point (realFlight's first sample).
  // Capped, so an odd row cannot throw the body off the mound.
  function releaseOffset(pitch, hand) {
    const r = pitcherToWorld(PITCH.release, hand).ball, p = pitch.path[0]
    return [clamp(p[0] - r[0], -2.5, 2.5), clamp(p[1] - r[1], -2, 2), clamp(p[2] - r[2], -1.5, 1.5)]
  }

  // ---- Runners --------------------------------------------------------------------------
  const ORDER = ['home', '1B', '2B', '3B', 'home']
  const baseIndex = (b) => (b == null ? 0 : b === 'score' ? 4 : ORDER.indexOf(b))
  function onPath(dist) { // feet along the base path from home
    const d = clamp(dist, 0, 360), i = Math.min(3, Math.floor(d / 90)), u = (d - i * 90) / 90
    return v3.lerp(BASES[ORDER[i]], BASES[ORDER[i + 1]], u)
  }

  // ---- The director -----------------------------------------------------------------------
  // One timeline per play, all of it after the reveal tap (ADR-0046: nothing before the tap depends on it).
  const BEAT = { dots: 0.12, windup: 0.95, contact: 0.18, settle: 1.0, result: 1.6 }
  function timeline(play) {
    const pitches = play.pitches.filter((p) => p.n && p.path)
    const last = pitches.at(-1)
    const inPlay = last && 'XDE'.includes(last.code)
    const swings = last && 'SXDEFLTM'.includes(last.code)
    const ball = inPlay ? ballPath(play) : null
    const t = {}
    t.dotsEnd = BEAT.dots * Math.max(0, pitches.length - 1)
    t.windupEnd = t.dotsEnd + BEAT.windup
    t.pitchEnd = t.windupEnd + last.T
    t.contactEnd = t.pitchEnd + (ball ? BEAT.contact : 0.25)
    t.chaseEnd = t.contactEnd + (ball ? ball.T : 0)
    t.settleEnd = t.chaseEnd + BEAT.settle
    t.end = t.settleEnd + BEAT.result
    return { play, pitches, last, inPlay, swings, ball, t, fielder: fielderFor(play), pOff: releaseOffset(last, play.pitcher.hand) }
  }
  function fielderFor(play) {
    // The first credit is the fielder who touched the ball first (the 2B on a 4-3), not the putout.
    const c = play.credits[0]
    return c ? c[0] : null
  }
  const tlCache = new Map()
  const tlOf = (play) => { if (!tlCache.has(play.ab)) tlCache.set(play.ab, timeline(play)); return tlCache.get(play.ab) }

  // Everything a concept needs at time t (seconds after the tap). Phase names: dots, windup, pitch,
  // contact, chase, settle, result.
  function stateAt(play, t) {
    const L = tlOf(play), T = L.t
    const phase = t < T.dotsEnd ? 'dots' : t < T.windupEnd ? 'windup' : t < T.pitchEnd ? 'pitch' : t < T.contactEnd ? 'contact' : t < T.chaseEnd ? 'chase' : t < T.settleEnd ? 'settle' : 'result'
    const dotsShown = Math.min(L.pitches.length - 1, Math.floor(t / BEAT.dots) + (t > 0 ? 1 : 0))
    // Pitch: u from 0 to 1 across the flight. The pitcher's clock runs through the windup into release.
    const pitchU = clamp((t - T.windupEnd) / L.last.T, 0, 1)
    const pClock = clamp((t - T.dotsEnd) / BEAT.windup, 0, 1) * 2.35 + clamp((t - T.windupEnd) / 0.6, 0, 1) * 0.65
    // Batter: load during the windup, launch through the flight, contact as the ball arrives.
    // The bat reaches the contact pose (2.4) as the ball reaches the plate, then follows through.
    const bClock = t < T.dotsEnd ? 0 : t < T.windupEnd ? ((t - T.dotsEnd) / BEAT.windup) : t < T.pitchEnd ? 1 + 1.4 * pitchU : 2.4 + 0.6 * clamp((t - T.pitchEnd) / 0.6, 0, 1)
    const pitchPos = t >= T.windupEnd && t < T.pitchEnd + 0.05 ? pitchAt(L.last, pitchU) : null
    // The batted ball.
    let ballPos = null, ballT = 0
    if (L.ball && t >= T.contactEnd) {
      ballT = clamp(t - T.contactEnd, 0, L.ball.T)
      ballPos = L.ball.at(ballT)
    } else if (L.ball && t >= T.pitchEnd) ballPos = pitchAt(L.last, 1)
    // Runners: each runs from its start to its end base across the chase and settle, ~26 ft/s.
    const runStart = L.ball ? T.contactEnd : T.pitchEnd
    const runners = play.runners.map((r) => {
      const a = baseIndex(r.start) * 90, b = r.out ? a + (r.start == null && L.ball?.throw ? 84 : 45) : baseIndex(r.end) * 90
      const d = Math.min(b, a + Math.max(0, t - runStart) * 26)
      // A batter out with no ball in play (a strikeout) never leaves the box.
      const stays = r.out && r.start == null && !L.ball
      return { name: r.name, out: r.out, scored: r.end === 'score' && d >= 360, pos: onPath(d), batter: r.start == null, gone: stays || (r.out && t > T.settleEnd) || d >= 360 }
    })
    // Fielders hold their spots; the one who makes the play runs toward the ball's end point (drawn, not tracked).
    const fielders = {}
    for (const k in POS) fielders[k] = POS[k]
    if (L.ball && L.fielder && POS[L.fielder] && t > T.contactEnd) {
      const to = L.ball.wall?.seats ? polar(L.ball.bearing, L.ball.wall.ft - 4) : (L.ball.field ?? L.ball.land)
      const from = POS[L.fielder], dir = v3.sub([to[0], to[1], 0], from), dist = v3.len(dir)
      const run = Math.min(dist, (t - T.contactEnd) * 24)
      fielders[L.fielder] = v3.add(from, v3.mul(v3.norm(dir), run))
    }
    const thr = L.ball?.throw
    if (thr && POS[thr.to] && t > T.contactEnd) {
      const bag = thr.target, from = POS[thr.to], k = clamp((t - T.contactEnd) / 1.2, 0, 1)
      fielders[thr.to] = v3.lerp(from, [bag[0] - Math.sign(bag[0]) * 1.5, bag[1], 0], smooth(k))
    }
    return {
      t, phase, L, play, dotsShown, pitchU, pitchPos, ballPos, ballT,
      batter: aimSwing(batterToWorld(swingPose(bClock, L.swings), play.batter.side), L, bClock),
      contactNow: phase === 'contact',
      pitcher: pitcherToWorld(pitcherPose(pClock), play.pitcher.hand, L.pOff),
      runners, fielders, done: t >= T.end,
      chaseU: L.ball ? clamp(ballT / L.ball.T, 0, 1) : 0,
    }
  }

  // Bring the bat's sweet spot to where the pitch crossed the plate, most at contact. The keyframes
  // swing at a middle pitch; this bends the arms toward an inside, outside, high or low one.
  function aimSwing(w, L, s) {
    if (!L.swings) return w
    const k = Math.exp(-(((s - 2.4) / 0.45) ** 2))
    if (k < 0.01) return w
    const c = batterToWorld(SWING.contact, L.play.batter.side)
    const sweet = v3.lerp(c.hands, c.batTip, 0.72), end = pitchAt(L.last, 1)
    const d = v3.mul([end[0] - sweet[0], 0, end[2] - sweet[2]], k)
    const o = { ...w }
    o.hands = v3.add(w.hands, d); o.batTip = v3.add(w.batTip, d)
    o.lElb = v3.add(w.lElb, v3.mul(d, 0.55)); o.rElb = v3.add(w.rElb, v3.mul(d, 0.55))
    return o
  }

  // ---- Cameras ------------------------------------------------------------------------------
  function camera(pos, target, vfov) {
    const f = v3.norm(v3.sub(target, pos))
    let r = v3.cross(f, [0, 0, 1]); if (v3.len(r) < 1e-6) r = [1, 0, 0]; r = v3.norm(r)
    const u = v3.cross(r, f)
    return { pos, target, f, r, u, k: 1 / Math.tan(((vfov || 30) * Math.PI) / 360) }
  }
  // → {x, y} in px for a W×H canvas, d = depth (ft), s = px per ft at that depth. Null behind the camera.
  function project(cam, p, W, H) {
    const q = v3.sub(p, cam.pos), d = v3.dot(q, cam.f)
    if (d < 0.5) return null
    const sx = (v3.dot(q, cam.r) * cam.k) / d, sy = (v3.dot(q, cam.u) * cam.k) / d
    const half = H / 2
    return { x: W / 2 + sx * half, y: H / 2 - sy * half, d, s: (cam.k * half) / d }
  }
  // The vertical field of view to use: `vfov`, or wider when the stage is so narrow that the horizontal
  // half-angle would fall under `minHalfH` degrees.
  function vfovFor(vfov, minHalfH, aspect) {
    const needHalfV = Math.atan(Math.tan((minHalfH * Math.PI) / 180) / Math.max(0.2, aspect)) * 180 / Math.PI
    return Math.max(vfov, 2 * needHalfV)
  }
  const CAMS = {
    // Behind home plate, a little high: the pitch view (MLB Gameday's angle).
    // `aspect` = W / H. A tall phone stage keeps at least 6 ft either side of the plate in view, so the
    // vertical field of view widens instead of cutting off the batter.
    home: (aspect = 1.3) => camera([0, -30, 7.2], [0, 30, 2.2], vfovFor(23, 11.3, aspect)),
    // High home: a wide look from above and behind the plate (a TV "high home" camera).
    highHome: (aspect = 1.3) => camera([0, -150, 95], [0, 200, 0], vfovFor(42, 24, aspect)),
    // The chase camera: a pure function of the ball's clock, so a frame strip or a scrub bar gets the
    // same picture as playback. It sits `lag` ft behind where the ball was `delay` s ago, `up` ft above
    // it, and looks a little ahead of the ball. `fov` widens as the ball comes down so the landing shows.
    chase(state, opts = {}) {
      const L = state.L
      if (!L.ball) return CAMS.home(opts.aspect)
      const T = L.ball.T, bt = state.ballT, dir = v3.norm(polar(L.ball.bearing, 1))
      const lag = opts.lag ?? 60, up = opts.up ?? 22, delay = opts.delay ?? 0.45
      const behind = L.ball.at(Math.max(0, bt - delay)), ahead = L.ball.at(Math.min(T, bt + (opts.lead ?? 0.35)))
      const pos = v3.add(v3.sub(behind, v3.mul(dir, lag)), [0, 0, up + behind[2] * 0.55])
      const mid = v3.lerp(state.ballPos || behind, ahead, 0.5)
      const target = [mid[0], mid[1], mid[2] * 0.7]
      return camera(pos, target, vfovFor((opts.fov ?? 50) + 12 * smooth(state.chaseU), 26, opts.aspect ?? 1.3))
    },
    // A cut-free move from one camera to another, u in [0, 1].
    blend(a, b, u) { const e = smooth(clamp(u, 0, 1)); return camera(v3.lerp(a.pos, b.pos, e), v3.lerp(a.target, b.target, e), lerp(2 * Math.atan(1 / a.k) * 180 / Math.PI, 2 * Math.atan(1 / b.k) * 180 / Math.PI, e)) },
  }

  window.GD = {
    D, clamp, lerp, ease, smooth, v3, BASES, MOUND, POS, polar, wallAt, wallLine, pitchAt, ballPath,
    J, BONES, SWING, swingPose, batterToWorld, PJ, PBONES, pitcherPose, pitcherToWorld, onPath,
    timeline: tlOf, stateAt, camera, project, CAMS, vfovFor,
    plays: D.plays, playByAb: (ab) => D.plays.find((p) => p.ab === ab),
    concepts: [], register(c) { this.concepts.push(c) },
  }
})()
