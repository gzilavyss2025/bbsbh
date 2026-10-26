// Concept: low-poly 3D (three.js r128, global THREE). Code-built figures, colour-only uniforms
// (option A in #2580), one continuous camera like a console batting camera. Design round only.
// `draw` is a pure function of the state: the static scene is built once, each draw only moves things.
;(function () {
  const V = GD.v3, clamp = GD.clamp, lerp = GD.lerp, smooth = GD.smooth

  const COL = {
    sky: 0xa9cbe6, skyTop: 0x5f93c7, fog: 0xbcd3e6,
    grass: 0x3f8a3c, stripe: 0x4c9a46, infieldGrass: 0x4a9645, dirt: 0xb9875a, track: 0xa87c55, mound: 0xb07f53,
    chalk: 0xf6f3ea, base: 0xffffff, wall: 0x2f5d3a, wallTop: 0x284f31, board: 0x1f3b27, riser: 0x8d9198, backWall: 0x3b4650,
    skin: 0xc99273, bat: 0xc8a06a, glove: 0x7a4a26, ball: 0xffffff,
  }
  // Colour-only kits. SEA road grey, navy and teal; BOS home white, red and navy; the umpire dark.
  const KIT = {
    sea: { jersey: 0xa3a8ae, sleeve: 0x0c2c56, pants: 0xa3a8ae, socks: 0x0c2c56, shoes: 0x14171c, cap: 0x0c2c56, belt: 0x005c5c },
    bos: { jersey: 0xf3f1ea, sleeve: 0x0c2340, pants: 0xf3f1ea, socks: 0xbd3039, shoes: 0x0c2340, cap: 0x0c2340, belt: 0xbd3039 },
    ump: { jersey: 0x1d2633, sleeve: 0x1d2633, pants: 0x3c4148, socks: 0x22262c, shoes: 0x111111, cap: 0x111111, belt: 0x111111 },
  }

  // ---- Static poses (figure frame: faces +y, right is +x, z up, feet) ---------------------------
  const READY = { head: [0, 0.75, 5.05], neck: [0, 0.6, 4.6], lSho: [-0.65, 0.5, 4.35], rSho: [0.65, 0.5, 4.35], lElb: [-0.85, 1.0, 3.55], rElb: [0.85, 1.0, 3.55], lHand: [-0.45, 1.55, 2.95], rHand: [0.45, 1.55, 2.95], pelvis: [0, 0, 2.9], lHip: [-0.45, 0, 2.9], rHip: [0.45, 0, 2.9], lKnee: [-0.9, 0.75, 1.6], rKnee: [0.9, 0.75, 1.6], lFoot: [-0.95, 0.25, 0], rFoot: [0.95, 0.25, 0] }
  const CROUCH = { head: [0, 0.35, 3.5], neck: [0, 0.2, 3.1], lSho: [-0.65, 0.1, 2.9], rSho: [0.65, 0.1, 2.9], lElb: [-0.85, 0.7, 2.4], rElb: [0.85, 0.55, 2.2], lHand: [-0.45, 1.25, 2.55], rHand: [0.5, 0.8, 1.9], pelvis: [0, -0.25, 1.5], lHip: [-0.45, -0.25, 1.5], rHip: [0.45, -0.25, 1.5], lKnee: [-1.0, 0.9, 1.3], rKnee: [1.0, 0.9, 1.3], lFoot: [-0.9, 0, 0], rFoot: [0.9, 0, 0] }
  const UMP = { head: [0, 0.55, 5.0], neck: [0, 0.4, 4.6], lSho: [-0.7, 0.3, 4.35], rSho: [0.7, 0.3, 4.35], lElb: [-0.85, 0.75, 3.5], rElb: [0.85, 0.75, 3.5], lHand: [-0.6, 0.9, 2.6], rHand: [0.6, 0.9, 2.6], pelvis: [0, -0.2, 2.9], lHip: [-0.45, -0.2, 2.9], rHip: [0.45, -0.2, 2.9], lKnee: [-0.85, 0.5, 1.6], rKnee: [0.85, 0.5, 1.6], lFoot: [-0.95, 0.1, 0], rFoot: [0.95, 0.1, 0] }
  const RUN = { head: [0, 0.75, 5.2], neck: [0, 0.55, 4.75], lSho: [-0.65, 0.4, 4.45], rSho: [0.65, 0.4, 4.45], lElb: [-0.8, -0.25, 3.8], rElb: [0.8, 0.9, 3.95], lHand: [-0.7, 0.15, 3.2], rHand: [0.6, 1.25, 4.5], pelvis: [0, 0, 3.0], lHip: [-0.45, 0, 3.0], rHip: [0.45, 0, 3.0], lKnee: [-0.4, 1.05, 1.95], rKnee: [0.4, -0.45, 1.45], lFoot: [-0.4, 1.4, 0.3], rFoot: [0.4, -1.35, 0.95] }

  // ---- Small helpers ---------------------------------------------------------------------------
  const sky = (THREE) => {
    const g = new THREE.SphereGeometry(2600, 16, 10)
    const pos = g.attributes.position, c = new Float32Array(pos.count * 3)
    const a = new THREE.Color(COL.sky), b = new THREE.Color(COL.skyTop), tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) { const u = clamp(pos.getZ(i) / 2600, 0, 1); tmp.copy(a).lerp(b, Math.pow(u, 0.6)); c.set([tmp.r, tmp.g, tmp.b], i * 3) }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }))
  }
  // A flat shape on the ground. Drawn in order (renderOrder), without depth writes: from a camera that
  // is always above the ground, later solid things are always in front of it.
  function flat(THREE, pts, color, order, z = 0) {
    const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])))
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshLambertMaterial({ color, depthWrite: false }))
    m.position.z = z; m.renderOrder = order
    return m
  }
  // Many quads in one geometry, with a colour per quad (stripes, chalk, stands).
  function quadBatch(THREE) {
    const P = [], C = []
    const c = new THREE.Color()
    return {
      quad(a, b, cc, d, color) {
        c.set(color)
        for (const p of [a, b, cc, a, cc, d]) { P.push(p[0], p[1], p[2]); C.push(c.r, c.g, c.b) }
      },
      mesh(mat) {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
        g.computeVertexNormals()
        return new THREE.Mesh(g, mat)
      },
    }
  }
  const strip = (q, a, b, w, color, z = 0) => { // a chalk line from a to b, w ft wide
    const d = V.norm(V.sub(b, a)), n = [-d[1] * w / 2, d[0] * w / 2, 0]
    q.quad([a[0] + n[0], a[1] + n[1], z], [b[0] + n[0], b[1] + n[1], z], [b[0] - n[0], b[1] - n[1], z], [a[0] - n[0], a[1] - n[1], z], color)
  }

  function textTexture(THREE, draw, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    draw(cv.getContext('2d'), w, h)
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4
    return t
  }
  const TYPE2 = (t) => ({ FF: 'FF', SI: 'SI', FT: 'SI', CH: 'CH', CU: 'CU', KC: 'CU', SL: 'SL', ST: 'SW', SV: 'SV', FC: 'FC', FS: 'FS', KN: 'KN' })[t] || (t || '--').slice(0, 2)
  const CALL = (code) => (['X', 'D', 'E'].includes(code) ? 'X' : ['B', '*B', 'I', 'P', 'V', 'H'].includes(code) ? 'B' : 'S')

  GD.register({
    id: '3d', name: 'Low-poly 3D', dims: '3D', camera: 'continuous',
    look: 'Flat-shaded low-poly figures built in code, club colours as the uniform, one moving camera.',
    notes: [
      'One camera, no cuts: it starts behind the plate, lifts after contact and rides behind the ball to where it lands.',
      'The figures are boxes and cylinders on the same skeleton as the other concepts. Uniforms are colours only, no MLB art.',
      'Watch the home run clear the 37.3 ft wall into the seats, and the popup: the camera looks up, then down to the fielder.',
      'The frame-rate meter is the real test: open this page on an iPhone and play the home run.',
    ],
    create(canvas) {
      const THREE = window.THREE
      let R
      try {
        if (!THREE) throw new Error('no three')
        R = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
      } catch (e) {
        const g = canvas.getContext('2d')
        return {
          draw(st, W, H) {
            if (!g) return
            g.fillStyle = '#1d2a22'; g.fillRect(0, 0, W, H); g.fillStyle = '#f3f1ea'
            g.font = `${Math.round(H / 18)}px system-ui, sans-serif`; g.textAlign = 'center'
            g.fillText('The 3D concept needs WebGL, which this browser has turned off.', W / 2, H / 2)
          },
          destroy() {},
        }
      }
      R.setPixelRatio(1)
      const scene = new THREE.Scene()
      scene.fog = new THREE.Fog(COL.fog, 520, 1900)
      const cam = new THREE.PerspectiveCamera(30, 1.3, 0.5, 5200)
      cam.up.set(0, 0, 1)
      { const s = sky(THREE); s.renderOrder = -10; scene.add(s) }
      scene.add(new THREE.HemisphereLight(0xe6f2ff, 0x52703f, 0.78))
      const sun = new THREE.DirectionalLight(0xfff4e0, 0.7); sun.position.set(-320, -260, 520); scene.add(sun)

      // ---- Field (flat layers, in order) ----
      scene.add(flat(THREE, [[-2600, -2600], [2600, -2600], [2600, 2600], [-2600, 2600]], COL.grass, 0))
      {
        const q = quadBatch(THREE)
        for (let x = -480; x < 480; x += 36) q.quad([x, -60, 0], [x + 18, -60, 0], [x + 18, 520, 0], [x, 520, 0], COL.stripe)
        // A crosscut in the infield grass and a band in the outfield, for the checkerboard look.
        for (let y = 170; y < 470; y += 36) q.quad([-480, y, 0], [480, y, 0], [480, y + 8, 0], [-480, y + 8, 0], COL.stripe)
        const m = q.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false })); m.renderOrder = 1; scene.add(m)
      }
      // The warning track: a band 15 ft deep inside the wall.
      {
        const wl = GD.wallLine(60), pts = []
        for (const w of wl) pts.push(GD.polar(w.deg, w.foot ? Math.hypot(w.foot[0], w.foot[1]) - 15 : 300))
        for (const w of [...wl].reverse()) pts.push(GD.polar(w.deg, Math.hypot(w.foot[0], w.foot[1]) + 4))
        scene.add(flat(THREE, pts, COL.track, 2))
      }
      // The infield skin: home, out along the lines to the arc 95 ft round the rubber, and back.
      {
        const pts = [[0, -4]], c = [0, 60.5], r = 95
        const a1 = Math.atan2(127.6 * Math.cos(Math.PI / 4) - c[1], 127.6 * Math.sin(Math.PI / 4)) // 1B end of the arc
        const a0 = Math.PI - a1
        pts.push([127.6 * Math.SQRT1_2 + 3, 127.6 * Math.SQRT1_2 - 3])
        for (let i = 0; i <= 24; i++) { const a = a1 + ((a0 - a1) * i) / 24; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]) }
        pts.push([-127.6 * Math.SQRT1_2 - 3, 127.6 * Math.SQRT1_2 - 3])
        scene.add(flat(THREE, pts, COL.dirt, 3))
      }
      // The infield grass, a square 4 ft inside the baselines.
      {
        const B = GD.BASES, k = 6
        scene.add(flat(THREE, [[0, k], [B['1B'][0] - k, B['1B'][1]], [0, B['2B'][1] - k], [B['3B'][0] + k, B['3B'][1]]], COL.infieldGrass, 4))
      }
      // Circles: home plate area, base cutouts, the mound.
      const circle = (cx, cy, r, n = 20) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)])
      scene.add(flat(THREE, circle(0, 0.5, 13, 24), COL.dirt, 5))
      for (const b of ['1B', '3B']) scene.add(flat(THREE, circle(GD.BASES[b][0], GD.BASES[b][1], 9, 16), COL.dirt, 5))
      {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(4, 9, 0.85, 14, 1), new THREE.MeshPhongMaterial({ color: COL.mound, flatShading: true, shininess: 0 }))
        m.rotation.x = Math.PI / 2; m.position.set(0, 59, 0.42); scene.add(m)
        const rub = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.15), new THREE.MeshLambertMaterial({ color: COL.base }))
        rub.position.set(0, 60.5, 0.9); scene.add(rub)
      }
      // Chalk: foul lines, batter's boxes, catcher's box.
      {
        const q = quadBatch(THREE), W = 0.33, C = COL.chalk
        strip(q, [0, 0, 0], GD.polar(45, Math.hypot(...GD.wallLine(2)[2].foot.slice(0, 2))), W, C)
        strip(q, [0, 0, 0], GD.polar(-45, 309), W, C)
        for (const s of [-1, 1]) {
          const x0 = s * 0.71 + s * 0.5, x1 = x0 + s * 4, y0 = -2.3, y1 = 3.7
          strip(q, [x0, y0, 0], [x0, y1, 0], W, C); strip(q, [x1, y0, 0], [x1, y1, 0], W, C)
          strip(q, [x0, y0, 0], [x1, y0, 0], W, C); strip(q, [x0, y1, 0], [x1, y1, 0], W, C)
        }
        strip(q, [-1.75, -2.3, 0], [-1.75, -10, 0], W, C); strip(q, [1.75, -2.3, 0], [1.75, -10, 0], W, C)
        const m = q.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false })); m.renderOrder = 6; scene.add(m)
      }
      // Home plate and the bases.
      {
        const hp = flat(THREE, [[0, 0], [0.71, 0.71], [0.71, 1.42], [-0.71, 1.42], [-0.71, 0.71]], COL.base, 7)
        hp.material = new THREE.MeshBasicMaterial({ color: COL.base, depthWrite: false }); scene.add(hp)
        const bg = new THREE.BoxGeometry(1.25, 1.25, 0.3), bm = new THREE.MeshLambertMaterial({ color: COL.base })
        for (const b of ['1B', '2B', '3B']) { const m = new THREE.Mesh(bg, bm); m.position.set(GD.BASES[b][0], GD.BASES[b][1], 0.15); m.rotation.z = Math.PI / 4; scene.add(m) }
      }
      // ---- The wall and the stands ----
      const WL = GD.wallLine(46)
      {
        const q = quadBatch(THREE)
        for (let i = 0; i < WL.length - 1; i++) {
          const a = WL[i], b = WL[i + 1]
          q.quad(a.foot, b.foot, b.top, a.top, COL.wall)
          // The cap of the wall, so it reads as a solid slab from above.
          const da = V.mul(V.norm([a.foot[0], a.foot[1], 0]), 1.5), db = V.mul(V.norm([b.foot[0], b.foot[1], 0]), 1.5)
          q.quad(a.top, b.top, V.add(b.top, db), V.add(a.top, da), COL.wallTop)
        }
        // A plain dark panel on the Monster where Fenway's hand-turned board hangs. No numbers.
        for (let i = 0; i < WL.length - 1; i++) {
          const a = WL[i], b = WL[i + 1]
          if (a.deg < -30 || b.deg > -16) continue
          const ia = V.mul(V.norm([a.foot[0], a.foot[1], 0]), -0.4), ib = V.mul(V.norm([b.foot[0], b.foot[1], 0]), -0.4)
          q.quad(V.add([a.foot[0], a.foot[1], 9], ia), V.add([b.foot[0], b.foot[1], 9], ib), V.add([b.foot[0], b.foot[1], 26], ib), V.add([a.foot[0], a.foot[1], 26], ia), COL.board)
        }
        scene.add(q.mesh(new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, side: THREE.DoubleSide })))
      }
      // Stands: rows that step up and out from an inner edge: the wall, the two foul sides, behind home.
      const ROWS = 7, RUNF = 6, RISE = 3.3
      const standBase = (h) => h + 1.5
      {
        const edge = []
        const d3 = GD.polar(-45, 1), d1 = GD.polar(45, 1)
        for (let s = 40; s <= 300; s += 26) edge.push({ p: V.add(V.mul(d3, s), V.mul([-0.7071, -0.7071, 0], 34)), h: 4 })
        for (const w of WL) edge.push({ p: V.add(w.foot, V.mul(V.norm([w.foot[0], w.foot[1], 0]), 1.5)), h: w.h })
        for (let s = 300; s >= 40; s -= 26) edge.push({ p: V.add(V.mul(d1, s), V.mul([0.7071, -0.7071, 0], 34)), h: 4 })
        const center = [0, 150, 0]
        const q = quadBatch(THREE)
        const crowd = [0x34465e, 0x7d4a48, 0x9a978f, 0x5d6470, 0x3d5a47, 0x48536a, 0x86625a, 0x777c86]
        let seed = 7
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
        const nrm = (i) => {
          const a = edge[Math.max(0, i - 1)].p, b = edge[Math.min(edge.length - 1, i + 1)].p
          let n = V.norm([b[1] - a[1], -(b[0] - a[0]), 0])
          if (V.dot(n, V.sub(edge[i].p, center)) < 0) n = V.mul(n, -1)
          return n
        }
        for (let i = 0; i < edge.length - 1; i++) {
          const A = edge[i], B = edge[i + 1], nA = nrm(i), nB = nrm(i + 1)
          for (let r = 0; r < ROWS; r++) {
            const o0 = 2 + r * RUNF, o1 = o0 + RUNF
            const zA0 = standBase(A.h) + (r - 1) * RISE, zA = standBase(A.h) + r * RISE, zB0 = standBase(B.h) + (r - 1) * RISE, zB = standBase(B.h) + r * RISE
            const pA0 = V.add(A.p, V.mul(nA, o0)), pB0 = V.add(B.p, V.mul(nB, o0)), pA1 = V.add(A.p, V.mul(nA, o1)), pB1 = V.add(B.p, V.mul(nB, o1))
            if (r === 0) q.quad([A.p[0], A.p[1], A.h], [B.p[0], B.p[1], B.h], [pB0[0], pB0[1], zB], [pA0[0], pA0[1], zA], COL.riser)
            else q.quad([pA0[0], pA0[1], zA0], [pB0[0], pB0[1], zB0], [pB0[0], pB0[1], zB], [pA0[0], pA0[1], zA], COL.riser)
            q.quad([pA0[0], pA0[1], zA], [pB0[0], pB0[1], zB], [pB1[0], pB1[1], zB], [pA1[0], pA1[1], zA], crowd[Math.floor(rnd() * crowd.length)])
          }
          const oT = 2 + ROWS * RUNF, zAT = standBase(A.h) + (ROWS - 1) * RISE, zBT = standBase(B.h) + (ROWS - 1) * RISE
          const pAT = V.add(A.p, V.mul(nA, oT)), pBT = V.add(B.p, V.mul(nB, oT))
          q.quad([pAT[0], pAT[1], zAT], [pBT[0], pBT[1], zBT], [pBT[0], pBT[1], zBT + 7], [pAT[0], pAT[1], zAT + 7], COL.backWall)
        }
        scene.add(q.mesh(new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, side: THREE.DoubleSide })))
      }
      // The stand surface past the wall, for where a home run comes down.
      const standZ = (deg, d) => {
        const w = GD.wallAt(deg), o = d - w.ft - 1.5 - 2
        if (o < 0) return w.h
        return standBase(w.h) + Math.min(ROWS - 1, Math.floor(o / RUNF)) * RISE
      }

      // ---- Figures ----
      const mats = new Map()
      const mat = (c) => { if (!mats.has(c)) mats.set(c, new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 6 })); return mats.get(c) }
      const G = {
        limb: new THREE.CylinderGeometry(1, 0.82, 1, 6, 1), // unit; scaled per bone (radius in x/z, length in y)
        box: new THREE.BoxGeometry(1, 1, 1),
        head: new THREE.IcosahedronGeometry(0.42, 0),
        cap: new THREE.SphereGeometry(0.47, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2),
        hand: new THREE.IcosahedronGeometry(0.16, 0),
        glove: new THREE.IcosahedronGeometry(0.3, 0),
        bat: new THREE.CylinderGeometry(0.11, 0.045, 1, 8, 1),
      }
      const UPY = new THREE.Vector3(0, 1, 0), tA = new THREE.Vector3(), tB = new THREE.Vector3(), tD = new THREE.Vector3()
      const tM = new THREE.Matrix4(), tS = new THREE.Vector3(), tQ = new THREE.Quaternion()
      const bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3()
      // A cylinder (unit, along y) from a to b with radius r → matrix.
      function boneMatrix(out, a, b, r) {
        tA.set(a[0], a[1], a[2]); tB.set(b[0], b[1], b[2]); tD.subVectors(tB, tA)
        const len = Math.max(0.01, tD.length())
        tQ.setFromUnitVectors(UPY, tD.multiplyScalar(1 / len))
        tS.set(r, len, r)
        tA.add(tB).multiplyScalar(0.5)
        return out.compose(tA, tQ, tS)
      }
      // A box with its own axes: side (x), up (y), forward (z), centred at c, size s.
      function basisMatrix(out, c, side, up, fwd, s) {
        bx.set(side[0], side[1], side[2]); by.set(up[0], up[1], up[2]); bz.set(fwd[0], fwd[1], fwd[2])
        out.makeBasis(bx.multiplyScalar(s[0]), by.multiplyScalar(s[1]), bz.multiplyScalar(s[2]))
        out.setPosition(c[0], c[1], c[2])
        return out
      }
      // The parts of one body: [{ geo, color, mat(m4, joints, facing) }]. Joint names follow the
      // engine (hands shared for the batter; the pitcher's throwing hand is `ball`).
      function frameOf(j, facing) {
        const up = V.norm(V.sub(j.neck, j.pelvis))
        let side = V.sub(j.lSho, j.rSho); side = V.norm(V.sub(side, V.mul(up, V.dot(side, up))))
        let fwd = V.cross(side, up)
        if (V.dot(fwd, facing) < 0) { fwd = V.mul(fwd, -1); side = V.mul(side, -1) }
        return { up, side, fwd }
      }
      function partsOf(kit, kind) {
        const P = []
        const bone = (a, b, r, c) => P.push({ geo: G.limb, color: c, set: (m, j) => boneMatrix(m, j[a], j[b], r) })
        P.push({ geo: G.box, color: kit.jersey, set: (m, j, f) => {
          const top = V.add(j.neck, V.mul(f.up, -0.15)), bot = V.add(j.pelvis, V.mul(f.up, 0.35))
          const sw = V.len(V.sub(j.lSho, j.rSho)) + 0.25
          return basisMatrix(m, V.lerp(top, bot, 0.5), f.side, f.up, f.fwd, [sw, V.len(V.sub(top, bot)) + 0.2, 0.78])
        } })
        P.push({ geo: G.box, color: kit.pants, set: (m, j, f) => basisMatrix(m, V.add(j.pelvis, V.mul(f.up, 0.05)), f.side, f.up, f.fwd, [1.15, 0.85, 0.72]) })
        P.push({ geo: G.box, color: kit.belt, set: (m, j, f) => basisMatrix(m, V.add(j.pelvis, V.mul(f.up, 0.45)), f.side, f.up, f.fwd, [1.18, 0.14, 0.75]) })
        P.push({ geo: G.head, color: COL.skin, set: (m, j) => m.makeTranslation(j.head[0], j.head[1], j.head[2]) })
        P.push({ geo: G.cap, color: kit.cap, set: (m, j, f) => basisMatrix(m, V.add(j.head, V.mul(f.up, 0.08)), f.side, f.up, f.fwd, [1, 1, 1]) })
        P.push({ geo: G.box, color: kit.cap, set: (m, j, f) => basisMatrix(m, V.add(V.add(j.head, V.mul(f.fwd, 0.45)), V.mul(f.up, 0.12)), f.side, f.up, f.fwd, [0.62, 0.06, 0.42]) })
        const hand = kind === 'pitcher' ? 'ball' : kind === 'batter' ? 'hands' : null
        bone('lSho', 'lElb', 0.21, kit.jersey); bone('rSho', 'rElb', 0.21, kit.jersey)
        const glovePt = (j) => V.add(j.lElb, V.mul(V.sub(j.lElb, j.lSho), 0.85))
        if (kind === 'batter') { bone('lElb', 'hands', 0.16, kit.sleeve); bone('rElb', 'hands', 0.16, kit.sleeve) }
        else if (kind === 'pitcher') {
          bone('rElb', 'ball', 0.16, kit.sleeve)
          P.push({ geo: G.limb, color: kit.sleeve, set: (m, j) => boneMatrix(m, j.lElb, glovePt(j), 0.16) })
        } else { bone('lElb', 'lHand', 0.16, kit.sleeve); bone('rElb', 'rHand', 0.16, kit.sleeve) }
        bone('lHip', 'lKnee', 0.29, kit.pants); bone('rHip', 'rKnee', 0.29, kit.pants)
        bone('lKnee', 'lFoot', 0.21, kit.socks); bone('rKnee', 'rFoot', 0.21, kit.socks)
        for (const k of ['lFoot', 'rFoot']) P.push({ geo: G.box, color: kit.shoes, set: (m, j, f) => basisMatrix(m, V.add(j[k], V.add(V.mul(f.fwd, 0.25), [0, 0, 0.12])), f.side, [0, 0, 1], V.norm([f.fwd[0], f.fwd[1], 0]), [0.4, 0.26, 1.0]) })
        if (kind === 'batter') {
          P.push({ geo: G.hand, color: COL.skin, set: (m, j) => m.makeTranslation(j.hands[0], j.hands[1], j.hands[2]) })
          P.push({ geo: G.bat, color: COL.bat, set: (m, j) => {
            tA.set(j.hands[0], j.hands[1], j.hands[2]); tB.set(j.batTip[0], j.batTip[1], j.batTip[2]); tD.subVectors(tB, tA)
            const len = tD.length(); tQ.setFromUnitVectors(UPY, tD.multiplyScalar(1 / len))
            // The knob sits a hand's width under the hands.
            tA.addScaledVector(tD, len * 0.5 - 0.2); tS.set(1, len + 0.4, 1)
            return m.compose(tA, tQ, tS)
          } })
        } else if (kind === 'pitcher') {
          P.push({ geo: G.hand, color: COL.skin, set: (m, j) => m.makeTranslation(j.ball[0], j.ball[1], j.ball[2]) })
          P.push({ geo: G.glove, color: COL.glove, set: (m, j) => { const g = glovePt(j); return m.makeTranslation(g[0], g[1], g[2]) } })
        } else {
          P.push({ geo: G.glove, color: COL.glove, set: (m, j) => m.makeTranslation(j.lHand[0], j.lHand[1], j.lHand[2]) })
          P.push({ geo: G.hand, color: COL.skin, set: (m, j) => m.makeTranslation(j.rHand[0], j.rHand[1], j.rHand[2]) })
        }
        return P
      }
      // An animated body: one mesh per part, matrices set each draw.
      function rig(kit, kind) {
        const parts = partsOf(kit, kind).map((p) => {
          const m = new THREE.Mesh(p.geo, mat(p.color)); m.matrixAutoUpdate = false; scene.add(m); return { p, m }
        })
        return {
          pose(j, facing) { const f = frameOf(j, facing); for (const x of parts) { x.p.set(x.m.matrix, j, f); x.m.matrixWorldNeedsUpdate = true } },
          show(v) { for (const x of parts) x.m.visible = v },
        }
      }
      // A still body (fielder, runner, catcher, umpire): one merged mesh, moved and turned as a whole.
      function statue(kit, pose, material) {
        const P = [], C = [], col = new THREE.Color(), m4 = new THREE.Matrix4()
        const f = frameOf(pose, [0, 1, 0])
        for (const p of partsOf(kit, 'fielder')) {
          const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()
          p.set(m4, pose, f); g.applyMatrix4(m4)
          const pos = g.attributes.position; col.set(p.color)
          for (let i = 0; i < pos.count; i++) { P.push(pos.getX(i), pos.getY(i), pos.getZ(i)); C.push(col.r, col.g, col.b) }
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
        g.computeVertexNormals()
        const m = new THREE.Mesh(g, material || new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 6 }))
        scene.add(m)
        return m
      }
      const batter = rig(KIT.sea, 'batter')
      const pitcher = rig(KIT.bos, 'pitcher')
      const fieldKeys = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF']
      const fielders = {}
      const catMat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 6, transparent: true, opacity: 1 })
      for (const k of fieldKeys) fielders[k] = statue(KIT.bos, k === 'C' ? CROUCH : READY, k === 'C' ? catMat : null)
      const umpMat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 6, transparent: true, opacity: 1 })
      const ump = statue(KIT.ump, UMP, umpMat); ump.position.set(0.4, -6.6, 0)
      const runners = Array.from({ length: 4 }, () => statue(KIT.sea, RUN))
      // Blob shadows: soft dark discs under bodies and the ball.
      const blobTex = textTexture(THREE, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h) }, 64, 64)
      const blobGeo = new THREE.PlaneGeometry(1, 1)
      const blob = (size, op = 1) => { const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: op })); m.scale.set(size, size, 1); m.renderOrder = 8; scene.add(m); return m }
      const blobs = { batter: blob(3.2), pitcher: blob(3.2), ump: blob(3.0) }
      for (const k of fieldKeys) blobs[k] = blob(3.0)
      const runBlobs = runners.map(() => blob(2.8))
      const ballShadow = blob(1, 1)

      // ---- Ball, trail, zone, dots, tag, flash ----
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.121, 1), new THREE.MeshBasicMaterial({ color: COL.ball }))
      scene.add(ball)
      const haloTex = textTexture(THREE, (g, w, h) => { g.strokeStyle = 'rgba(15,24,34,0.9)'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 16, 0, Math.PI * 2); g.stroke() }, 64, 64)
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, depthTest: false, transparent: true })); halo.renderOrder = 19; scene.add(halo)
      const TRAIL = 16
      const trailGeo = new THREE.BufferGeometry()
      const trailPos = new Float32Array(TRAIL * 2 * 3)
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
      { const idx = []; for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) } trailGeo.setIndex(idx) }
      const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }))
      trail.frustumCulled = false; trail.renderOrder = 12; scene.add(trail)
      const zoneGeo = new THREE.BufferGeometry(); zoneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3))
      const zone = new THREE.Line(zoneGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }))
      zone.frustumCulled = false; scene.add(zone)
      const texCache = new Map()
      const DOTCOL = { B: ['#f6f3ea', '#1b2a3a'], S: ['#c8453a', '#ffffff'], X: ['#f2c14e', '#1b2a3a'] }
      const dotTex = (label, kind) => {
        const key = label + kind
        if (!texCache.has(key)) texCache.set(key, textTexture(THREE, (g, w, h) => {
          const [bg, fg] = DOTCOL[kind]
          g.fillStyle = bg; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); g.fill()
          g.lineWidth = 4; g.strokeStyle = 'rgba(15,24,34,0.65)'; g.stroke()
          g.fillStyle = fg; g.font = `700 ${label.length > 1 ? 58 : 72}px "JetBrains Mono", ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'
          g.fillText(label, w / 2, h / 2 + 4)
        }, 128, 128))
        return texCache.get(key)
      }
      const tagTex = (text) => {
        if (!texCache.has(text)) texCache.set(text, textTexture(THREE, (g, w, h) => {
          g.fillStyle = 'rgba(15,24,34,0.86)'; g.fillRect(0, 0, w, h)
          g.fillStyle = '#f6f3ea'; g.font = '700 60px "JetBrains Mono", ui-monospace, monospace'; g.textBaseline = 'middle'; g.fillText(text, 18, h / 2 + 3)
        }, 384, 96))
        return texCache.get(text)
      }
      const dots = Array.from({ length: 14 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: true })); s.scale.set(0.62, 0.62, 1); s.renderOrder = 14; scene.add(s); return s })
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true })); tag.scale.set(2.2, 0.55, 1); tag.renderOrder = 20; scene.add(tag)
      const flashTex = textTexture(THREE, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,240,190,0.85)'); r.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h) }, 128, 128)
      const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, depthTest: false, transparent: true })); flash.renderOrder = 21; scene.add(flash)

      // ---- Per play: where a home run comes down on the stands ----
      const landCache = new Map()
      function landInfo(L) {
        if (landCache.has(L.play.ab)) return landCache.get(L.play.ab)
        const b = L.ball, w = GD.wallAt(b.bearing)
        let tl = b.T, tApex = 0, zMax = -1
        for (let t = 0; t <= b.T; t += 0.01) {
          const q = b.at(t), d = Math.hypot(q[0], q[1])
          if (q[2] > zMax) { zMax = q[2]; tApex = t }
          if (d > w.ft + 1.5 && q[2] <= standZ(b.bearing, d)) { tl = t; break }
        }
        const info = { tl, tApex }
        landCache.set(L.play.ab, info)
        return info
      }
      const landT = (L) => (L.ball ? landInfo(L).tl : 0)
      function ballAt(L, t) {
        const tl = landT(L), p = L.ball.at(Math.min(t, tl))
        if (t >= tl && tl < L.ball.T) { const d = Math.hypot(p[0], p[1]); return [p[0], p[1], standZ(L.ball.bearing, d) + 0.15] }
        return p
      }
      const groundZ = (p) => { const d = Math.hypot(p[0], p[1]); const deg = (Math.atan2(p[0], p[1]) * 180) / Math.PI; const w = GD.wallAt(deg); return d > w.ft + 1.5 && Math.abs(deg) <= 45 ? standZ(deg, d) : 0.02 }

      // ---- The camera: one continuous move ----
      const HOME_BLEND = 0.65
      // Behind and above the ball, far enough back that the field, the wall and the fielder share the frame.
      // While the ball rises the frame holds it high; as it falls the aim slides toward where it comes down.
      function chaseCam(st, aspect) {
        const L = st.L, b = L.ball, info = landInfo(L), tl = info.tl, bt = Math.min(st.ballT, tl)
        const dir = V.norm(GD.polar(b.bearing, 1))
        const u = clamp(bt / tl, 0, 1)
        const now = ballAt(L, bt), land = ballAt(L, tl)
        const trail = ballAt(L, Math.max(0, bt - 0.9))
        const down = tl > info.tApex ? smooth(clamp((bt - info.tApex) / (tl - info.tApex), 0, 1)) : 1
        const settle = smooth(clamp((st.t - L.t.chaseEnd) / 1.6, 0, 1))
        const ground = b.kind === 'ground'
        // A high ball pushes the camera back, so the ball and the ground under it share the frame.
        const lag = Math.min(260, (ground ? 70 : 105) + 40 * smooth(u) + 20 * settle + 0.9 * trail[2])
        const up = (ground ? 24 : 34) + 0.42 * trail[2] + 8 * settle
        const base = [trail[0], trail[1], 0]
        const pos = V.add(V.sub(base, V.mul(dir, lag)), [0, 0, up])
        let target = V.lerp(now, land, 0.55 * down)
        target = [target[0], target[1], target[2] * (0.55 - 0.2 * down)]
        const vfov = GD.vfovFor((ground ? 40 : 44) + 6 * smooth(u), 24, aspect)
        // Keep the ball inside the middle of the frame.
        const toBall = V.norm(V.sub(now, pos))
        for (let i = 0; i < 6; i++) {
          const f = V.norm(V.sub(target, pos)), ang = (Math.acos(clamp(V.dot(f, toBall), -1, 1)) * 180) / Math.PI
          if (ang < (vfov / 2) * 0.6) break
          target = V.lerp(target, now, 0.35)
        }
        return GD.camera(pos, target, vfov)
      }
      const fovOf = (c) => (2 * Math.atan(1 / c.k) * 180) / Math.PI
      function homeCam(aspect) {
        const h = GD.CAMS.home(aspect)
        return GD.camera(V.add(h.pos, [0, -6, 4.6]), V.add(h.target, [0, 0, -0.5]), fovOf(h))
      }
      function cameraFor(st, aspect) {
        const L = st.L, T = L.t, home = homeCam(aspect)
        if (!L.ball || st.t < T.contactEnd) {
          // A slow push toward the zone once a walk or a strikeout is decided.
          if (!L.ball && st.t > T.pitchEnd) {
            const u = smooth(clamp((st.t - T.pitchEnd) / 2.2, 0, 1))
            return GD.camera(V.lerp(home.pos, V.add(home.pos, [0, 9, -1.6]), u), home.target, fovOf(home) * (1 - 0.12 * u))
          }
          return home
        }
        return GD.CAMS.blend(home, chaseCam(st, aspect), (st.t - T.contactEnd) / HOME_BLEND)
      }

      // Where a fielder stands. The engine moves the fielder with the putout (`L.fielder`), which on a
      // 4-3 grounder is the first baseman; here the first credit (who first touched the ball) runs to it.
      function fielderPos(st, k, fk) {
        const L = st.L, home = GD.POS[k]
        if (k !== fk || !L.ball || st.t <= L.t.contactEnd) return home
        const to = L.ball.kind === 'air' && L.ball.dist < GD.wallAt(L.ball.bearing).ft ? L.ball.land : L.ball.at(L.ball.T * 0.98)
        const dx = to[0] - home[0], dy = to[1] - home[1], d = Math.hypot(dx, dy) || 1
        const run = Math.min(d, (st.t - L.t.contactEnd) * 24)
        return [home[0] + (dx / d) * run, home[1] + (dy / d) * run, 0]
      }

      // ---- Draw ----
      let lastW = 0, lastH = 0
      const place = (m, p) => m.position.set(p[0], p[1], p[2])
      const tmpV = new THREE.Vector3()
      function screenScale(p, c, H, px) { // world size that spans `px` pixels at p
        const d = V.dot(V.sub(p, c.pos), c.f)
        return (px * d) / (c.k * (H / 2))
      }
      function draw(st, W, H) {
        if (W !== lastW || H !== lastH) { R.setSize(W, H, false); lastW = W; lastH = H }
        const L = st.L, T = L.t, aspect = W / H
        const c = cameraFor(st, aspect)
        cam.position.set(c.pos[0], c.pos[1], c.pos[2])
        cam.fov = (2 * Math.atan(1 / c.k) * 180) / Math.PI; cam.aspect = aspect; cam.updateProjectionMatrix()
        cam.lookAt(c.target[0], c.target[1], c.target[2])
        // A small shake on contact.
        if (st.phase === 'contact' && L.ball) { const s = Math.sin(st.t * 90) * 0.06; cam.position.x += s; cam.position.z += s * 0.5 }

        // Bodies.
        batter.pose(st.batter, [st.batter.pelvis[0] < 0 ? 1 : -1, 0, 0])
        pitcher.pose(st.pitcher, [0, -1, 0])
        const shadowAt = (m, p, s) => { m.position.set(p[0], p[1], 0.03); if (s) m.scale.set(s, s, 1) }
        shadowAt(blobs.batter, st.batter.pelvis); shadowAt(blobs.pitcher, st.pitcher.pelvis)
        const fk = L.play.credits[0] ? L.play.credits[0][0] : null
        for (const k of fieldKeys) {
          const p = fielderPos(st, k, fk), m = fielders[k]
          place(m, p)
          // Face home, or the ball's way for the fielder who runs to it.
          let look = [-p[0], -p[1]]
          if (k === fk && L.ball && st.t > T.contactEnd) { const to = ballAt(L, L.ball.T); look = [to[0] - p[0], to[1] - p[1]] }
          if (k === 'C') look = [0, 1]
          m.rotation.z = Math.atan2(-look[0], look[1])
          shadowAt(blobs[k], p)
        }
        // The umpire fades while the camera stands right behind him.
        const ud = Math.hypot(c.pos[0] - 0.4, c.pos[1] + 6.6)
        umpMat.opacity = clamp((ud - 34) / 30, 0, 1); umpMat.depthWrite = umpMat.opacity > 0.99; ump.visible = umpMat.opacity > 0.02
        catMat.opacity = clamp((ud - 34) / 30, 0.2, 1); catMat.depthWrite = catMat.opacity > 0.99
        shadowAt(blobs.ump, [0.4, -6.6, 0]); blobs.ump.visible = ump.visible; blobs.ump.material.opacity = umpMat.opacity
        blobs.C.material.opacity = catMat.opacity
        let batterGone = false
        for (let i = 0; i < runners.length; i++) {
          const r = st.runners[i], m = runners[i]
          // A strikeout's batter does not run; the engine still lists him as a runner who is out.
          let show = r && !r.gone && !(r.batter && r.out && !L.inPlay)
          // The batter becomes a runner once he has left the box; until then the swinging figure stands in.
          if (show && r.batter) { if (Math.hypot(r.pos[0], r.pos[1]) > 4) batterGone = true; else show = false }
          m.visible = runBlobs[i].visible = !!show
          if (!show) continue
          place(m, r.pos); shadowAt(runBlobs[i], r.pos)
          // Face along the base path.
          const d = r.pos, seg = d[0] >= 0 ? (d[1] <= GD.BASES['1B'][1] ? [1, 1] : [-1, 1]) : (d[1] >= GD.BASES['3B'][1] ? [-1, -1] : [1, -1])
          m.rotation.z = Math.atan2(-seg[0], seg[1])
        }

        batter.show(!batterGone)
        blobs.batter.visible = !batterGone

        // The ball: in the pitcher's hand, in flight, then off the bat.
        let b = null
        if (st.t < T.windupEnd) b = st.pitcher.ball
        else if (st.pitchPos) b = st.pitchPos
        else if (L.ball && st.t >= T.pitchEnd) b = st.t >= T.contactEnd ? ballAt(L, st.ballT) : GD.pitchAt(L.last, 1)
        ball.visible = !!b
        if (b) {
          place(ball, b)
          const s = Math.max(1, screenScale(b, c, H, 3.2) / 0.121); ball.scale.setScalar(s)
          // A ring round the ball once it is small on screen (in the chase).
          halo.visible = st.t >= T.contactEnd && !!L.ball
          if (halo.visible) { place(halo, b); halo.scale.setScalar(screenScale(b, c, H, 20)) }
          const gz = groundZ(b)
          ballShadow.visible = b[2] - gz < 260 && st.t >= T.windupEnd
          ballShadow.position.set(b[0], b[1], gz + 0.04)
          const ss = Math.max(0.5, screenScale([b[0], b[1], gz], c, H, 7)) * (1 + Math.min(1.5, (b[2] - gz) / 60))
          ballShadow.scale.set(ss, ss, 1); ballShadow.material.opacity = clamp(1 - (b[2] - gz) / 200, 0.25, 0.9)
        } else { ballShadow.visible = false; halo.visible = false }

        // The trail: the last stretch of the pitch, or of the batted ball.
        let trailOn = false
        if (st.pitchPos && st.pitchU > 0.02) {
          trailOn = true
          fillTrail((i) => GD.pitchAt(L.last, Math.max(0, st.pitchU - 0.3 * (1 - i / (TRAIL - 1)))), c, H, 2.6)
        } else if (L.ball && st.t >= T.contactEnd && st.ballT < landT(L) + 0.3) {
          trailOn = true
          const bt = Math.min(st.ballT, landT(L))
          fillTrail((i) => ballAt(L, Math.max(0, bt - 0.5 * (1 - i / (TRAIL - 1)))), c, H, 4.5)
        }
        trail.visible = trailOn

        // The zone at the front of the plate, sized for this batter.
        const zt = L.last.szTop, zb = L.last.szBot, zp = zoneGeo.attributes.position, zy = 17 / 12
        zp.setXYZ(0, -0.83, zy, zb); zp.setXYZ(1, 0.83, zy, zb); zp.setXYZ(2, 0.83, zy, zt); zp.setXYZ(3, -0.83, zy, zt); zp.setXYZ(4, -0.83, zy, zb)
        zp.needsUpdate = true

        // Earlier pitches as numbered dots; the decision pitch joins them once it crosses.
        const crossed = st.t >= T.pitchEnd
        const nDots = st.dotsShown + (crossed ? 1 : 0)
        for (let i = 0; i < dots.length; i++) {
          const p = L.pitches[i], s = dots[i]
          s.visible = i < nDots && !!p
          if (!s.visible) continue
          const kind = CALL(p.code)
          s.material.map = dotTex(kind === 'X' ? 'X' : String(i + 1), kind); s.material.needsUpdate = true
          s.position.set(p.px, zy - 0.05, p.pz)
        }
        // The tag beside the decision pitch.
        tag.visible = crossed && (!L.ball || st.t < T.contactEnd + 1.2)
        if (tag.visible) {
          const p = L.last, text = `${Math.round(p.mph)} ${TYPE2(p.type)} ${CALL(p.code)}`
          tag.material.map = tagTex(text); tag.material.needsUpdate = true
          tag.position.set(p.px + 1.55, zy - 0.1, p.pz + 0.32)
        }
        // The contact beat: a flash where bat meets ball.
        flash.visible = st.phase === 'contact' && !!L.ball
        if (flash.visible) {
          const u = clamp((st.t - T.pitchEnd) / Math.max(0.05, T.contactEnd - T.pitchEnd), 0, 1), e = GD.pitchAt(L.last, 1)
          flash.position.set(e[0], e[1], e[2]); flash.scale.setScalar(0.6 + 1.8 * u); flash.material.opacity = 1 - u
        }
        R.render(scene, cam)
      }
      // A camera-facing ribbon through `n` points from `pt(i)`, tapering to `w` px at the head.
      function fillTrail(pt, c, H, wPx) {
        const vx = cam.position.x, vy = cam.position.y, vz = cam.position.z
        for (let i = 0; i < TRAIL; i++) {
          const p = pt(i), q = pt(Math.min(TRAIL - 1, i + 1)), o = pt(Math.max(0, i - 1))
          let dx = q[0] - o[0], dy = q[1] - o[1], dz = q[2] - o[2]
          const ex = p[0] - vx, ey = p[1] - vy, ez = p[2] - vz
          let nx = dy * ez - dz * ey, ny = dz * ex - dx * ez, nz = dx * ey - dy * ex
          const nl = Math.hypot(nx, ny, nz) || 1
          const w = screenScale(p, c, H, wPx) * (i / (TRAIL - 1)) * 0.5
          nx *= w / nl; ny *= w / nl; nz *= w / nl
          trailPos.set([p[0] + nx, p[1] + ny, p[2] + nz, p[0] - nx, p[1] - ny, p[2] - nz], i * 6)
        }
        trailGeo.attributes.position.needsUpdate = true
        trailGeo.computeBoundingSphere()
      }
      return {
        draw,
        destroy() {
          scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose() } })
          for (const t of texCache.values()) t.dispose()
          R.dispose()
        },
      }
    },
  })
})()
