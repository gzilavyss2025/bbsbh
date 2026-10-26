// Drop 2 of round 2: the ADR-0123 wireframe questions (Steps), the zone map at rest, and the sizes.
// Uses the page helpers app.js exposes (window.R2APP) and the frames in gd.js.
;(function () {
  const { $, $$, esc, mount, col, ask, segment, onShow, fit } = window.R2APP
  const { frame, box, boxOf, SIZES } = window.GDR

  // ---- Steps: one tap, one sub-step (ADR-0123) ------------------------------------------------
  const STP = { words: 'next', style: 'toggle', mode: 'pitch' }
  segment('#seg-swords', (v) => { STP.words = v; renderSteps() })
  segment('#seg-sstyle', (v) => { STP.style = v; renderSteps() })
  segment('#seg-smode', (v) => { STP.mode = v; renderSteps() })
  // The mid-at-bat event card: a lower third on the stage. It shows the event's own effect only
  // (ADR-0123 decision 5): Durbin's box with the new leg, and the band's bases. Never the at-bat's end.
  function eventCard(w, h) {
    const big = w > 500
    return `<div class="gd-evcard">${box(boxOf(56, 3), big ? 84 : 64)}<div class="gd-evcard__txt"><span class="gd-evcard__kind">Wild pitch</span>
      <span><b>Durbin to 3rd</b> on Woo's wild pitch.</span><span class="gd-note">Pencil WP on Durbin's leg to 3rd.</span></div></div>`
  }
  function renderSteps() {
    const pxp = STP.mode === 'pitch'
    const seq = pxp
      ? [['b6pre', 'Before the first tap', 'Duran is up, sealed. The zone and the box are empty.'],
         ['b6p3', 'Tap 3: pitch 3', 'A foul. The box gets a 3 in the S column; the stage shows pitch 3 and the marks before it.'],
         ['b6wp', 'Tap 6: the wild pitch', 'An event gets its own tap. Durbin moves; Duran\'s box stays open.'],
         ['b6res', 'Tap 7: the result', 'The last pitch is the result tap: 4-3, the third out.']]
      : [['b6pre', 'Before the first tap', 'Duran is up, sealed.'],
         ['b6wp', 'Tap 1: the wild pitch', 'At-bat mode stops only at events and the result. The count shows how far the at-bat got.'],
         ['b6res', 'Tap 2: the result', '4-3, the third out. The checkpoint follows.']]
    const sc = (state) => ({ size: 'P', state, palette: 'stage', pxp, pxpStyle: STP.style, words: STP.words, eventCard })
    const desk = col('D', 'Desktop · the wild pitch', frame({ ...sc('b6wp'), size: 'D' }), '<b>Same card</b>, same place, at every size.')
    mount($('#steps-frames'), seq.map(([st, t, c]) => col('P', t, frame(sc(st)), esc(c))).join('') + desk)
    // In at-bat mode the WP stop happens with no pitch taps, so its box shows the five pitches it passed.
    for (const h of $$('#steps-frames .host')) fit(h)
  }
  let stepsBuilt = false
  onShow.steps = () => {
    if (stepsBuilt) { for (const h of $$('#tab-steps .host')) fit(h); return }
    stepsBuilt = true; renderSteps()
    $('#steps-asks').append(
      ask('steps-words', 'The advance control\'s words', [['next', '"Next ›" in every state and mode'], ['mode', '"Next play ›", and "Next pitch ›" in pitch mode'], ['play', '"Play ›" in every state']], 'ADR-0123 decision 3: one label in every state. A checkpoint label ("Bottom 2nd ›") comes only after the third out is shown.'),
      ask('steps-button', 'The pitch-by-pitch button', [['toggle', 'A toggle in the bar, inked when on'], ['switch', 'A two-way switch in the bar: At-bat | Pitch'], ['menu', 'In the menu only']]),
      ask('steps-substep', 'A pitch on the stage', [['ok', 'Right: the pitch flies, its mark stays, the box gets its number'], ['change', 'Change (say how)']]),
      ask('steps-event', 'The mid-at-bat event card', [['ok', 'Right: a lower third on the stage with the runner\'s box'], ['hero', 'Put it in the hero instead'], ['change', 'Change (say how)']]),
    )
  }

  // ---- The zone map at rest ------------------------------------------------------------------
  const ZN = { stat: 'avg', pal: 'stage' }
  segment('#seg-zstat', (v) => { ZN.stat = v; renderZones() })
  segment('#seg-zpal', (v) => { ZN.pal = v; renderZones() })
  function renderZones() {
    mount($('#zone-frames'), SIZES.map((s) => col(s.id, s.name, frame({ size: s.id, state: 'waiting', palette: ZN.pal, zones: true, zoneStat: ZN.stat }))).join(''))
  }
  let zonesBuilt = false
  onShow.zones = () => {
    if (zonesBuilt) { for (const h of $$('#tab-zones .host')) fit(h); return }
    zonesBuilt = true; renderZones()
    $('#zone-asks').append(
      ask('zones-show', 'The zone map at rest', [['both', 'Tint in the zone and the numbers in the corner'], ['tint', 'Tint only'], ['card', 'Numbers only'], ['none', 'Neither: drop it']]),
      ask('zones-stat', 'Which number', [['avg', 'Batting average'], ['slg', 'Slugging'], ['toggle', 'Either, with a toggle']]),
    )
  }

  // ---- Sizes: the breakpoints and the fold order ----------------------------------------------
  // A tier is the largest whose minimum the window meets. Widths are ones the width guard already
  // allows (740, 1000, 1200: scripts/layout/check-media-widths.mjs). Heights have no guard.
  const TIERS = [
    { id: 'D', name: 'Desktop', minW: 1200, minH: 780, land: false },
    { id: 'L', name: 'iPad landscape', minW: 1000, minH: 700, land: true },
    { id: 'T', name: 'Tablet portrait', minW: 740, minH: 900, land: false },
    { id: 'P', name: 'Phone', minW: 0, minH: 0, land: false },
  ]
  const tierOf = (w, h) => TIERS.find((t) => w >= t.minW && h >= t.minH && (!t.land || w > h)).id
  // Viewports: CSS px of the browser's visible area. Claude's general knowledge, not measured here.
  const DEVICES = [['iPhone SE, Safari', 375, 553], ['iPhone 15, Safari', 390, 763], ['iPhone 15 Pro Max, Safari', 430, 839], ['iPad mini, portrait', 744, 1133], ['iPad (10th gen), portrait', 820, 1180],
    ['iPad mini, landscape', 1133, 744], ['iPad Air 11", landscape', 1180, 820], ['Old iPad, landscape', 1024, 768], ['Laptop window', 1280, 720], ['MacBook Air 13", Chrome', 1440, 790], ['iPad Pro 13", landscape', 1376, 1032], ['1080p monitor', 1920, 1080]]
  const BLOCKS = [['Band (score, half, count, outs, bases)', 'PTLD'], ['Stage', 'PTLD'], ['Hero with the scorebook box', 'PTLD'], ['Bar (menu, pitch toggle, advance)', 'PTLD'],
    ['Navigator (line score)', 'TLD'], ['Trail (at-bat chips)', 'TLD'], ['Pitches panel', 'TD'], ['Batting order', 'LD'], ['Reference tabs (arms, field, extras)', 'LD'], ['Event log', 'D']]
  const FOLD = ['Event log (folds first: under 1200 wide or 780 tall)', 'Pitches panel (iPad landscape gives its room to the two side columns)', 'Batting order and reference tabs (folds under 1000 wide, or in portrait)', 'Trail (folds on the phone)', 'Navigator (folds on the phone; one tap away in the menu, ADR-0043)', 'Never folds: band, stage, hero with the scorebook box, bar']
  function renderSizes() {
    $('#size-rule').innerHTML = `<tr><th>Size</th><th>Width</th><th>Height</th><th>Shape</th></tr>` + TIERS.map((t) => `<tr><td><b>${t.name}</b></td><td>${t.minW ? `≥ ${t.minW}` : 'any'}</td><td>${t.minH ? `≥ ${t.minH}` : 'any'}</td><td>${t.land ? 'landscape' : t.id === 'P' ? 'below the others' : 'any'}</td></tr>`).join('')
    $('#size-dev').innerHTML = `<tr><th>Window</th><th>W × H</th><th>Gets</th></tr>` + DEVICES.map(([n, w, h]) => `<tr><td>${esc(n)}</td><td class="num">${w} × ${h}</td><td><b>${TIERS.find((t) => t.id === tierOf(w, h)).name}</b></td></tr>`).join('')
    $('#size-matrix').innerHTML = `<tr><th>Block</th>${['P', 'T', 'L', 'D'].map((s) => `<th>${s}</th>`).join('')}</tr>` + BLOCKS.map(([b, on]) => `<tr><td>${esc(b)}</td>${['P', 'T', 'L', 'D'].map((s) => `<td>${on.includes(s) ? '●' : '<span class="note">menu</span>'}</td>`).join('')}</tr>`).join('')
    $('#size-fold').innerHTML = FOLD.map((f) => `<li>${esc(f)}</li>`).join('')
    sim()
  }
  function sim() {
    const w = +$('#sim-w').value, h = +$('#sim-h').value, t = tierOf(w, h)
    $('#sim-out').innerHTML = `<b>${w} × ${h}</b> gets <b>${esc(TIERS.find((x) => x.id === t).name)}</b>`
    mount($('#sim-frame'), col(t, `${TIERS.find((x) => x.id === t).name} boxes`, frame({ size: t, state: 'waiting', palette: 'stage', labels: true }), 'Drawn at the tier\'s own size. In the build the stage takes up the slack; nothing else stretches.'))
  }
  let sizesBuilt = false
  onShow.sizes = () => {
    if (sizesBuilt) { for (const h of $$('#tab-sizes .host')) fit(h); return }
    sizesBuilt = true
    for (const id of ['#sim-w', '#sim-h']) $(id).addEventListener('input', sim)
    renderSizes()
    $('#size-asks').append(
      ask('sizes-rule', 'The breakpoints', [['ok', 'Right as proposed'], ['change', 'Change (say which)']], 'Widths reuse 740, 1000 and 1200, which the width guard already allows. Heights are new and have no guard.'),
      ask('sizes-fold', 'The fold order', [['ok', 'Right as proposed'], ['change', 'Change (say which)']]),
    )
  }

  window.R2APP.FOUND([
    ['A wild pitch is a sub-step of its own.', '824716 bottom 6th, Duran\'s at-bat: the feed puts the wild pitch as its own action after pitch 5 (Durbin 2nd to 3rd), and a mound visit after pitch 1. The Steps tab draws the at-bat tap by tap from those events.'],
    ['Sogard\'s strikeout has no scorebook code.', 'computeHalfInningFeed gives no code for atBatIndex 55 (bottom 6th), a called third strike confirmed on an ABS challenge. Inference: the challenge text is what trips the code; not traced. Outside this round.'],
    ['The notes need a callout bundle.', 'public/data/callouts holds only the nightly window (10/17 to 10/27 now), so a game outside it, like 824716, shows no between-innings notes in today\'s app. The Notes page borrows 849817\'s.'],
  ])
})()
