// Page logic for the Gameday design round. Feedback (tiers, picks, notes) lives in the artifact's db,
// collection "feedback", one document per item, so Claude can read it back.
;(function () {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch { return null } }

  // ---- Tabs -------------------------------------------------------------------------------
  const TABS = ['overview', 'ranking', 'ladder', 'stage', 'swing', 'references']
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

  // ---- Feedback store ---------------------------------------------------------------------
  const FB = new Map()
  const fbListeners = new Set(), rankListeners = new Set()
  let db = null, canWrite = true
  async function initDb() {
    try {
      db = await window.claude?.use?.('db')
      const user = await window.claude?.use?.('user')
      if (user?.can) { const c = await user.can('data.write'); if (c === false) canWrite = false }
    } catch { db = null }
    const status = $('#rank-status')
    if (!db) { status.textContent = 'This view cannot save. You can still read everything; send changes in chat.'; setDisabled(true); return }
    if (!canWrite) { status.textContent = 'You can read this page. Only its owner and editors can save changes.'; setDisabled(true) }
    db.collection('feedback').onSnapshot((snap) => {
      FB.clear()
      for (const d of snap.docs) FB.set(d.id, d.data())
      if (canWrite) status.textContent = FB.size ? `${FB.size} change${FB.size === 1 ? '' : 's'} saved so far.` : 'Nothing changed yet. Your changes save as you make them.'
      for (const f of fbListeners) f()
      for (const f of rankListeners) f()
    }, () => { status.textContent = 'The store stopped answering. Reload the page to try again.' })
  }
  function setDisabled(off) { for (const el of $$('[data-fb]')) el.disabled = off }
  const pending = new Map()
  function save(id, patch, savedEl) {
    if (!db || !canWrite) return
    const next = { ...(FB.get(id) || {}), ...patch, at: new Date().toISOString() }
    FB.set(id, next)
    const run = async () => {
      try { await db.doc('feedback/' + id).set(next); if (savedEl) { savedEl.textContent = 'Saved.'; setTimeout(() => (savedEl.textContent = ''), 1600) } }
      catch (e) { if (savedEl) savedEl.textContent = e?.code === 'invalid_argument' ? 'This view cannot save.' : 'Not saved. Try again.'; if (e?.code === 'invalid_argument') { canWrite = false; setDisabled(true) } }
    }
    const prev = pending.get(id) || Promise.resolve()
    pending.set(id, prev.then(run))
  }
  // A select + textarea pair bound to one feedback doc.
  function bindPair(id, sel, note, savedEl, key = 'pick', set = fbListeners) {
    sel.dataset.fb = note.dataset.fb = '1'
    const paint = () => { const d = FB.get(id) || {}; if (document.activeElement !== sel) sel.value = d[key] ?? ''; if (document.activeElement !== note) note.value = d.note ?? '' }
    sel.addEventListener('change', () => save(id, { [key]: sel.value }, savedEl))
    note.addEventListener('change', () => save(id, { note: note.value.trim() }, savedEl))
    set.add(paint); paint()
  }

  // ---- Ranking ----------------------------------------------------------------------------
  const TIER = { always: 'Always', tap: 'One tap', when: 'When it happens', drop: 'Drop', quiet: 'Behind the scenes' }
  let tierFilter = ''
  // Which picture each row shows: its own capture, or one it shares (an Arms or Extras tab, a twin card).
  const IMGS = new Set(window.GD_IMGS || [])
  const SHARE = { 9: null, 19: null, 12: 42, 14: 47, 71: 73, 72: 73, 74: 73, 75: 73, 77: 76, 78: 76, 79: 76, 80: 76, 90: null }
  function imgFor(n) {
    const k = n in SHARE ? SHARE[n] : n
    return k != null && IMGS.has(k) ? `img/b${String(k).padStart(2, '0')}.jpg` : null
  }
  function noPic(n, grp, tier) {
    if (grp === 'N') return 'New in Gameday. See the Ladder tab.'
    if (grp === 'J') return 'Not built yet.'
    if (tier === 'quiet' && ![88, 89, 93].includes(n)) return 'Nothing on screen.'
    return 'No picture: this did not happen in the test games.'
  }
  function renderRanking() {
    const rows = window.GD_RANKING, G = window.GD_GROUPS, SEE = window.GD_SEE || {}
    const counts = {}; for (const r of rows) counts[r[3]] = (counts[r[3]] || 0) + 1
    const sum = $('#rank-summary')
    sum.innerHTML = `<button type="button" class="tierpill" data-t="" aria-pressed="${!tierFilter}">All <b>${rows.length}</b></button>` +
      Object.keys(TIER).map((t) => `<button type="button" class="tierpill t-${t}" data-t="${t}" aria-pressed="${tierFilter === t}"><span class="tdot"></span>${TIER[t]} <b>${counts[t] || 0}</b></button>`).join('')
    const host = $('#rank-list')
    let html = '', g = null
    for (const r of rows) {
      const [n, grp, blk, tier, where, why] = r
      if (tierFilter && tier !== tierFilter) continue
      if (grp !== g) { g = grp; html += `<h3 class="rgrp">${grp} · ${esc(G[grp])}</h3>` }
      const [plain, see] = SEE[n] || [blk, '']
      const src = imgFor(n)
      html += `<article class="rrow" data-n="${n}">
        <div class="rnum">${n}</div>
        <div class="rwhat"><h4>${esc(plain)}</h4><p>${esc(see)}</p><p class="rinv">Inventory name: ${esc(blk)}</p></div>
        <div class="rpic">${src ? `<button type="button" class="picbtn" data-src="${src}" data-cap="${esc(plain)}" aria-label="Enlarge the picture of ${esc(plain)}"><img src="${src}" alt="${esc(plain)} in today's app" loading="lazy"></button><span class="piccap">Today</span>` : `<span class="nopic">${esc(noPic(n, grp, tier))}</span>`}</div>
        <div class="rplan"><span class="tierlbl t-${tier}"><span class="tdot"></span>${TIER[tier]}</span><span class="rwhere">Goes to: ${esc(where)}</span><p>${esc(why)}</p></div>
        <div class="mine"><label class="l" for="rt-${n}">Your tier</label><select id="rt-${n}" data-fb="1"><option value="">Keep Claude's</option>${Object.keys(TIER).map((t) => `<option value="${t}">${TIER[t]}</option>`).join('')}</select>
        <textarea id="rn-${n}" rows="2" aria-label="Your note on ${esc(plain)}" placeholder="Note" data-fb="1"></textarea><span class="saved" aria-live="polite"></span></div></article>`
    }
    host.innerHTML = html
    for (const row of $$('.rrow', host)) {
      const id = 'rank-' + row.dataset.n
      bindPair(id, $('select', row), $('textarea', row), $('.saved', row), 'tier', rankListeners)
      const mark = () => row.classList.toggle('changed', !!(FB.get(id)?.tier || FB.get(id)?.note))
      rankListeners.add(mark); mark()
    }
    if (!db || !canWrite) setDisabled(true)
  }
  // The enlarged picture.
  $('#rank-list').addEventListener('click', (e) => {
    const b = e.target.closest('.picbtn'); if (!b) return
    const d = $('#picdlg'); $('#picdlg img').src = b.dataset.src; $('#picdlg img').alt = b.dataset.cap; $('#picdlg .cap').textContent = b.dataset.cap
    if (d.showModal) d.showModal(); else d.setAttribute('open', '')
  })
  $('#picdlg').addEventListener('click', (e) => { if (e.target.id === 'picdlg' || e.target.closest('.close')) $('#picdlg').close?.() })
  $('#rank-summary').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tierFilter = b.dataset.t; rankListeners.clear(); renderRanking() })

  // ---- Ladder -----------------------------------------------------------------------------
  const LAD = { dir: store('gd:dir') || 'panels', state: 'waiting', labels: true, look: store('gd:look') || '' }
  const L = window.GD_LADDER
  function segment(id, cb) {
    const seg = $(id)
    seg.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; for (const x of $$('button', seg)) x.setAttribute('aria-pressed', String(x === b)); cb(b.dataset.v) })
    return (v) => { for (const x of $$('button', seg)) x.setAttribute('aria-pressed', String(x.dataset.v === v)) }
  }
  const setDir = segment('#seg-dir', (v) => { LAD.dir = v; store('gd:dir', v); renderLadder() })
  segment('#seg-state', (v) => { LAD.state = v; renderLadder() })
  segment('#seg-labels', (v) => { LAD.labels = v === 'on'; renderLadder() })
  $('#sel-look').addEventListener('change', (e) => { LAD.look = e.target.value; store('gd:look', LAD.look); paintStages() })
  function renderLadder() {
    setDir(LAD.dir)
    const d = L.DIRS[LAD.dir]
    $('#lad-line').textContent = d.line
    $('#ladder-frames').innerHTML = L.SIZES.map((s) => `<div class="lad-col ${s.id}${s.w > 900 ? ' full' : ''}" style="--fw:${s.w}px">
      <h3>${s.name}<span>${s.note}</span></h3>
      <div class="wf-host" data-w="${s.w}" data-h="${s.h}">${L.frameHTML(LAD.dir, s.id, LAD.state, LAD.labels)}</div>
      <div class="shows"><b>Shows</b> ${esc(d.shows[s.id])}<br><b>Menu</b> ${esc(d.menu[s.id])}</div></div>`).join('')
    for (const h of $$('.wf-host')) ro.observe(h)
    paintStages()
  }
  const ro = new ResizeObserver((es) => { for (const e of es) fit(e.target) })
  function fit(host) {
    const w = +host.dataset.w, h = +host.dataset.h, k = Math.min(1, host.clientWidth / w)
    host.style.height = Math.round(h * k) + 'px'
    host.firstElementChild.style.transform = `scale(${k})`
  }
  // Draw the chosen concept into every stage box of the ladder: the at-bat at rest (waiting) or its end.
  const offscreen = {}
  function conceptInst(id) {
    if (offscreen[id]) return offscreen[id]
    const c = GD.concepts.find((x) => x.id === id); if (!c) return null
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300
    try { offscreen[id] = { cv, inst: c.create(cv) } } catch { offscreen[id] = null }
    return offscreen[id]
  }
  function paintStages() {
    const play = GD.playByAb(13)
    const st = GD.stateAt(play, LAD.state === 'waiting' ? 0 : GD.timeline(play).t.end)
    for (const cv of $$('.wf-stagecv')) {
      const w = +cv.dataset.w, h = +cv.dataset.h
      cv.width = w; cv.height = h
      const g = cv.getContext('2d'); g.clearRect(0, 0, w, h)
      if (!LAD.look) continue
      const o = conceptInst(LAD.look); if (!o) continue
      o.cv.width = w; o.cv.height = h
      try { o.inst.draw(st, w, h); g.drawImage(o.cv, 0, 0) } catch (e) { console.warn(e) }
    }
  }

  // ---- Stage players ----------------------------------------------------------------------
  const ORDER = [8, 9, 10, 11, 12, 13, 14, 15, 45]
  const NAMES = { 8: 'Naylor', 9: 'Young', 10: 'Montes', 11: 'Crawford', 12: 'Rodden', 13: 'Arozarena', 14: 'Canzone', 15: 'J. Rodríguez', 45: 'J. Rodríguez' }
  let shape = 'wide', selAb = 13
  const players = []
  function codeOf(ab) { return GD.playByAb(ab).code }
  function renderPlays() {
    $('#plays').innerHTML = ORDER.map((ab) => `<button type="button" data-ab="${ab}" aria-pressed="${ab === selAb}">${esc(NAMES[ab])}<small>${ab === 45 ? 'top 5th' : 'top 2nd'}</small></button>`).join('')
  }
  $('#plays').addEventListener('click', (e) => { const b = e.target.closest('[data-ab]'); if (!b) return; selAb = +b.dataset.ab; renderPlays(); for (const p of players) p.load(selAb) })
  segment('#seg-shape', (v) => { shape = v; $('#concepts').classList.toggle('tall', v === 'tall'); for (const p of players) p.resize(true) })
  $('#play-all').addEventListener('click', () => { for (const p of players) p.next() })
  $('#rm-note').textContent = reduce.matches ? 'Reduced motion is on: a tap shows the end frame at once, with no animation. The scrub bar still steps through the play.' : 'With Reduced motion on, a tap shows the end frame at once.'

  function makePlayer(C) {
    const el = document.createElement('article'); el.className = 'concept'
    el.innerHTML = `<div class="card" style="padding-top:20px"><span class="name">${esc(C.name)}</span>
      <div class="meta"><span class="chip">${esc(C.dims || '2D')}</span><span class="chip">${C.camera === 'continuous' ? 'Continuous camera' : C.camera === 'cut' ? 'One cut' : 'TV cuts'}</span></div>
      <p class="note" style="margin:8px 0 0">${esc(C.look || '')}</p></div>
      <div class="stagebox"><canvas aria-label="${esc(C.name)} stage"></canvas><span class="bat">Bat pose not approved yet</span><span class="fps" aria-live="off"></span><span class="tapnote"></span></div>
      <div class="herostrip"><span class="code"></span><span class="txt"></span></div>
      <div class="cctl"><button type="button" class="btn ink nextbtn">Next at-bat ›</button><input type="range" min="0" max="1" step="0.01" value="0" aria-label="Scrub ${esc(C.name)}"></div>
      <div class="strip" aria-label="Frame strip"></div>
      <ul class="cnotes">${(C.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <div class="fb"><select aria-label="Your verdict on ${esc(C.name)}"><option value="">No verdict</option><option value="keep">Keep exploring</option><option value="maybe">Parts of it</option><option value="drop">Drop it</option></select><textarea rows="2" aria-label="Note on ${esc(C.name)}" placeholder="What works, what does not"></textarea></div><span class="saved" aria-live="polite"></span>`
    const cv = $('canvas', el), fpsEl = $('.fps', el), tap = $('.tapnote', el), range = $('input[type=range]', el)
    const codeEl = $('.code', el), txtEl = $('.txt', el), stripEl = $('.strip', el)
    let inst = null
    try { inst = C.create(cv) } catch (e) { tap.textContent = 'This look could not start here.'; console.warn(e) }
    const P = { C, el, ab: selAb, t: 0, playing: false, played: false, raf: 0, frames: [], drawMs: [] }
    const play = () => GD.playByAb(P.ab)
    const end = () => GD.timeline(play()).t.end
    function size() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1)
      const W = Math.max(2, Math.round(r.width * dpr)), H = Math.max(2, Math.round(r.height * dpr))
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H }
      return [W, H]
    }
    function draw() {
      if (!inst) return
      const [W, H] = size(), t0 = performance.now()
      try { inst.draw(GD.stateAt(play(), P.t), W, H) } catch (e) { console.warn(e) }
      P.drawMs.push(performance.now() - t0)
    }
    function hero() {
      const p = play(), revealed = P.played && P.t >= GD.timeline(p).t.settleEnd
      codeEl.className = 'code' + (revealed ? '' : ' seal')
      codeEl.textContent = revealed ? p.code : 'Sealed'
      txtEl.innerHTML = revealed ? `<b>${esc(p.batter.name)}</b> · ${esc(p.line)}` : `Up: <b>${esc(p.batter.name)}</b> vs ${esc(p.pitcher.name)} · ${P.ab === 45 ? 'top 5th' : 'top 2nd'}`
      tap.textContent = P.playing ? 'Tap the stage to finish' : P.played ? '' : 'Tap Next at-bat to reveal and play'
      range.max = end().toFixed(2); range.value = P.t.toFixed(2)
    }
    function frame(now) {
      if (!P.playing) return
      if (P.last) P.frames.push(now - P.last)
      P.last = now
      P.t = (now - P.start) / 1000
      if (P.t >= end()) { P.t = end(); P.playing = false }
      draw(); hero(); meter()
      if (P.playing) P.raf = requestAnimationFrame(frame)
    }
    function meter(final) {
      if (!P.frames.length) return
      const fr = P.frames.slice(-90), avg = fr.reduce((a, b) => a + b, 0) / fr.length
      const worst = Math.max(...fr), dm = P.drawMs.slice(-90), dAvg = dm.reduce((a, b) => a + b, 0) / dm.length
      fpsEl.textContent = `${Math.round(1000 / avg)} fps · worst ${Math.round(worst)} ms · draw ${dAvg.toFixed(1)} ms`
    }
    P.next = () => {
      if (P.playing) { P.finish(); return }
      if (P.played) { const i = ORDER.indexOf(P.ab); P.ab = ORDER[(i + 1) % ORDER.length]; P.t = 0 }
      P.played = true
      if (reduce.matches) { P.t = end(); draw(); hero(); strip(); return }
      P.frames = []; P.drawMs = []; P.last = 0; P.playing = true; P.start = performance.now(); P.t = 0
      cancelAnimationFrame(P.raf); P.raf = requestAnimationFrame(frame); hero(); strip()
    }
    P.finish = () => { P.playing = false; cancelAnimationFrame(P.raf); P.t = end(); draw(); hero(); meter(true) }
    P.load = (ab) => { P.playing = false; cancelAnimationFrame(P.raf); P.ab = ab; P.t = 0; P.played = false; draw(); hero(); strip() }
    P.resize = (redrawStrip) => { draw(); if (redrawStrip) strip() }
    $('.nextbtn', el).addEventListener('click', P.next)
    cv.addEventListener('click', () => { if (P.playing) P.finish() })
    range.addEventListener('input', () => { P.playing = false; cancelAnimationFrame(P.raf); P.played = true; P.t = +range.value; draw(); hero() })
    // Six frames of the play, drawn by a second instance so the live stage keeps its place.
    let stripInst = null, stripCv = null, stripJob = 0
    function strip() {
      const job = ++stripJob
      setTimeout(() => {
        if (job !== stripJob) return
        if (!stripInst) { stripCv = document.createElement('canvas'); try { stripInst = C.create(stripCv) } catch { return } }
        const p = play(), T = GD.timeline(p).t, L = GD.timeline(p)
        const times = L.ball
          ? [[T.windupEnd + L.last.T * 0.5, 'Pitch'], [T.pitchEnd + 0.05, 'Contact'], [T.contactEnd + L.ball.T * 0.25, 'Chase'], [T.contactEnd + L.ball.T * 0.6, 'Chase'], [T.chaseEnd - 0.02, 'Landing'], [T.end, 'End']]
          : [[T.dotsEnd + 0.3, 'Windup'], [T.windupEnd + L.last.T * 0.5, 'Pitch'], [T.pitchEnd, 'Plate'], [T.pitchEnd + 0.3, 'Call'], [T.settleEnd, 'Settle'], [T.end, 'End']]
        const tall = shape === 'tall', W = tall ? 234 : 320, H = tall ? 360 : 200
        stripCv.width = W; stripCv.height = H
        stripEl.innerHTML = times.map(([, l]) => `<figure><canvas width="${W}" height="${H}"></canvas><figcaption>${l}</figcaption></figure>`).join('')
        const cvs = $$('canvas', stripEl)
        times.forEach(([t], i) => { try { stripInst.draw(GD.stateAt(p, t), W, H); cvs[i].getContext('2d').drawImage(stripCv, 0, 0) } catch (e) { console.warn(e) } })
      }, 60)
    }
    const fbSel = $('.fb select', el), fbNote = $('.fb textarea', el)
    bindPair('concept-' + C.id, fbSel, fbNote, $(':scope > .saved', el), 'verdict')
    P.load(selAb)
    return P
  }
  let stageBuilt = false
  onShow.stage = () => {
    if (stageBuilt) { for (const p of players) p.resize(); return }
    stageBuilt = true
    renderPlays()
    const host = $('#concepts')
    for (const C of GD.concepts.filter((c) => c.id !== 'wire')) { const P = makePlayer(C); host.appendChild(P.el); players.push(P) }
    requestAnimationFrame(() => { for (const p of players) p.resize(true) })
  }
  addEventListener('resize', () => { if (stageBuilt) for (const p of players) p.resize() })

  // ---- Swing stills ------------------------------------------------------------------------
  const POSES = [['stance', 'Stance', 'Hands near the back shoulder. The barrel is up and behind the head.'], ['load', 'Load', 'The front foot lifts. The hands go back.'], ['launch', 'Launch', 'The front foot lands. The hands come forward and down; the barrel lags behind.'], ['contact', 'Contact', 'The hips open. The arms extend, and the bat meets the ball in front of the plate.'], ['finish', 'Follow-through', 'The bat whips through and wraps behind the back. The back heel comes up.']]
  let hand = 'R'
  segment('#seg-hand', (v) => { hand = v; drawPoses() })
  function renderPoses() {
    $('#poses').innerHTML = POSES.map(([k, n, d]) => `<article class="pose card" style="padding-top:20px"><span class="name">${n}</span>
      <div class="views"><figure><canvas data-k="${k}" data-v="side" width="520" height="640"></canvas><figcaption>From the side</figcaption></figure><figure><canvas data-k="${k}" data-v="home" width="520" height="640"></canvas><figcaption>From the stage camera</figcaption></figure></div>
      <p class="note" style="margin:0">${esc(d)}</p>
      <div class="fb"><select aria-label="Your verdict on ${n}"><option value="">No verdict</option><option value="approve">Approve</option><option value="fix">Needs work</option></select><textarea rows="2" aria-label="Note on ${n}" placeholder="What looks wrong"></textarea></div><span class="saved" aria-live="polite"></span></article>`).join('')
    for (const a of $$('#poses .pose')) { const k = $('canvas', a).dataset.k; bindPair('pose-' + k, $('select', a), $('textarea', a), $('.saved', a), 'verdict') }
    drawPoses()
  }
  function drawPoses() {
    for (const cv of $$('#poses canvas')) {
      const k = cv.dataset.k, view = cv.dataset.v, g = cv.getContext('2d'), W = cv.width, H = cv.height
      const pose = GD.batterToWorld(GD.SWING[k], hand)
      const m = hand === 'L' ? -1 : 1, bx = -2.75 * m
      // Side: from the plate side, facing the batter's chest. Stage: behind home, re-aimed at the batter.
      const cam = view === 'side' ? GD.camera([bx + 13 * m, 0.4, 3.6], [bx, 0.4, 3.4], 34) : GD.camera([0, -12, 5.2], [bx * 0.8, 0.6, 3.4], 34)
      const P = (p) => GD.project(cam, p, W, H)
      g.fillStyle = '#fffdf6'; g.fillRect(0, 0, W, H)
      g.strokeStyle = '#cbc1a7'; g.lineWidth = 2
      const line = (a, b) => { const p = P(a), q = P(b); if (p && q) { g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke() } }
      line([-9, -3, 0], [9, -3, 0]); line([-9, 4, 0], [9, 4, 0]); line([bx - 2 * m, -3, 0], [bx - 2 * m, 4, 0]); line([bx + 2 * m, -3, 0], [bx + 2 * m, 4, 0])
      g.fillStyle = '#e8dfc6'; const pl = [[-0.71, 0, 0], [0.71, 0, 0], [0.71, 0.71, 0], [0, 1.42, 0], [-0.71, 0.71, 0]].map(P)
      if (pl.every(Boolean)) { g.beginPath(); pl.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill() }
      g.lineCap = 'round'; g.lineJoin = 'round'
      const ink = '#1b2a3a', far = '#56677a', grey = '#9aa3ad'
      // The far side of the body is drawn first and lighter, so the pose reads in depth.
      const depth = (j) => { const p = P(pose[j]); return p ? p.d : 0 }
      const limb = (a, b, wft, col) => { const p = P(pose[a]), q = P(pose[b]); if (!p || !q) return; g.strokeStyle = col; g.lineWidth = Math.max(2, wft * (p.s + q.s) / 2); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke() }
      const side = (s) => [['Sho', 'Elb'], ['Hip', 'Knee'], ['Knee', 'Foot']].map(([a, b]) => [s + a, s + b])
      const lFar = depth('lSho') > depth('rSho')
      const order = lFar ? ['l', 'r'] : ['r', 'l']
      for (const sd of order) { const col = sd === order[0] ? far : ink; for (const [a, b] of side(sd)) limb(a, b, a.endsWith('Sho') ? 0.32 : 0.36, col); limb(sd + 'Elb', 'hands', 0.28, col) }
      // Torso: shoulders to hips, filled grey (the road uniform).
      const tq = ['lSho', 'rSho', 'rHip', 'lHip'].map((j) => P(pose[j]))
      if (tq.every(Boolean)) { g.fillStyle = grey; g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); tq.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill(); g.stroke() }
      limb('neck', 'head', 0.25, ink)
      const hd = P(pose.head); if (hd) { g.fillStyle = ink; g.beginPath(); g.arc(hd.x, hd.y, 0.4 * hd.s, 0, 7); g.fill() }
      // The bat: knob at the hands, thicker toward the barrel.
      const h = P(pose.hands), tp = P(pose.batTip)
      if (h && tp) {
        const nx = tp.y - h.y, ny = h.x - tp.x, L = Math.hypot(nx, ny) || 1, w0 = 0.05 * h.s, w1 = 0.11 * tp.s
        g.fillStyle = '#8a5a1e'; g.beginPath(); g.moveTo(h.x + nx / L * w0, h.y + ny / L * w0); g.lineTo(tp.x + nx / L * w1, tp.y + ny / L * w1); g.lineTo(tp.x - nx / L * w1, tp.y - ny / L * w1); g.lineTo(h.x - nx / L * w0, h.y - ny / L * w0); g.closePath(); g.fill()
        g.fillStyle = ink; g.beginPath(); g.arc(h.x, h.y, Math.max(3, 0.09 * h.s), 0, 7); g.fill()
      }
      if (k === 'contact') { const b = P([0.2, 1.6, 2.8]); if (b) { g.fillStyle = '#fff'; g.strokeStyle = '#b4453a'; g.lineWidth = 2; g.beginPath(); g.arc(b.x, b.y, Math.max(5, 0.2 * b.s), 0, 7); g.fill(); g.stroke() } }
    }
  }
  let posesBuilt = false
  onShow.swing = () => { if (!posesBuilt) { posesBuilt = true; renderPoses() } }

  // ---- References -------------------------------------------------------------------------
  function renderRefs() {
    const cards = window.GD_REFS.map((r) => `<div class="card"><span class="name">${esc(r.title)}</span><ul class="reflist">${r.items.map(([s, src, g]) => `<li>${esc(s)} <span class="src">(${esc(src)})</span>${g ? `<br><b>${esc(g)}</b>` : ''}</li>`).join('')}</ul></div>`)
    if (window.GD_REF_MENUS) cards.push(`<div class="card"><span class="name">Menus</span><ul class="reflist">${window.GD_REF_MENUS.map(([s, src, g]) => `<li>${esc(s)} <span class="src">(${esc(src)})</span>${g ? `<br><b>${esc(g)}</b>` : ''}</li>`).join('')}</ul></div>`)
    cards.push(`<div class="card"><span class="name">Sources</span><ul class="reflist">${window.GD_REF_SOURCES.map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('')}${(window.GD_REF_MENU_SOURCES || []).map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('')}</ul><p class="note" style="margin-top:8px">Each is a gameplay video; the notes come from stills of it. Claude did not play the games.</p></div>`)
    $('#refgrid').innerHTML = cards.join('')
  }

  // ---- Boot -------------------------------------------------------------------------------
  function bindStatic() { bindPair('direction', $('#fb-dir'), $('#fb-dir-note'), $('#fb-dir-saved')) }
  for (const c of GD.concepts.filter((c) => c.id !== 'wire')) $('#sel-look').insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(c.name)}</option>`)
  $('#sel-look').value = GD.concepts.some((c) => c.id === LAD.look) ? LAD.look : ''
  LAD.look = $('#sel-look').value
  onShow.ladder = () => { for (const h of $$('.wf-host')) fit(h) }
  renderRanking(); bindStatic(); renderLadder(); renderRefs()
  show(location.hash.slice(1) || 'overview')
  initDb()
})()
