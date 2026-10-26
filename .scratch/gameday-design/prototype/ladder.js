// The size ladder: two layout directions at the four sizes in #2568, in three states.
// Every frame is a fixed box at its true size, scaled to fit. Boxes: [part, x, y, w, h].
;(function () {
  const SIZES = [
    { id: 'P', w: 390, h: 763, name: 'Phone', note: '390 × 763' },
    { id: 'T', w: 760, h: 1024, name: 'Tablet portrait', note: '760 × 1024' },
    { id: 'L', w: 1180, h: 820, name: 'iPad landscape', note: '1180 × 820' },
    { id: 'D', w: 1440, h: 900, name: 'Desktop', note: '1440 × 900' },
  ]
  const DIRS = {
    hud: {
      name: 'A · HUD over the stage',
      line: 'The stage fills the window. Game state floats at the edges, like MVP Baseball 2004 and The Show.',
      frames: {
        P: [['stage', 0, 0, 390, 763], ['band', 10, 10, 312, 62], ['menu', 330, 10, 50, 62], ['hero', 10, 540, 370, 134], ['bar', 0, 683, 390, 80]],
        T: [['stage', 0, 0, 760, 1024], ['band', 20, 20, 360, 66], ['nav', 20, 94, 360, 44], ['trail', 392, 20, 288, 66], ['menu', 692, 20, 48, 66], ['hero', 20, 822, 456, 116], ['pitches', 488, 762, 252, 176], ['bar', 0, 950, 760, 74]],
        L: [['stage', 0, 0, 1180, 820], ['band', 24, 20, 380, 66], ['nav', 24, 94, 380, 44], ['trail', 420, 20, 676, 54], ['menu', 1108, 20, 48, 54], ['minimap', 956, 86, 200, 150], ['hero', 24, 628, 520, 116], ['pitches', 876, 560, 280, 184], ['bar', 0, 752, 1180, 68]],
        D: [['stage', 0, 0, 1440, 900], ['band', 24, 20, 400, 68], ['nav', 24, 96, 400, 44], ['cam2', 24, 152, 300, 170], ['trail', 440, 20, 912, 54], ['menu', 1368, 20, 48, 54], ['log', 1176, 86, 240, 420], ['hero', 24, 704, 560, 120], ['pitches', 1136, 640, 280, 184], ['bar', 0, 832, 1440, 68]],
      },
      shows: {
        P: 'Stage, band, hero, bar. Everything else is in the menu.',
        T: 'Adds the navigator (line score), the trail and the pitch panel.',
        L: 'Adds a field mini-map in the corner during the chase.',
        D: 'Adds a second camera view and the event log.',
      },
      menu: {
        P: 'Trail · Navigator · Pitches · Lineups · Field · Arms · Extras · Scorecard · Box score · Refresh',
        T: 'Lineups · Field · Arms · Extras · Scorecard · Box score · Refresh',
        L: 'Lineups · Field · Arms · Extras · Scorecard · Box score · Refresh (a drawer from the right)',
        D: 'Lineups · Field · Arms · Extras · Scorecard · Box score · Refresh (a drawer from the right)',
      },
    },
    panels: {
      name: 'B · Panels around the stage',
      line: 'The stage sits in a frame. Panels hold the game state, the at-bat and the lineups, like Out of the Park.',
      frames: {
        P: [['band', 0, 0, 390, 86], ['stage', 10, 96, 370, 326], ['hero', 10, 432, 370, 240], ['bar', 0, 683, 390, 80]],
        T: [['band', 0, 0, 760, 72], ['nav', 0, 72, 760, 44], ['stage', 16, 128, 728, 448], ['hero', 16, 588, 452, 268], ['pitches', 480, 588, 264, 268], ['trail', 16, 868, 728, 66], ['bar', 0, 944, 760, 80]],
        L: [['band', 0, 0, 580, 66], ['nav', 580, 0, 600, 66], ['lineup', 16, 78, 240, 584], ['stage', 268, 78, 644, 404], ['hero', 268, 494, 644, 168], ['ref', 924, 78, 240, 584], ['trail', 16, 674, 1148, 58], ['bar', 0, 744, 1180, 76]],
        D: [['band', 0, 0, 700, 68], ['nav', 700, 0, 740, 68], ['lineup', 16, 80, 264, 662], ['stage', 292, 80, 856, 486], ['hero', 292, 578, 520, 164], ['pitches', 824, 578, 324, 164], ['ref', 1160, 80, 264, 430], ['log', 1160, 522, 264, 220], ['trail', 16, 754, 1408, 66], ['bar', 0, 832, 1440, 68]],
      },
      shows: {
        P: 'Band, stage, hero, bar. The hero grows to hold the pitch track and the due-up strip. The menu button sits in the bar.',
        T: 'Adds the navigator, the pitch panel and the trail as rows.',
        L: 'Adds the batting order on the left and the reference tabs on the right.',
        D: 'Adds the event log under the reference tabs and a wider stage.',
      },
      menu: {
        P: 'Trail · Navigator · Pitches · Lineups · Field · Arms · Extras · Scorecard · Box score · Refresh',
        T: 'Lineups · Field · Arms · Extras · Scorecard · Box score · Refresh',
        L: 'Scorecard · Box score · Refresh · the other club\'s order',
        D: 'Scorecard · Box score · Refresh · the other club\'s order',
      },
    },
  }

  // ---- Content: the real top 2nd at Fenway, before and after Arozarena's at-bat --------------
  const D = window.GD_DATA, P13 = D.plays.find((p) => p.ab === 13), P12 = D.plays.find((p) => p.ab === 12)
  const last13 = P13.pitches.filter((p) => p.n).at(-1)
  const ORDER = [['1st', 56, 'R. Arozarena', 'LF'], ['2nd', 8, 'D. Canzone', 'RF'], ['3rd', 44, 'J. Rodríguez', 'CF'], ['4th', 29, 'C. Raleigh', 'C'], ['5th', 12, 'J. Naylor', '1B'], ['6th', 2, 'C. Young', '2B'], ['7th', 99, 'L. Montes', 'DH'], ['8th', 3, 'J.P. Crawford', 'SS'], ['9th', 90, 'B. Rodden', '3B']]
  const S = {
    waiting: {
      score: [3, 1], half: '▲2', outs: 1, bases: [1, 1, 0], count: '0-0', pc: 29, sealed: true,
      line: [['SEA', '1', '2', '', '', '', '', '', '', '', 3, 4, 0], ['BOS', '1', '', '', '', '', '', '', '', '', 1, 1, 0]],
      trail: [['2B', 'Naylor'], ['1B', 'Young'], ['BB', 'Montes'], ['SF 9', 'Crawford'], ['1B', 'Rodden'], ['?', 'Arozarena']],
      last: { code: '1B', slot: '9th', num: 90, name: 'Brock Rodden', pos: '3B', rbi: 1, day: '1-for-1 today', line: 'Rodden singles to second. Young scores, Montes to second.', track: pt(P12), legs: 1 },
      up: ORDER.slice(0, 3),
      log: ['Naylor doubles to right.', 'Young singles to centre. Naylor to third.', 'Montes walks.', 'Crawford flies out to right. Naylor scores.', 'Rodden singles to second. Young scores.'],
    },
    revealed: {
      score: [6, 1], half: '▲2', outs: 1, bases: [0, 0, 0], count: '2-1', pc: 33, sealed: false,
      line: [['SEA', '1', '5', '', '', '', '', '', '', '', 6, 5, 0], ['BOS', '1', '', '', '', '', '', '', '', '', 1, 1, 0]],
      trail: [['2B', 'Naylor'], ['1B', 'Young'], ['BB', 'Montes'], ['SF 9', 'Crawford'], ['1B', 'Rodden'], ['HR', 'Arozarena'], ['?', 'Canzone']],
      last: { code: 'HR', slot: '1st', num: 56, name: 'Randy Arozarena', pos: 'LF', rbi: 3, day: '1-for-2 today', line: 'Arozarena homers over the Monster. Three runs score.', track: pt(P13), legs: 4 },
      up: ORDER.slice(1, 4),
      contact: `${P13.ball.ev} mph · ${P13.ball.la}° · ${P13.ball.dist} ft`,
      tag: `${Math.round(last13.mph)} ${last13.type}`,
      log: ['Naylor doubles to right.', 'Young singles to centre. Naylor to third.', 'Montes walks.', 'Crawford flies out to right. Naylor scores.', 'Rodden singles to second. Young scores.', 'Arozarena homers to left. Montes and Rodden score.'],
    },
  }
  function pt(play) { return play.pitches.filter((p) => p.n).map((p) => ({ n: p.n, c: p.code, ty: p.type, mph: Math.round(p.mph) })) }
  const callOf = (c) => ('BIP*V'.includes(c[0]) ? 'b' : 'XDE'.includes(c) ? 'x' : 's')

  // ---- Parts ------------------------------------------------------------------------------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const diamond = (b, size = 26) => `<svg class="wf-dia" width="${size}" height="${size}" viewBox="0 0 26 26" aria-hidden="true">
    <rect x="15" y="9" width="7" height="7" transform="rotate(45 18.5 12.5)" class="${b[0] ? 'on' : ''}"/>
    <rect x="9.5" y="3.5" width="7" height="7" transform="rotate(45 13 7)" class="${b[1] ? 'on' : ''}"/>
    <rect x="4" y="9" width="7" height="7" transform="rotate(45 7.5 12.5)" class="${b[2] ? 'on' : ''}"/></svg>`
  const outs = (n) => `<span class="wf-outs">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`
  // The #22 box: the scorebook square the reader copies to paper. Gary, 2026-10-26: "the heart of what I
  // write in my scorebook" — the balls and strikes columns and the diamond, at a size you can copy from.
  const box22 = (l, size) => {
    const balls = l.track.filter((p) => callOf(p.c) === 'b').map((p) => p.n)
    const strikes = l.track.filter((p) => callOf(p.c) !== 'b').map((p) => (callOf(p.c) === 'x' ? 'X' : p.n))
    const col = (head, xs) => `<div><i>${head}</i>${xs.map((x) => `<span>${x}</span>`).join('')}</div>`
    return `<div class="wf-box22" style="width:${Math.round(size * 1.5)}px;height:${size}px">
    <div class="wf-bs">${col('B', balls)}${col('S', strikes)}</div>
    <div class="wf-dia22">${diaSvg(l)}<b>${esc(l.code)}</b>${l.rbi ? `<em>${l.rbi} RBI</em>` : ''}</div></div>`
  }
  const diaSvg = (l) => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 34 L34 20 L20 6 L6 20 Z" class="dia"/>
    ${l.legs >= 1 ? '<path d="M20 34 L34 20" class="leg"/>' : ''}${l.legs >= 2 ? '<path d="M34 20 L20 6" class="leg"/>' : ''}${l.legs >= 3 ? '<path d="M20 6 L6 20" class="leg"/>' : ''}${l.legs >= 4 ? '<path d="M6 20 L20 34" class="leg"/><path d="M20 34 L34 20 L20 6 L6 20 Z" class="fill"/>' : ''}</svg>`
  const track = (tr) => `<span class="wf-track">${tr.map((p) => `<i class="${callOf(p.c)}">${callOf(p.c) === 'x' ? 'X' : p.n}</i>`).join('')}</span>`

  const PART = {
    stage(w, h, st, ctx) {
      return `<canvas class="wf-stagecv" data-w="${w}" data-h="${h}" aria-label="Stage"></canvas>
        ${st.sealed ? '' : `<span class="wf-tag" style="left:${Math.round(w * 0.5 + 18)}px;top:${Math.round(h * (ctx.dir === 'hud' ? 0.42 : 0.55))}px">${esc(st.tag)}<b>X</b></span>`}`
    },
    band(w, h, st) {
      const big = w > 330
      return `<div class="wf-band"><div class="wf-score"><span><b>SEA</b><em>${st.score[0]}</em></span><span><b>BOS</b><em>${st.score[1]}</em></span></div>
        <button class="wf-half" type="button" tabindex="-1">${st.half}</button>
        <div class="wf-state">${diamond(st.bases, big ? 30 : 26)}<span class="wf-count">${st.count}</span>${outs(st.outs)}${big ? `<span class="wf-pc">P ${st.pc}</span>` : ''}</div></div>`
    },
    menu() { return '<div class="wf-menu"><span></span><span></span><span></span><small>Menu</small></div>' },
    nav(w, h, st) {
      const cols = w > 380 ? 9 : 6
      const head = ['', ...Array.from({ length: cols }, (_, i) => i + 1), 'R', 'H', 'E']
      const row = (r) => [r[0], ...r.slice(1, cols + 1), r[10], r[11], r[12]]
      return `<table class="wf-nav"><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr>${st.line.map((r) => `<tr>${row(r).map((c, i) => `<td class="${i === 2 && r[0] === 'SEA' ? 'cur' : ''}">${c}</td>`).join('')}</tr>`).join('')}</table>`
    },
    trail(w, h, st) {
      const n = Math.max(3, Math.floor(w / 92))
      const items = st.trail.slice(-n)
      return `<div class="wf-trail">${items.map((c) => `<span class="${c[0] === '?' ? 'seal' : ''}"><b>${c[0] === '?' ? '' : esc(c[0])}</b>${esc(c[1])}</span>`).join('')}</div>`
    },
    hero(w, h, st, ctx) {
      const l = st.last, roomy = w > 400, tall = h > 180
      const who = `<div class="wf-who"><b>#${l.num} ${esc(l.name)}</b> <span>${l.pos} · ${l.slot}</span></div>`
      const pitcher = `<div class="wf-vs">${roomy ? `${l.day} · ` : ''}vs #65 J. Paez · RHP</div>`
      const due = `<div class="wf-due"><small>${st.sealed ? 'Due up' : 'Next'}</small>${st.up.map((u, i) => `<span class="${i === 0 && st.sealed ? 'now' : ''}">${roomy ? `${u[0]} · ` : ''}#${u[1]} ${esc(roomy ? u[2] : u[2].split(' ').pop())}</span>`).join('')}</div>`
      const lineText = roomy || tall || !st.sealed ? `<p class="wf-line">${esc(l.line)}</p>` : ''
      const contact = !st.sealed && tall && ctx.dir === 'panels' && ctx.size === 'P' ? `<div class="wf-contact">${esc(st.contact)}</div>` : ''
      return `<div class="wf-hero ${st.sealed ? 'is-waiting' : ''}">
        ${box22(l, Math.min(roomy ? 108 : 100, h - 22))}
        <div class="wf-herobody">${st.sealed ? '<small class="wf-lastlbl">Last result</small>' : ''}${who}${roomy || tall ? pitcher : ''}${lineText}${contact}${tall || st.sealed ? due : ''}</div></div>`
    },
    pitches(w, h, st) {
      const l = st.last
      return `<div class="wf-pitches"><small>Pitches · ${esc(l.name.split(' ').pop())}</small>${l.track.map((p) => `<div><i class="${callOf(p.c)}">${callOf(p.c) === 'x' ? 'X' : p.n}</i>${p.ty} ${p.mph}</div>`).join('')}
        ${st.sealed ? '' : `<small>Contact</small><div class="wf-contact">${esc(st.contact)}</div>`}</div>`
    },
    bar(w, h, st, ctx) {
      const menuIn = ctx.dir === 'panels'
      return `<div class="wf-bar">${menuIn ? '<span class="wf-menu wf-menu--bar"><span></span><span></span><span></span><small>Menu</small></span>' : ''}
        <span class="wf-pxp">Pitch<br>by pitch</span>
        <span class="wf-next">${st.sealed ? 'Next at-bat' : 'Next at-bat'}<b>›</b></span></div>`
    },
    minimap(w, h, st) {
      return `<div class="wf-mini"><small>Field</small><svg viewBox="0 0 100 80" aria-hidden="true"><path d="M50 74 L80 44 L50 14 L20 44 Z" class="dia"/><path d="M50 74 L4 28 Q50 -8 96 28 Z" class="out"/>${st.bases[0] ? '<circle cx="80" cy="44" r="4" class="run"/>' : ''}${st.bases[1] ? '<circle cx="50" cy="14" r="4" class="run"/>' : ''}${st.sealed ? '' : '<circle cx="14" cy="22" r="3.2" class="ball"/>'}</svg></div>`
    },
    cam2(w, h, st) { return `<div class="wf-cam2"><small>Second camera · field view</small></div>` },
    log(w, h, st) { return `<div class="wf-log"><small>Event log · top 2nd</small>${st.log.map((e) => `<p>${esc(e)}</p>`).join('')}</div>` },
    lineup(w, h, st) {
      const cur = st.sealed ? 0 : 1
      return `<div class="wf-lineup"><small>Seattle · batting</small>${ORDER.map((o, i) => `<div class="${i === cur ? 'now' : ''}"><span>${o[0]}</span><b>#${o[1]} ${esc(o[2])}</b><em>${o[3]}</em></div>`).join('')}<small>Boston · in the field</small><div class="muted">Fielders by position</div></div>`
    },
    ref(w, h) {
      return `<div class="wf-ref"><div class="wf-tabs"><span class="on">Arms</span><span>Field</span><span>Extras</span></div>
        <div class="wf-reftbl"><div><b>J. Paez</b><em>1.1 IP · 6 R · P 33</em></div><div class="muted">Pitchers table, margin notes, insights, ABS bank</div></div></div>`
    },
  }

  // A menu that is open: a bottom sheet on the narrow sizes, a drawer on the wide HUD sizes.
  function menuOverlay(dir, size, f) {
    const items = DIRS[dir].menu[size].split(' · ')
    const wide = (size === 'L' || size === 'D')
    if (dir === 'panels' && wide) {
      return `<div class="wf-pop" style="left:16px;bottom:${86}px;width:300px">${items.map((i) => `<div>${esc(i)}</div>`).join('')}</div>`
    }
    const sheet = wide ? `left:${f.w - 380}px;top:0;width:380px;height:${f.h}px` : `left:0;top:${Math.round(f.h * 0.32)}px;width:${f.w}px;height:${Math.round(f.h * 0.68)}px`
    return `<div class="wf-scrim"></div><div class="wf-sheet ${wide ? 'is-drawer' : ''}" style="${sheet}"><div class="wf-grab"></div><small>Menu</small>
      ${items.map((i, k) => `<div class="wf-mi ${k === 0 ? 'on' : ''}"><b>${esc(i.replace(/ \(.*\)/, ''))}</b><span>${menuWhat(i)}</span></div>`).join('')}</div>`
  }
  function menuWhat(i) {
    const k = i.replace(/ \(.*\)/, '')
    return ({ Trail: 'This half’s at-bats, tap one to read it', Navigator: 'Line score; tap a run cell to jump to any half', Pitches: 'Pitch list and the contact readout', Lineups: 'Both orders, with who is up', Field: 'Defense with name tags, the half’s spray', Arms: 'Pitchers, margin notes, insights, ABS bank', Extras: 'Bench, bullpen, win probability, umpire', Scorecard: 'Open the live scorecard', 'Box score': 'Go to the box score', Refresh: 'Fetch the feed now (it polls every 60 s)', "the other club's order": 'The fielding side’s lineup' })[k] || ''
  }

  function frameHTML(dir, sizeId, stateId, labels) {
    const f = SIZES.find((s) => s.id === sizeId), boxes = DIRS[dir].frames[sizeId]
    const st = stateId === 'menu' ? S.revealed : S[stateId]
    const ctx = { dir, size: sizeId }
    const parts = boxes.map(([part, x, y, w, h]) => `<div class="wf-part wf-${part}-box" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${PART[part](w, h, st, ctx)}${labels ? `<span class="wf-label">${part === 'nav' ? 'navigator' : part === 'ref' ? 'reference' : part === 'cam2' ? 'camera 2' : part === 'minimap' ? 'mini-map' : part}</span>` : ''}</div>`).join('')
    return `<div class="wf wf--${dir}" style="width:${f.w}px;height:${f.h}px" data-state="${stateId}">${parts}${stateId === 'menu' ? menuOverlay(dir, sizeId, f) : ''}</div>`
  }

  window.GD_LADDER = { SIZES, DIRS, S, frameHTML }
})()
