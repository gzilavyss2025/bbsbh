// Page logic for round 2. Feedback lives in the artifact's db, collection "feedback", one document per item
// (round 1's pattern), so Claude can read it back.
;(function () {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const { esc, frame, SIZES, STATES, rowOf, play } = window.GDR
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch { return null } }

  // ---- Tabs -------------------------------------------------------------------------------
  const TABS = $$('nav.jump a').map((a) => a.dataset.tab)
  const onShow = {}
  function show(tab) {
    if (!TABS.includes(tab)) tab = 'overview'
    for (const s of $$('section.tab')) s.hidden = s.dataset.tab !== tab
    for (const a of $$('nav.jump a')) { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current') }
    onShow[tab]?.()
    const top = $('nav.jump').offsetTop
    if (scrollY > top) scrollTo(0, top)
  }
  addEventListener('hashchange', () => show(location.hash.slice(1)))

  // ---- Feedback store (round 1's) ----------------------------------------------------------
  const FB = new Map(), listeners = new Set()
  let db = null, canWrite = true
  async function initDb() {
    try {
      db = await window.claude?.use?.('db')
      const user = await window.claude?.use?.('user')
      if (user?.can) { const c = await user.can('data.write'); if (c === false) canWrite = false }
    } catch { db = null }
    if (!db || !canWrite) { for (const el of $$('[data-fb]')) el.disabled = true; return }
    db.collection('feedback').onSnapshot((snap) => { FB.clear(); for (const d of snap.docs) FB.set(d.id, d.data()); for (const f of listeners) f() }, () => {})
  }
  const pending = new Map()
  function save(id, patch, savedEl) {
    if (!db || !canWrite) return
    const next = { ...(FB.get(id) || {}), ...patch, at: new Date().toISOString() }
    FB.set(id, next)
    const run = async () => {
      try { await db.doc('feedback/' + id).set(next); if (savedEl) { savedEl.textContent = 'Saved.'; setTimeout(() => (savedEl.textContent = ''), 1600) } }
      catch { if (savedEl) savedEl.textContent = 'Not saved. Try again.' }
    }
    pending.set(id, (pending.get(id) || Promise.resolve()).then(run))
  }
  function bindPair(id, sel, note, savedEl, key = 'pick') {
    sel.dataset.fb = note.dataset.fb = '1'
    const paint = () => { const d = FB.get(id) || {}; if (document.activeElement !== sel) sel.value = d[key] ?? ''; if (document.activeElement !== note) note.value = d.note ?? '' }
    sel.addEventListener('change', () => save(id, { [key]: sel.value }, savedEl))
    note.addEventListener('change', () => save(id, { note: note.value.trim() }, savedEl))
    listeners.add(paint); paint()
  }
  // A question card: one select and one note, bound to `id`.
  function ask(id, title, opts, lede = '') {
    const el = document.createElement('div'); el.className = 'card2 ask'
    el.innerHTML = `<span class="name">${esc(title)}</span>${lede ? `<p class="note">${esc(lede)}</p>` : ''}<div class="fb"><select aria-label="${esc(title)}"><option value="">No pick yet</option>${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select><textarea rows="2" aria-label="Note on ${esc(title)}" placeholder="Note"></textarea></div><span class="saved"></span>`
    bindPair(id, $('select', el), $('textarea', el), $('.saved', el))
    return el
  }
  function segment(id, cb) {
    const seg = $(id)
    seg.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; for (const x of $$('button', seg)) x.setAttribute('aria-pressed', String(x === b)); cb(b.dataset.v) })
    return (v) => { for (const x of $$('button', seg)) x.setAttribute('aria-pressed', String(x.dataset.v === v)) }
  }

  // ---- Frames: true size, scaled to the column ---------------------------------------------
  const ro = new ResizeObserver((es) => { for (const e of es) fit(e.target) })
  function fit(host) {
    const g = host.firstElementChild; if (!g) return
    const w = +host.dataset.w, h = +host.dataset.h, k = Math.min(1, host.clientWidth / w)
    host.style.height = Math.round(h * k) + 'px'
    g.style.transform = `scale(${k})`
  }
  function col(size, title, html, cap = '') {
    const f = SIZES.find((s) => s.id === size)
    return `<div class="fcol ${size}${f.w > 900 ? ' full' : ''}"><h3>${esc(title)}<span>${f.note}</span></h3><div class="host" style="max-width:${f.w + 4}px" data-w="${f.w}" data-h="${f.h}">${html}</div>${cap ? `<div class="cap">${cap}</div>` : ''}</div>`
  }
  function mount(el, html) {
    el.innerHTML = html
    for (const h of $$('.host', el)) { ro.observe(h); fit(h) }
    paintStages(el)
  }

  // ---- The stage: the 16-bit concept, palette from the frame's --stage-* tokens --------------
  const sprites = GD.concepts.find((c) => c.id === 'sprites')
  const instCache = new Map()
  function paletteOf(el) {
    const cs = getComputedStyle(el), pal = {}
    for (const [slot, tok] of Object.entries(SLOT_TOKEN)) pal[slot] = cs.getPropertyValue(tok).trim()
    return pal
  }
  function instFor(pal, zones = false) {
    const key = JSON.stringify(pal) + zones
    if (!instCache.has(key)) { const cv = document.createElement('canvas'); instCache.set(key, { cv, inst: sprites.create(cv, { palette: pal, zones: zones ? zoneTemps() : null }) }) }
    return instCache.get(key)
  }
  const zoneTemps = () => Object.fromEntries(Object.entries(window.GD_ZONES.avg).map(([z, v]) => [z, v.temp]))
  function timeOf(p, at) {
    const L = GD.timeline(p), T = L.t
    if (typeof at === 'number') return at
    return { rest: 0, pitch: T.windupEnd + L.last.T * 0.6, contact: T.pitchEnd + 0.04, chase: L.ball ? T.contactEnd + L.ball.T * 0.5 : T.pitchEnd + 0.3, end: T.end }[at] ?? 0
  }
  // A sub-step frame (ADR-0123): 'pK' is the at-bat cut after pitch K, with the runner where he stood;
  // 'wp' is the wild pitch (after pitch 5, Durbin on 3rd). Each gets its own key in the engine's cache.
  const subCache = new Map()
  function subPlay(ab, at) {
    const key = ab + ':' + at
    if (subCache.has(key)) return subCache.get(key)
    const p = GD.playByAb(ab), k = at === 'wp' ? 5 : +at.slice(1)
    const onBase = at === 'wp' ? '3B' : '2B'
    const sp = { ...p, ab: ab * 100 + (at === 'wp' ? 99 : k), pitches: p.pitches.filter((x) => x.n).slice(0, k), ball: null, credits: [],
      runners: [{ id: 702332, name: 'Caleb Durbin', start: onBase, end: onBase, out: false, scored: false }] }
    GD.plays.push(sp)
    subCache.set(key, sp)
    return sp
  }
  function drawStage(cv, ab, at, dpr, zones) {
    const sub = /^p\d$|^wp$/.test(at)
    const p = sub ? subPlay(ab, at) : GD.playByAb(ab), box = cv.parentElement
    if (sub) at = 'end'
    const W = Math.round(box.clientWidth * dpr), H = Math.round(box.clientHeight * dpr)
    if (!W || !H) return
    const o = instFor(paletteOf(cv), zones)
    o.cv.width = W; o.cv.height = H; cv.width = W; cv.height = H
    try { o.inst.draw(GD.stateAt(p, timeOf(p, at)), W, H); cv.getContext('2d').drawImage(o.cv, 0, 0) } catch (e) { console.warn(e) }
  }
  let momentOverride = null
  function paintStages(root) {
    for (const cv of $$('canvas[data-stage]', root)) {
      const [ab, at] = cv.dataset.stage.split(':')
      const g = cv.closest('.gd'), dpr = g && +g.style.width.replace('px', '') <= 400 ? 3 : 2
      drawStage(cv, +ab, momentOverride && root.closest?.('#tab-tokens') ? momentOverride : at, dpr, !!cv.dataset.zones)
    }
  }
  const SLOT_TOKEN = {
    sky0: '--stage-sky', sky1: '--stage-sky-haze', crowd0: '--stage-crowd-1', crowd1: '--stage-crowd-2', crowd2: '--stage-crowd-3', crowd3: '--stage-crowd-4',
    mon0: '--stage-wall-deep', mon1: '--stage-wall', mon2: '--stage-wall-lit', grass0: '--stage-grass', grass1: '--stage-grass-lit', grassFar: '--stage-grass-far', foul: '--stage-grass-foul',
    dirt0: '--stage-dirt', dirt1: '--stage-dirt-lit', chalk: '--stage-chalk', ink: '--stage-outline', shadow: '--stage-shadow', dirtShadow: '--stage-shadow-dirt',
    navy: '--stage-kit-navy', teal: '--stage-kit-trim', grey: '--stage-kit-road', greyD: '--stage-kit-road-shade', red: '--stage-kit-red', skin: '--stage-skin', skinD: '--stage-skin-shade',
    wood: '--stage-bat', gold: '--stage-landing',
    zoneCold: '--stage-zone-cold', zoneCool: '--stage-zone-cool', zoneLuke: '--stage-zone-lukewarm', zoneWarm: '--stage-zone-warm', zoneHot: '--stage-zone-hot',
  }
  const SLOT_JOB = {
    sky0: 'Sky', sky1: 'Sky near the horizon', crowd0: 'Crowd, darkest', crowd1: 'Crowd', crowd2: 'Crowd, shirts', crowd3: 'Crowd, lightest', mon0: 'Wall, shade', mon1: 'Wall', mon2: 'Wall, lit',
    grass0: 'Grass', grass1: 'Grass, mown stripe', grassFar: 'Grass, far', foul: 'Foul ground', dirt0: 'Dirt', dirt1: 'Dirt, lit', chalk: 'Chalk, ball', ink: 'Outline', shadow: 'Shadow on grass', dirtShadow: 'Shadow on dirt',
    navy: 'Kit: navy (caps, socks)', teal: 'Kit: road trim', grey: 'Kit: road grey', greyD: 'Kit: road grey, shade', red: 'Kit: home red, seams', skin: 'Skin', skinD: 'Skin, shade', wood: 'Bat', gold: 'Landing ring',
    zoneCold: 'Zone map: cold', zoneCool: 'Zone map: cool', zoneLuke: 'Zone map: lukewarm', zoneWarm: 'Zone map: warm', zoneHot: 'Zone map: hot',
  }

  // ---- Swing --------------------------------------------------------------------------------
  // Round 1's two rejected keyframes, kept to draw beside the new ones.
  const ROUND1 = {
    load: { head: [0.12, 0.0, 5.6], neck: [0.08, -0.1, 5.15], lSho: [0.25, 0.48, 4.8], rSho: [-0.05, -0.72, 4.85], lElb: [0.5, -0.3, 4.5], rElb: [-0.25, -1.35, 4.8], hands: [0.1, -1.05, 5.05], pelvis: [0, -0.1, 3.25], lHip: [0.05, 0.38, 3.25], rHip: [-0.05, -0.55, 3.25], lKnee: [0.45, 1.1, 1.95], rKnee: [0.25, -1.05, 1.7], lFoot: [0.15, 1.55, 0.3], rFoot: [0, -1.2, 0], batTip: [-0.35, -1.6, 7.35] },
    finish: { head: [0.1, 0.45, 5.45], neck: [0.05, 0.35, 5.0], lSho: [-0.45, 0.35, 4.85], rSho: [0.55, 0.25, 4.75], lElb: [-0.35, 0.95, 5.0], rElb: [0.45, 0.9, 4.9], hands: [-0.05, 0.85, 5.45], pelvis: [0.1, 0.3, 3.05], lHip: [-0.25, 0.5, 3.05], rHip: [0.45, 0.05, 3.05], lKnee: [0.25, 1.6, 1.75], rKnee: [0.75, -0.35, 1.55], lFoot: [0.15, 1.9, 0], rFoot: [0.25, -0.95, 0.35], batTip: [-1.75, -0.7, 5.9] },
  }
  const POSES = [['stance', 'Stance', 'ok'], ['load', 'Load', 'new'], ['launch', 'Launch', 'ok'], ['contact', 'Contact', 'ok'], ['extend', 'Follow-through 1: extension', 'new'], ['wrap', 'Follow-through 2: over the shoulder', 'new'], ['finish', 'Follow-through 3: finish', 'new']]
  let hand = 'R'
  segment('#seg-hand', (v) => { hand = v; drawPoses(); if (swingBuilt && !MO.playing) renderMotion() })
  function renderPoses() {
    $('#poses').innerHTML = POSES.map(([k, n, s]) => `<article class="pose card2" style="padding-top:20px"><span class="name">${n}</span>
      <div>${s === 'ok' ? '<span class="chip ok">Approved 2026-10-26</span>' : '<span class="chip fix">Redrawn for round 2</span>'}</div>
      <div class="views">${s === 'new' && ROUND1[k]
        ? `<figure><canvas data-k="${k}" data-v="home" width="520" height="640"></canvas><figcaption>New · stage camera</figcaption></figure><figure><canvas data-k="${k}" data-v="side" width="520" height="640"></canvas><figcaption>New · from the side</figcaption></figure><figure><canvas data-k="${k}" data-v="home" data-r1="1" width="520" height="640"></canvas><figcaption>Round 1 · stage camera</figcaption></figure><figure><canvas data-k="${k}" data-v="side" data-r1="1" width="520" height="640"></canvas><figcaption>Round 1 · from the side</figcaption></figure>`
        : `<figure><canvas data-k="${k}" data-v="home" width="520" height="640"></canvas><figcaption>Stage camera</figcaption></figure><figure><canvas data-k="${k}" data-v="side" width="520" height="640"></canvas><figcaption>From the side</figcaption></figure>`}</div>
      ${s === 'new' ? `<div class="fb" style="grid-template-columns:1fr"><select aria-label="Your verdict on ${n}"><option value="">No verdict</option><option value="approve">Approve</option><option value="fix">Needs work</option></select><textarea rows="2" aria-label="Note on ${n}" placeholder="What still looks wrong"></textarea></div><span class="saved"></span>` : ''}</article>`).join('')
    for (const a of $$('#poses .pose')) if ($('select', a)) bindPair('pose-' + $('canvas', a).dataset.k, $('select', a), $('textarea', a), $('.saved', a), 'verdict')
    drawPoses()
  }
  function drawPoses() {
    for (const cv of $$('#poses canvas')) drawPoseOn(cv, cv.dataset.r1 ? ROUND1[cv.dataset.k] : GD.SWING[cv.dataset.k], cv.dataset.v, !!cv.dataset.r1)
  }
  function drawPoseOn(cv, framePose, view, old = false) {
    {
      const g = cv.getContext('2d'), W = cv.width, H = cv.height
      const pose = GD.batterToWorld(framePose, hand)
      const m = hand === 'L' ? -1 : 1, bx = -2.75 * m
      const cam = view === 'side' ? GD.camera([bx + 13 * m, 0.4, 3.6], [bx, 0.4, 3.4], 34) : GD.camera([0, -12, 5.2], [bx * 0.8, 0.6, 3.4], 34)
      const P = (p) => GD.project(cam, p, W, H)
      g.fillStyle = old ? '#f1e7cc' : '#fffdf6'; g.fillRect(0, 0, W, H)
      g.strokeStyle = '#cbc1a7'; g.lineWidth = 2
      const line = (a, b) => { const p = P(a), q = P(b); if (p && q) { g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke() } }
      line([-9, -3, 0], [9, -3, 0]); line([-9, 4, 0], [9, 4, 0]); line([bx - 2 * m, -3, 0], [bx - 2 * m, 4, 0]); line([bx + 2 * m, -3, 0], [bx + 2 * m, 4, 0])
      g.fillStyle = '#e8dfc6'; const pl = [[-0.71, 0, 0], [0.71, 0, 0], [0.71, 0.71, 0], [0, 1.42, 0], [-0.71, 0.71, 0]].map(P)
      if (pl.every(Boolean)) { g.beginPath(); pl.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill() }
      g.lineCap = 'round'; g.lineJoin = 'round'
      const ink = '#1b2a3a', far = '#56677a', grey = '#9aa3ad'
      const depth = (j) => { const p = P(pose[j]); return p ? p.d : 0 }
      const limb = (a, b, wft, c) => { const p = P(pose[a]), q = P(pose[b]); if (!p || !q) return; g.strokeStyle = c; g.lineWidth = Math.max(2, wft * (p.s + q.s) / 2); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke() }
      const side = (s) => [['Sho', 'Elb'], ['Hip', 'Knee'], ['Knee', 'Foot']].map(([a, b]) => [s + a, s + b])
      const order = depth('lSho') > depth('rSho') ? ['l', 'r'] : ['r', 'l']
      for (const sd of order) { const c = sd === order[0] ? far : ink; for (const [a, b] of side(sd)) limb(a, b, a.endsWith('Sho') ? 0.32 : 0.36, c); limb(sd + 'Elb', 'hands', 0.28, c) }
      const tq = ['lSho', 'rSho', 'rHip', 'lHip'].map((j) => P(pose[j]))
      if (tq.every(Boolean)) { g.fillStyle = grey; g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); tq.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill(); g.stroke() }
      limb('neck', 'head', 0.25, ink)
      const hd = P(pose.head); if (hd) { g.fillStyle = ink; g.beginPath(); g.arc(hd.x, hd.y, 0.4 * hd.s, 0, 7); g.fill() }
      const h = P(pose.hands), tp = P(pose.batTip)
      if (h && tp) {
        const nx = tp.y - h.y, ny = h.x - tp.x, L = Math.hypot(nx, ny) || 1, w0 = 0.05 * h.s, w1 = 0.11 * tp.s
        g.fillStyle = '#8a5a1e'; g.beginPath(); g.moveTo(h.x + nx / L * w0, h.y + ny / L * w0); g.lineTo(tp.x + nx / L * w1, tp.y + ny / L * w1); g.lineTo(tp.x - nx / L * w1, tp.y - ny / L * w1); g.lineTo(h.x - nx / L * w0, h.y - ny / L * w0); g.closePath(); g.fill()
        g.fillStyle = ink; g.beginPath(); g.arc(h.x, h.y, Math.max(3, 0.09 * h.s), 0, 7); g.fill()
      }
    }
  }
  // The swing in motion (Gary, round 2: "can't really tell without seeing the motion"). The swing clock runs
  // as the stage runs it: stance to load across the windup (0.9 s), load to contact across the pitch's flight
  // (J. Rodríguez's strike three, 0.42 s), then the follow-through (0.6 s), a hold, and again. Slow: x4.
  // Reduced motion: no autoplay; the play button still runs it.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const MO = { playing: !reduce.matches, slow: false, t0: 0, raf: 0 }
  function swingClock(t) {
    const fl = GD.timeline(GD.playByAb(15)).last.T
    if (t < 0.9) return t / 0.9
    if (t < 0.9 + fl) return 1 + 1.4 * ((t - 0.9) / fl)
    if (t < 0.9 + fl + 0.6) return 2.4 + 0.6 * ((t - 0.9 - fl) / 0.6)
    return 3
  }
  function renderMotion() {
    const p = GD.playByAb(15), L = GD.timeline(p), T = L.t, cycle = 0.9 + L.last.T + 0.6 + 0.9
    const cvs = $$('#motion canvas'), o = instFor(paletteOf(document.documentElement))
    const draw = (t) => {
      const s = swingClock(t), pose = GD.swingPose(s, true)
      drawPoseOn(cvs[0], pose, 'home'); drawPoseOn(cvs[1], pose, 'side')
      // The 16-bit stage at the same moment: windup start + t (the stage's own clock).
      const st = GD.stateAt(p, Math.min(T.dotsEnd + t, T.pitchEnd + 0.6)), W = 370 * 3, H = 326 * 3
      o.cv.width = W; o.cv.height = H; o.inst.draw(st, W, H)
      const g = cvs[2].getContext('2d'); g.imageSmoothingEnabled = false
      g.drawImage(o.cv, W * 0.12, H * 0.18, W * 0.45, H * 0.8, 0, 0, cvs[2].width, cvs[2].height)
      $('#motion-t').textContent = `${s < 1 ? 'Load' : s < 2 ? 'Launch' : s < 2.45 ? 'Contact' : 'Follow-through'} · ${t.toFixed(2)} s`
    }
    cancelAnimationFrame(MO.raf)
    const tick = (now) => {
      if (!MO.t0) MO.t0 = now
      const t = (((now - MO.t0) / 1000) / (MO.slow ? 4 : 1)) % cycle
      draw(Math.min(t, cycle - 0.9))
      if (MO.playing) MO.raf = requestAnimationFrame(tick)
    }
    if (MO.playing) MO.raf = requestAnimationFrame(tick); else draw(0.9 + L.last.T)
    $('#motion-play').textContent = MO.playing ? 'Pause' : 'Play'
  }
  $('#motion-play').addEventListener('click', () => { MO.playing = !MO.playing; MO.t0 = 0; renderMotion() })
  $('#motion-slow').addEventListener('click', (e) => { MO.slow = !MO.slow; e.currentTarget.setAttribute('aria-pressed', String(MO.slow)); MO.t0 = 0 })

  // The swing on the 16-bit stage: J. Rodríguez's swinging strike three (atBatIndex 15), at the five keyframes.
  function renderSwingStrip() {
    const p = GD.playByAb(15), L = GD.timeline(p), T = L.t
    const times = [['Stance', T.dotsEnd], ['Load', T.windupEnd], ['Launch', T.windupEnd + L.last.T / 1.4], ['Contact', T.pitchEnd], ['Follow-through', T.pitchEnd + 0.6]]
    $('#swingstrip').innerHTML = times.map(([n]) => `<figure><canvas width="390" height="520"></canvas><figcaption>${n}</figcaption></figure>`).join('')
    const o = instFor(paletteOf(document.documentElement)), cvs = $$('#swingstrip canvas')
    // A phone-shaped crop around the batter: draw the full phone stage, then cut the batter's half.
    times.forEach(([, t], i) => {
      const W = 370 * 3, H = 326 * 3
      o.cv.width = W; o.cv.height = H
      o.inst.draw(GD.stateAt(p, t), W, H)
      const g = cvs[i].getContext('2d'); g.imageSmoothingEnabled = false
      g.drawImage(o.cv, W * 0.12, H * 0.18, W * 0.45, H * 0.8, 0, 0, 390, 520)
    })
  }
  let swingBuilt = false
  onShow.swing = () => { if (swingBuilt) return; swingBuilt = true; renderPoses(); renderSwingStrip(); renderMotion() }

  // ---- Tokens -------------------------------------------------------------------------------
  const TOK = { size: store('r2:tsize') || 'P', state: 'waiting' }
  $('#seg-tsize').innerHTML = SIZES.map((s) => `<button type="button" data-v="${s.id}" aria-pressed="${s.id === TOK.size}">${s.name}</button>`).join('')
  segment('#seg-tsize', (v) => { TOK.size = v; store('r2:tsize', v); renderTokens() })
  segment('#seg-tstate', (v) => { TOK.state = v; renderTokens() })
  segment('#seg-tmoment', (v) => { momentOverride = v === 'rest' ? null : v; renderTokens() })
  function renderTokens() {
    const sc = (palette) => frame({ size: TOK.size, state: TOK.state, palette, stageTag: true })
    mount($('#tok-frames'), col(TOK.size, 'A · Paper tokens', sc('paper'), '<b>Adds</b> no colour. The stage borrows the field and paper tokens the app already has.') +
      col(TOK.size, 'B · New stage palette', sc('stage'), '<b>Adds</b> 34 <code>--stage-*</code> tokens, used by the stage only. The panels stay paper.'))
  }
  function renderTokTable() {
    const root = getComputedStyle(document.documentElement)
    const paper = document.createElement('div'); paper.className = 'pal-paper'; document.body.appendChild(paper)
    const pcs = getComputedStyle(paper)
    const raw = {}; for (const r of document.styleSheets) { try { for (const rule of r.cssRules) if (rule.selectorText === '.pal-paper') for (const p of rule.style) raw[p] = rule.style.getPropertyValue(p).trim() } catch {} }
    $('#tok-table').innerHTML = `<tr><th>Token</th><th>Job</th><th>New palette</th><th>Paper fill</th></tr>` + Object.entries(SLOT_TOKEN).map(([slot, tok]) => {
      const a = root.getPropertyValue(tok).trim(), b = pcs.getPropertyValue(tok).trim()
      return `<tr><td><code>${tok}</code></td><td>${esc(SLOT_JOB[slot])}</td><td><span class="sw" style="background:${a}"></span>${esc(a)}</td><td><span class="sw" style="background:${b}"></span>${esc(raw[tok] || b)}</td></tr>`
    }).join('')
    paper.remove()
  }
  let tokBuilt = false
  onShow.tokens = () => { if (!tokBuilt) { tokBuilt = true; renderTokens(); renderTokTable(); bindPair('tokens', $('#fb-tokens'), $('#fb-tokens-note'), $('#fb-tokens-saved')) } else for (const h of $$('#tab-tokens .host')) fit(h) }

  // ---- Checkpoint ---------------------------------------------------------------------------
  const CP = { key: 'top2', mode: 'grid', nav: 'tabs', facts: 'menu', adv: 'next', page: 'tally' }
  segment('#seg-cphalf', (v) => { CP.key = v; renderCp() })
  segment('#seg-cpmode', (v) => { CP.mode = v; renderCp() })
  segment('#seg-cpnav', (v) => { CP.nav = v; renderCp() })
  segment('#seg-cpfacts', (v) => { CP.facts = v; renderCp() })
  segment('#seg-cpadv', (v) => { CP.adv = v; renderCp() })
  const setPage = segment('#seg-cppage', (v) => { CP.page = v; renderCp() })
  function renderCp() {
    const ids = GDCP.pages(CP.key, CP.facts === 'page' && CP.key === 'top2')
    if (!ids.includes(CP.page)) CP.page = ids[0]
    $('#seg-cppage').innerHTML = ids.map((id) => `<button type="button" data-v="${id}" aria-pressed="${id === CP.page}">${GDCP.LABEL[id]}</button>`).join('')
    const stId = CP.key === 'bot9' ? 'final' : 'cp'
    const st = STATES[stId]
    const adv = CP.key === 'bot9' ? 'Close the book' : CP.adv === 'next' ? 'Bottom 2nd' : 'Next at-bat'
    const saved = st.advance; st.advance = adv
    const frames = SIZES.map((s) => col(s.id, s.name, frame({ size: s.id, state: stId, palette: 'stage', cpLayer: GDCP.layer({ ...CP }, s.id) }),
      s.id === 'P' ? `<b>Phone</b> one page at a time${CP.mode === 'grid' ? ' (all four do not fit)' : ''}.` : CP.mode === 'grid' ? '<b>All that fit</b>: no cycling at this size.' : '<b>One page</b>, as on the phone.'))
    let extra = ''
    if (CP.facts === 'menu' && CP.key === 'top2') extra = col('P', 'Phone · menu open', frame({ size: 'P', state: stId, palette: 'stage', cpLayer: GDCP.layer({ ...CP }, 'P'), overlay: menuSheet }), '<b>Notes</b> sit at the top of the menu while the checkpoint is up.')
    st.advance = saved
    mount($('#cp-frames'), frames.join('') + extra)
    $('#cp-note').textContent = CP.key === 'bot9'
      ? 'The last half: it keys on revealedThrough reaching finalHalfIndex (ADR-0043), never on selectIsFinal. The game page becomes the final line with the double rule, and the advance control reads Close the book. The next tap opens the box score.'
      : (CP.facts === 'page' ? 'Notes is the fifth page. ' : '') + 'The notes need the game\'s callout bundle, which the nightly job keeps only for recent dates. 824716 has none, so today\'s page shows no notes for it; the Notes page here borrows the real notes after the top 2nd of TB @ CLE (849817).'
  }
  // The menu while the checkpoint is up: the notes first.
  function menuSheet(f) {
    const top = 96, h = 683 - top
    const items = [['Notes', 'Facts for the bottom 2nd'], ['Trail', 'This half\'s at-bats'], ['Navigator', 'Line score; jump to any half'], ['Pitches', 'The last at-bat\'s pitches'], ['Lineups', 'Both orders'], ['Field', 'Defense'], ['Arms', 'Pitchers'], ['Extras', 'Bench, bullpen, umpire'], ['Scorecard', ''], ['Box score', '']]
    return `<div class="gd-scrim"></div><div class="gd-sheet" style="left:0;top:${top}px;width:${f.w}px;height:${h}px"><div class="gd-sheet__head"><span>Menu</span><span>×</span></div><div class="gd-sheet__body">${items.map(([a, b], i) => `<div class="gd-mi ${i === 0 ? 'hl' : ''}">${a}<span>${b}</span></div>`).join('')}</div></div>`
  }
  let cpBuilt = false
  onShow.checkpoint = () => {
    if (cpBuilt) { for (const h of $$('#tab-checkpoint .host')) fit(h); return }
    cpBuilt = true; renderCp()
    const host = $('#cp-asks')
    host.append(
      ask('cp-show', 'Pages: one at a time, or all that fit', [['one', 'One at a time at every size'], ['grid', 'All that fit (the phone still cycles)']]),
      ask('cp-cycle', 'How the pages cycle', [['tabs', 'Labelled tabs (tap any page)'], ['dots', 'Arrows and dots'], ['tabs-swipe', 'Labelled tabs, and swipe too']]),
      ask('cp-advance', 'The advance control at a checkpoint', [['next', 'Names the next half: "Bottom 2nd ›"'], ['same', 'Same words as always: "Next at-bat ›"']], 'It only changes after the third out is revealed, so it tells nothing early.'),
      ask('cp-end', 'The end of the game', [['ok', 'Checkpoint, then "Close the book ›", then the box score'], ['change', 'Change it (say how)']]),
      ask('cp-facts', 'The score-free notes (between-innings.js)', [['page', 'A fifth page'], ['menu', 'In the menu'], ['none', 'Nowhere: drop them']]),
      ask('cp-pages', 'The four pages\' content', [['ok', 'Right as drawn'], ['change', 'Change (say what)']]),
    )
  }

  // ---- Whole half ---------------------------------------------------------------------------
  let WH = 'atbats'
  segment('#seg-whole', (v) => { WH = v; renderWhole() })
  const MID = STATES.revealed // Arozarena's home run is revealed; Canzone is sealed.
  function halfRows() {
    const upto = GDCP.HALF.top2.rows.findIndex((r) => r.ab === 14)
    return GDCP.HALF.top2.rows.slice(0, upto)
  }
  function wholeBody(kind) {
    const rows = halfRows()
    if (kind === 'atbats') {
      const h = { ...GDCP.HALF.top2, rows }
      return GDCP.atBats(h).replace("The half's at-bats", 'Top 2nd so far') + `<div class="gd-abrows"><div><span></span><span class="gd-plays"><span class="seal">Sealed</span></span><span></span><span></span><span></span></div></div>`
    }
    return `<h4>Top 2nd so far</h4><div class="gd-plays">${rows.map((r) => r.kind === 'ab'
      ? `<div><span class="star">${r.rbi ? '★' : ''}</span><span class="c">${esc(r.code)}</span><span class="nm">${esc(play(r.ab)?.line ?? r.line)}</span></div>`
      : `<div class="ev"><span></span><span></span><span>${esc(r.text)}</span></div>`).join('')}<div><span></span><span class="seal">?</span><span class="nm">Canzone is up.</span></div></div>`
  }
  function wholeSheet(kind) {
    return (f) => {
      const top = 96, h = 683 - top
      return `<div class="gd-scrim"></div><div class="gd-sheet" style="left:0;top:${top}px;width:${f.w}px;height:${h}px"><div class="gd-sheet__head"><span>This half</span><span>×</span></div><div class="gd-sheet__body"><div class="gd-page" style="padding:0">${wholeBody(kind)}</div></div></div>`
    }
  }
  function renderWhole() {
    const notes = {
      atbats: 'The menu gets "This half". It opens the checkpoint\'s at-bats page, cut at your cursor, with the next at-bat sealed. One component, two places. On the desktop it sits in the log slot all the time.',
      plays: 'One line per play, in words, with a star on each play that drove in a run (The Show 13\'s post-game list). It opens from the menu on the phone, and fills the log slot on the desktop.',
      none: 'No whole-half view. The trail (at-bat chips) and the navigator already reach every at-bat; the desktop keeps round 1\'s event log.',
    }
    $('#whole-note').textContent = notes[WH]
    const deskLog = WH === 'none' ? null : (f) => {
      const b = window.GDR.boxOfPart('D', 'log')
      return `<div style="position:absolute;left:${b[1]}px;top:${b[2]}px;width:${b[3]}px;height:${b[4]}px;z-index:3;display:flex"><div class="card" style="padding:6px 8px"><div class="gd-page" style="padding:0;gap:4px">${wholeBody(WH)}</div></div></div>`
    }
    mount($('#whole-frames'),
      col('P', 'Phone', frame({ size: 'P', state: 'revealed', palette: 'stage', overlay: WH === 'none' ? null : wholeSheet(WH) }), WH === 'none' ? '<b>Nothing</b> extra: the menu keeps Trail and Navigator.' : '<b>Menu → This half</b>, open.') +
      col('D', 'Desktop', frame({ size: 'D', state: 'revealed', palette: 'stage', overlay: deskLog }), WH === 'none' ? '<b>Event log</b> as round 1 drew it.' : '<b>In the log slot</b>, always shown.'))
  }
  let wholeBuilt = false
  onShow.whole = () => { if (!wholeBuilt) { wholeBuilt = true; renderWhole(); bindPair('whole', $('#fb-whole'), $('#fb-whole-note'), $('#fb-whole-saved')) } else for (const h of $$('#tab-whole .host')) fit(h) }

  // ---- Overview: what round 2 found -----------------------------------------------------------
  const FOUND = [
    ['The zone map\'s season total includes the scored game.', 'MLB\'s hotColdZones for Arozarena with no date bound already counts 9/1 and every later game. With endDate set to 8/31, the numbers are the pre-game ones: 8/31 to 9/1 changes exactly the five zones of his 9/1 at-bats (zone 5, the home run: .250 to .261). The build adds one fetch per batter.'],
    ['ESPN\'s silhouette holds a bat and faces the screen.', 'Redrawn from the shapes in ESPN\'s Gamecast client code: a grey body, the team colour on the helmet and belt only, flipped for lefties. Filed as a reference; the art stays out of the repo.'],
    ['The checkpoint\'s numbers match today\'s tally.', 'checkpoint.js on 824716 top 2nd: R 5, H 4, E 0, LOB 0; Paez 28 pitches, 15 strikes, 2 whiffs. Today\'s page shows the same R, H, E, LOB, pitches and whiffs. Bottom 9th: Milner 7 pitches, Muñoz 4, so page 2 shows the split.'],
    ['Pitch counts add up.', 'Paez: 29 before Arozarena, 33 after, 39 at the end of the half (11 in the 1st + 28).'],
  ]
  $('#found').innerHTML = FOUND.map(([a, b]) => `<li><b>${esc(a)}</b> ${esc(b)}</li>`).join('')

  // ---- Boot (after drop2.js has registered its tabs) ---------------------------------------------
  window.R2APP = { $, $$, esc, mount, col, ask, segment, bindPair, onShow, fit, FOUND: (items) => { $('#found').insertAdjacentHTML('beforeend', items.map(([a, b]) => `<li><b>${esc(a)}</b> ${esc(b)}</li>`).join('')) } }
  addEventListener('resize', () => { for (const h of $$('.host')) fit(h) })
  setTimeout(() => { show(location.hash.slice(1) || 'overview'); initDb() })
})()
