// Gameday layout B at the four sizes, drawn in tokens (round 2). Design code, not app code.
// A frame is fixed boxes at true size (round 1's ladder, DIRS.panels), scaled to fit by the page.
// Every value comes from data.js (round 1) or data2.js (tools/extract2.mjs), both from gamePk 824716.
;(function () {
  const D = window.GD_DATA, R2 = window.GD_R2
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const SIZES = [
    { id: 'P', w: 390, h: 763, name: 'Phone', note: '390 × 763' },
    { id: 'T', w: 760, h: 1024, name: 'Tablet portrait', note: '760 × 1024' },
    { id: 'L', w: 1180, h: 820, name: 'iPad landscape', note: '1180 × 820' },
    { id: 'D', w: 1440, h: 900, name: 'Desktop', note: '1440 × 900' },
  ]
  // Round 1's boxes for direction B, unchanged (settled).
  const BOXES = {
    P: [['band', 0, 0, 390, 86], ['stage', 10, 96, 370, 326], ['hero', 10, 432, 370, 240], ['bar', 0, 683, 390, 80]],
    T: [['band', 0, 0, 760, 72], ['nav', 0, 72, 760, 44], ['stage', 16, 128, 728, 448], ['hero', 16, 588, 452, 268], ['pitches', 480, 588, 264, 268], ['trail', 16, 868, 728, 66], ['bar', 0, 944, 760, 80]],
    L: [['band', 0, 0, 580, 66], ['nav', 580, 0, 600, 66], ['lineup', 16, 78, 240, 584], ['stage', 268, 78, 644, 404], ['hero', 268, 494, 644, 168], ['ref', 924, 78, 240, 584], ['trail', 16, 674, 1148, 58], ['bar', 0, 744, 1180, 76]],
    D: [['band', 0, 0, 700, 68], ['nav', 700, 0, 740, 68], ['lineup', 16, 80, 264, 662], ['stage', 292, 80, 856, 486], ['hero', 292, 578, 520, 164], ['pitches', 824, 578, 324, 164], ['ref', 1160, 80, 264, 430], ['log', 1160, 522, 264, 220], ['trail', 16, 754, 1408, 66], ['bar', 0, 832, 1440, 68]],
  }

  // ---- The game, as a reader steps it ----------------------------------------------------------
  const play = (ab) => D.plays.find((p) => p.ab === ab)
  const TYPE = { FF: 'Four-seam', SI: 'Sinker', CH: 'Changeup', CU: 'Curveball', SL: 'Slider', ST: 'Sweeper', FC: 'Cutter', FS: 'Splitter', KC: 'Knuckle curve' }
  const callOf = (c) => ('XDE'.includes(c) ? 'x' : 'B*IPV'.includes(c[0]) ? 'b' : 's')
  const TOP2 = R2.halves.top2.rows, BOT9 = R2.halves.bot9.rows, BOT6 = R2.halves.bot6.rows
  const rowOf = (ab) => [...TOP2, ...BOT6, ...BOT9].find((r) => r.ab === ab)
  const LEGS = { '1B': 1, BB: 1, '2B': 2, '3B': 3, HR: 4, FC: 1 }
  // A row as the scorebook box draws it. `legs` is as of the reader's cursor, not the end of the half.
  function boxOf(ab, legs) {
    const r = rowOf(ab), p = play(ab)
    const pitches = p ? p.pitches.filter((x) => x.n).map((x) => ({ n: x.n, c: x.code, ty: x.type, mph: Math.round(x.mph) }))
      : r.pitches.map((c, i) => ({ n: i + 1, c }))
    return { ab, code: r.code, rbi: r.rbi, out: r.out, pitches, legs: legs ?? (r.out ? 0 : LEGS[r.code] ?? 0), scored: legs === 4,
      name: `${r.first} ${r.last}`, num: r.num, pos: r.pos, line: p?.line ?? r.line, pitcher: r.pitcher, ball: p?.ball }
  }
  const SEA = R2.lineups.away, BOS = R2.lineups.home
  const slotOf = (lineup, last) => lineup.find((x) => x.name.endsWith(last))
  const ord = (n) => ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'][n]
  const short = (x) => { const parts = x.name.split(' '); return parts.length > 2 && parts[0].includes('.') ? x.name : parts.at(-1) }

  // The line score: cells revealed up to the cursor; the half being played shows its runs so far.
  function lineCells(through, partial) {
    const out = { away: [], home: [] }
    for (const i of R2.innings) {
      const t = 2 * (i.n - 1), b = t + 1
      out.away.push(t < through ? i.away.runs : t === through && partial != null ? partial : '')
      out.home.push(b < through ? i.home.runs : b === through && partial != null ? partial : '')
    }
    return out
  }

  // Four reading positions, all real. Half index: top 1st 0, bottom 1st 1, top 2nd 2.
  const STATES = {
    waiting: { id: 'waiting', half: '▲ 2nd', score: [3, 1], outs: 1, bases: [1, 1, 0], count: '0-0', pc: 29, pitcher: 'Paez',
      last: boxOf(12), sealed: true, next: 13, cur: 2, line: lineCells(2, 2), rhe: { away: [3, 4, 0], home: [1, 1, 0] },
      done: [8, 9, 10, 11, 12], batting: SEA, upFrom: 'Arozarena', stage: { ab: 13, at: 'rest' }, advance: 'Next at-bat' },
    revealed: { id: 'revealed', half: '▲ 2nd', score: [6, 1], outs: 1, bases: [0, 0, 0], count: '2-1', pc: 33, pitcher: 'Paez',
      last: boxOf(13), sealed: false, next: 14, cur: 2, line: lineCells(2, 5), rhe: { away: [6, 5, 0], home: [1, 1, 0] },
      done: [8, 9, 10, 11, 12, 13], batting: SEA, upFrom: 'Canzone', stage: { ab: 13, at: 'end' }, advance: 'Next at-bat' },
    cp: { id: 'cp', half: '▲ 2nd', score: [6, 1], outs: 3, bases: [0, 0, 0], count: '2-2', pc: 39, pitcher: 'Paez',
      last: boxOf(15), sealed: false, next: null, cur: 3, line: lineCells(3, null), rhe: { away: [6, 5, 0], home: [1, 1, 0] },
      done: [8, 9, 10, 11, 12, 13, 14, 15], batting: SEA, upFrom: null, checkpoint: 'top2', advance: 'Bottom 2nd' },
    final: { id: 'final', half: '▼ 9th', score: [9, 6], outs: 3, bases: [0, 0, 0], count: '0-0', pc: 4, pitcher: 'Muñoz',
      last: boxOf(86), sealed: false, next: null, cur: 18, line: lineCells(18, null), rhe: { away: [9, 14, 1], home: [6, 11, 0] },
      done: [82, 83, 84, 85, 86], batting: R2.lineupsFinal.home, upFrom: null, checkpoint: 'bot9', advance: 'Close the book', final: true },
  }
  // Round 2, drop 2: Duran's at-bat in the bottom 6th (atBatIndex 57), the half's third out. Woo has thrown 93.
  // Pitches: *B, (mound visit), S, F, *B, B, (wild pitch: Durbin 2nd to 3rd), X (4-3). Score 9-2, two out.
  const b6 = (o) => ({ half: '▼ 6th', score: [9, 2], outs: 2, bases: [0, 1, 0], pitcher: 'Woo', cur: 11, line: lineCells(11, 1),
    rhe: { away: [9, 12, 1], home: [2, 5, 0] }, done: [53, 54, 55, 56], batting: BOS, upFrom: null, live: 57, advance: 'Next at-bat', ...o })
  Object.assign(STATES, {
    b6pre: b6({ id: 'b6pre', count: '0-0', pc: 93, last: boxOf(56, 2), sealed: true, next: 57, stage: { ab: 57, at: 'rest' }, upFrom: 'Duran' }),
    b6p3: b6({ id: 'b6p3', count: '1-2', pc: 96, sub: 3, last: boxOf(56, 2), sealed: true, next: 57, stage: { ab: 57, at: 'p3' }, upFrom: 'Duran' }),
    b6wp: b6({ id: 'b6wp', count: '3-2', pc: 98, sub: 5, bases: [0, 0, 1], last: boxOf(56, 3), sealed: true, next: 57, stage: { ab: 57, at: 'wp' }, upFrom: 'Duran', event: 'wp' }),
    b6res: b6({ id: 'b6res', count: '3-2', pc: 99, outs: 3, bases: [0, 0, 0], last: boxOf(57), sealed: false, next: null, done: [53, 54, 55, 56, 57], stage: { ab: 57, at: 'end' }, upFrom: null }),
  })

  // Pitch counts and the due-up strip: checked against the feed by tools/extract2.mjs (pc per row).
  function dueUp(st) {
    if (!st.upFrom) return []
    const i = st.batting.findIndex((x) => x.name.endsWith(st.upFrom))
    return [0, 1, 2].map((k) => st.batting[(i + k) % 9])
  }

  // ---- Parts ----------------------------------------------------------------------------------
  const dia = (b, s = 28) => `<svg class="gd-dia" width="${s}" height="${s}" viewBox="0 0 28 28" aria-hidden="true">
    <rect x="16.5" y="10" width="7" height="7" transform="rotate(45 20 13.5)" class="${b[0] ? 'on' : ''}"/>
    <rect x="10.5" y="4" width="7" height="7" transform="rotate(45 14 7.5)" class="${b[1] ? 'on' : ''}"/>
    <rect x="4.5" y="10" width="7" height="7" transform="rotate(45 8 13.5)" class="${b[2] ? 'on' : ''}"/></svg>`
  const outs = (n) => `<span class="gd-outs" aria-label="${n} out">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`

  // The scorebook box. `h` is its height in px; the width follows (1.45 : 1), so it is always copyable.
  function box(b, h, upto = null) {
    if (b && upto != null) {
      const ps = b.pitches.slice(0, upto)
      const col = (hd, xs) => `<div><i>${hd}</i>${xs.map((x) => `<span>${x}</span>`).join('')}</div>`
      return `<div class="gd-box" style="width:${Math.round(h * 1.45)}px;height:${h}px" aria-label="Scorebook box, at-bat in progress">
        <div class="gd-bs">${col('B', ps.filter((p) => callOf(p.c) === 'b').map((p) => p.n))}${col('S', ps.filter((p) => callOf(p.c) !== 'b').map((p) => p.n))}</div>
        <div class="gd-dbox"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 36 L36 20 L20 4 L4 20 Z" class="dia"/></svg><span class="code gd-tape">Sealed</span></div></div>`
    }
    if (!b) return `<div class="gd-box is-sealed" style="width:${Math.round(h * 1.45)}px;height:${h}px"><span>Sealed</span></div>`
    const balls = b.pitches.filter((p) => callOf(p.c) === 'b').map((p) => p.n)
    const strikes = b.pitches.filter((p) => callOf(p.c) !== 'b').map((p) => (callOf(p.c) === 'x' ? '<b>X</b>' : p.n))
    const col = (hd, xs) => `<div><i>${hd}</i>${xs.map((x) => `<span>${x}</span>`).join('')}</div>`
    const L = b.legs, seg = ['M20 36 L36 20', 'M36 20 L20 4', 'M20 4 L4 20', 'M4 20 L20 36']
    const svg = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 36 L36 20 L20 4 L4 20 Z" class="dia"/>${L >= 4 ? '<path d="M20 36 L36 20 L20 4 L4 20 Z" class="run"/>' : ''}${seg.slice(0, L).map((d) => `<path d="${d}" class="leg"/>`).join('')}</svg>`
    return `<div class="gd-box" style="width:${Math.round(h * 1.45)}px;height:${h}px" aria-label="Scorebook box: ${esc(b.code)}">
      <div class="gd-bs">${col('B', balls)}${col('S', strikes)}</div>
      <div class="gd-dbox">${svg}${b.out ? `<span class="outn">${b.out}</span>` : ''}<span class="code">${esc(b.code)}</span>${b.rbi ? `<span class="rbi">${b.rbi} RBI</span>` : ''}</div></div>`
  }

  const PART = {
    band(w, h, st) {
      const big = w > 500
      return `<div class="gd-band ${big ? 'is-big' : ''}">
        <div class="gd-score"><div><b>SEA</b><em>${st.score[0]}</em></div><div><b>BOS</b><em>${st.score[1]}</em></div></div>
        <div class="gd-half">${esc(st.half)}</div>
        <div class="gd-state">${dia(st.bases, big ? 32 : 28)}<span class="gd-countw"><span class="gd-count">${st.count}</span></span>${outs(st.outs)}<span class="gd-pc">${esc(st.pitcher)}<br>P ${st.pc}</span></div></div>`
    },
    nav(w, h, st) {
      const head = ['', 1, 2, 3, 4, 5, 6, 7, 8, 9, 'R', 'H', 'E']
      const row = (side, name) => {
        const cells = st.line[side].map((v, i) => {
          const idx = 2 * i + (side === 'home' ? 1 : 0)
          return `<td class="${idx === st.cur && !st.checkpoint ? 'cur' : ''}${st.final && i === 8 ? ' dbl' : ''}">${v}</td>`
        }).join('')
        const r = st.rhe[side]
        return `<tr><td>${name}</td>${cells}<td class="tot">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`
      }
      return `<div class="gd-nav"><table aria-label="Line score"><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr>${row('away', 'SEA')}${row('home', 'BOS')}</table></div>`
    },
    stage(w, h, st, sc) {
      if (sc.cpLayer) return sc.cpLayer(w, h)
      return `<div class="gd-stage"><canvas data-stage="${st.stage.ab}:${st.stage.at}"${sc.zones ? ' data-zones="1"' : ''}></canvas>${sc.stageTag && !st.sealed && st.last.pitches.length ? tag(st, w, h) : ''}${sc.zones ? zoneCard(w, h, sc) : ''}${st.event && sc.eventCard ? sc.eventCard(w, h, st) : ''}</div>`
    },
    hero(w, h, st, sc) {
      if (st.sub != null || (st.live && st.sealed && sc.liveBox)) return liveHero(w, h, st, sc)
      const b = st.last, roomy = w > 420, bh = Math.min(h - 24, sc.size === 'P' ? 140 : roomy ? 128 : 110)
      const r = rowOf(b.ab), slot = slotOf(st.batting, r.last) || slotOf(SEA, r.last) || slotOf(BOS, r.last)
      const due = dueUp(st)
      const contact = b.ball ? `${Math.round(b.ball.ev)} mph · ${b.ball.la}°${b.ball.traj === 'ground_ball' ? '' : ` · ${b.ball.dist} ft`}` : ''
      const lastLbl = st.sealed ? '<span class="lbl">Last result</span>' : st.checkpoint ? '<span class="lbl">Third out</span>' : ''
      return `<div class="gd-hero">
        <div class="gd-hero__top">${box(b, bh)}
          <div class="gd-hero__txt">${lastLbl}<div class="gd-who">#${b.num} ${esc(b.name)}<small>${esc(b.pos)}${slot ? ` · ${ord(slot.slot)}` : ''} · vs ${esc(b.pitcher)}</small></div>
          <p class="gd-line">${esc(b.line)}</p>${contact && !st.sealed && sc.size !== 'T' ? `<div class="gd-contact">${contact}</div>` : ''}</div></div>
        ${due.length ? `<div class="gd-due"><span class="lbl">${st.sealed ? 'Up' : 'Next'}</span>${due.map((u, i) => `<span class="${i === 0 ? 'now' : ''}">${ord(u.slot)} · #${u.num} ${esc(short(u))}</span>`).join('')}</div>` : ''}
</div>`
    },
    bar(w, h, st, sc) {
      const pxp = sc.pxp ?? false
      const words = st.checkpoint ? st.advance : sc.words === 'next' ? 'Next' : sc.words === 'mode' ? (pxp ? 'Next pitch' : 'Next play') : sc.words === 'play' ? 'Play' : st.advance
      const ctl = sc.pxpStyle === 'switch'
        ? `<span class="gd-switch" role="group" aria-label="Step by"><span class="${pxp ? '' : 'on'}">At-bat</span><span class="${pxp ? 'on' : ''}">Pitch</span></span>`
        : `<span class="gd-btn toggle" aria-pressed="${pxp}">Pitch by<br>pitch${pxp ? '<small>On</small>' : ''}</span>`
      return `<div class="gd-bar"><span class="gd-btn door" aria-label="Menu"><span class="gd-burger"><i></i><i></i><i></i></span>${w > 500 ? 'Menu' : ''}</span>
        ${ctl}<span class="gd-btn advance">${esc(words)}<b>›</b></span></div>`
    },
    pitches(w, h, st) {
      const b = st.last
      return `<div class="card"><span class="lbl">Pitches · ${esc(b.name.split(' ').at(-1))}</span><div class="gd-plist">${b.pitches.map((p) => `<div><span class="gd-pip ${callOf(p.c)}">${callOf(p.c) === 'x' ? 'X' : p.n}</span><span>${esc(TYPE[p.ty] || p.ty || '')}</span><span class="num">${p.mph ? p.mph + ' mph' : ''}</span></div>`).join('')}</div>
        ${b.ball && !st.sealed ? `<span class="lbl">Contact</span><span class="gd-contact">${Math.round(b.ball.ev)} mph · ${b.ball.la}° · ${b.ball.traj.replace('_', ' ')}</span>` : ''}</div>`
    },
    trail(w, h, st) {
      const n = Math.max(4, Math.floor(w / 96))
      const chips = st.done.map((ab) => { const r = rowOf(ab); return `<span class="gd-chip ${ab === st.last.ab ? 'cur' : ''}"><b>${esc(r.code)}</b>${esc(r.last)}</span>` })
      if (st.next) chips.push(`<span class="gd-chip seal"><b>Sealed</b>${esc(rowOf(st.next).last)}</span>`)
      return `<div class="gd-trail">${chips.slice(-n).join('')}</div>`
    },
    lineup(w, h, st) {
      const nowName = st.sealed ? rowOf(st.next).last : st.upFrom
      const codes = {}
      for (const ab of st.done) { const r = rowOf(ab); (codes[r.last] ||= []).push(r.code) }
      const side = st.batting === SEA ? 'Seattle' : 'Boston'
      return `<div class="card"><span class="lbl">${side} · batting</span><div class="gd-rows">${st.batting.map((x) => `<div class="${nowName && x.name.endsWith(nowName) ? 'now' : ''}"><em>${x.slot}</em><span>#${x.num} ${esc(short(x))} <em>${x.pos}</em></span><em>${(codes[x.name.split(' ').at(-1)] || []).join(' ')}</em></div>`).join('')}</div>
        <span class="lbl" style="margin-top:auto">${side === 'Seattle' ? 'Boston' : 'Seattle'} · in the field</span><span class="gd-note">In the menu at this size</span></div>`
    },
    // The Field tab: the park and the defense by name, as today's lineup page draws it (Gary, round 2
    // comment). Surnames at each spot; the pitcher is the one on the mound at this point; DH under it.
    ref(w, h, st) {
      const F = window.GD_FIELD, fieldSide = st.batting === SEA ? BOS : st.batting === R2.lineupsFinal.home ? R2.lineupsFinal.away : SEA
      const by = {}
      for (const x of fieldSide) by[x.pos] = x.name.split(' ').at(-1)
      by.P = st.pitcher.normalize('NFC')
      const club = fieldSide === BOS ? 'Boston' : 'Seattle'
      return `<div class="card"><div class="gd-tabs"><span>Arms</span><span class="on">Field</span><span>Extras</span></div>
        <span class="lbl">${club} · defensive alignment</span>
        <div class="gd-park" style="aspect-ratio:${F.aspect}">${F.svg}${Object.entries(F.spots).map(([pos, [l, t]]) => `<span class="gd-park__node" style="left:${l}%;top:${t}%">${esc(by[pos] ?? '—')}</span>`).join('')}</div>
        ${by.DH ? `<span class="gd-note"><b>DH</b> ${esc(by.DH)}</span>` : ''}</div>`
    },
    log(w, h, st) {
      return `<div class="card"><span class="lbl">This half</span><div class="gd-log">${st.done.map((ab) => `<p>${esc(play(ab)?.line ?? rowOf(ab).line)}</p>`).join('')}</div></div>`
    },
  }
  // The hero while an at-bat is open in pitch mode (or stopped at an event): the batter's own box fills pitch by
  // pitch; its diamond and code stay under tape until the result tap (ADR-0123 decision 2). Same height as ever.
  function liveHero(w, h, st, sc) {
    const b = boxOf(st.live), r = rowOf(st.live), bh = Math.min(h - 24, sc.size === 'P' ? 140 : w > 420 ? 128 : 110)
    const due = dueUp({ ...st, upFrom: r.last }).slice(1)
    return `<div class="gd-hero"><div class="gd-hero__top">${box(b, bh, st.sub ?? 0)}
      <div class="gd-hero__txt"><span class="lbl">At bat</span><div class="gd-who">#${b.num} ${esc(b.name)}<small>${esc(b.pos)} · 7th · vs ${esc(b.pitcher)}</small></div>
      <p class="gd-line">${st.sub ? `Pitch ${st.sub}: ${esc(TYPE[b.pitches[st.sub - 1].ty])} ${b.pitches[st.sub - 1].mph}` : ''}</p></div></div>
      <div class="gd-due"><span class="lbl">On deck</span>${due.map((u) => `<span>${ord(u.slot)} · #${u.num} ${esc(short(u))}</span>`).join('')}</div></div>`
  }
  // The zone map's numbers, crisp, in the stage's corner (the tint is drawn into the pixel zone).
  function zoneCard(w, h, sc) {
    const Z = window.GD_ZONES, stat = sc.zoneStat || 'avg', big = w > 500
    const cells = Array.from({ length: 9 }, (_, i) => Z[stat][String(i + 1).padStart(2, '0')])
    return `<div class="gd-zcard ${big ? 'is-big' : ''}"><span class="gd-zcard__h">${esc(Z.name.split(' ').at(-1))} · ${stat === 'avg' ? 'AVG' : 'SLG'} by zone</span>
      <div class="gd-zgrid">${cells.map((c) => `<span class="t-${c.temp}">${c.v}</span>`).join('')}</div><span class="gd-zcard__f">Season to Aug 31</span></div>`
  }
  function tag(st, w, h) {
    const x = st.last.pitches.at(-1)
    return `<span class="gd-pitchtag" style="left:${Math.round(w * 0.52 + 16)}px;top:${Math.round(h * 0.62)}px">${x.mph} ${esc(TYPE[x.ty] || '')}</span>`
  }

  // ---- A whole frame ---------------------------------------------------------------------------
  // scene: { size, state, palette: 'stage'|'paper', labels, pxp, cpLayer(w,h), overlay(f) }
  function frame(scene) {
    const f = SIZES.find((s) => s.id === scene.size), st = STATES[scene.state]
    const parts = BOXES[scene.size].map(([part, x, y, w, h]) => `<div class="gd-part" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${PART[part](w, h, st, scene)}${scene.labels ? `<span class="gd-partname">${part === 'nav' ? 'navigator' : part === 'ref' ? 'reference' : part}</span>` : ''}</div>`).join('')
    return `<div class="gd pal-${scene.palette || 'stage'}" style="width:${f.w}px;height:${f.h}px">${parts}${scene.overlay ? scene.overlay(f, st) : ''}</div>`
  }
  const boxOfPart = (size, part) => BOXES[size].find((b) => b[0] === part)

  window.GDR = { SIZES, BOXES, STATES, frame, box, boxOf, rowOf, play, esc, callOf, TYPE, boxOfPart, short, ord, SEA, BOS }
})()
