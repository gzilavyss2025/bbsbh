/* One-screen at-bat console (mockup, round 3). A layer over the handoff canvas
   (template.html) like stage.js. Everything fits 390 x 763 (an iPhone in
   standalone mode, less the status bar and home indicator) with no scrolling.
   The stage is the Now Pitching scene (PitchScene.jsx, lib/pitcherCard/scene.js)
   in its at-bat look: sky, grass, mound, plate dirt, batter's boxes, plate, the
   zone box, and each pitch along its measured flight with a trail. The data is
   built by the app's own atBatScenePitches (stage/enrich.mjs). Pitch labels are
   sequence numbers and X (rule 3). No bat is drawn (Gary, round 2).
   #o1 = stage first, #o2 = the #22 box first. Only v.cur (revealed) is drawn. */
const LAYOUT = (location.hash.match(/o[12]/) || ['o1'])[0];
// Gary (round 3): faster than the card's x3, and the deciding pitch first.
// x1.5 slow motion with a 0.35 s hold; a 1.2 s rest before the at-bat repeats.
const SEG = 40, SLOWF = 1.5, HOLDS = 0.35, LOOP_REST = 1.2;
const f1 = (n) => n.toFixed(1);
const ptsAttr = (a) => a.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');

// The timeline: first the deciding (last) pitch flies in over the earlier ones'
// rings, then the whole at-bat plays in order and repeats.
function sceneFrameJs(pitches, el) {
  const slot = Math.max(...pitches.map((p) => p.T)) * SLOWF + HOLDS;
  const n = pitches.length, last = n - 1;
  if (el < slot) return { idx: last, progress: Math.min(1, el / (pitches[last].T * SLOWF)), slot, lead: true };
  const period = n * slot + LOOP_REST, u = (el - slot) % period;
  if (u >= n * slot) return { idx: last, progress: 1, slot, rest: true };
  const idx = Math.floor(u / slot);
  return { idx, progress: Math.min(1, (u % slot) / (pitches[idx].T * SLOWF)), slot };
}

function sceneSvg(v, a) {
  const st = (a && a.scene && a.scene.stage) || (v.next && null);
  const S0 = st || DEFAULT_STAGE;
  const fr = S0.front, bk = S0.back;
  const edges = [[fr.x, fr.y, bk.x, bk.y], [fr.x + fr.w, fr.y, bk.x + bk.w, bk.y], [fr.x, fr.y + fr.h, bk.x, bk.y + bk.h], [fr.x + fr.w, fr.y + fr.h, bk.x + bk.w, bk.y + bk.h]];
  const grid = [[fr.x + fr.w / 3, fr.y, fr.x + fr.w / 3, fr.y + fr.h], [fr.x + 2 * fr.w / 3, fr.y, fr.x + 2 * fr.w / 3, fr.y + fr.h], [fr.x, fr.y + fr.h / 3, fr.x + fr.w, fr.y + fr.h / 3], [fr.x, fr.y + 2 * fr.h / 3, fr.x + fr.w, fr.y + 2 * fr.h / 3]];
  const ground = `<rect class="ps-sky" x="-300" y="-10" width="936" height="340"/><rect class="ps-grass" x="-300" y="${f1(S0.horizon)}" width="936" height="340"/>
    <ellipse class="ps-mound" cx="168" cy="${f1(S0.mound.y)}" rx="${f1(S0.mound.rx)}" ry="4"/>
    <polygon class="ps-dirt" points="${ptsAttr(S0.dirt)}"/>${S0.boxes.map((b) => `<polygon class="ps-chalk" points="${ptsAttr(b)}"/>`).join('')}
    <polygon class="ps-plate" points="${ptsAttr(S0.plate)}"/>${S0.drops.map(([p, q]) => `<line class="ps-drop" x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}"/>`).join('')}
    <rect class="ps-back" x="${f1(bk.x)}" y="${f1(bk.y)}" width="${f1(bk.w)}" height="${f1(bk.h)}"/>${edges.map(([x1, y1, x2, y2]) => `<line class="ps-edge" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`).join('')}
    <rect class="ps-front" x="${f1(fr.x)}" y="${f1(fr.y)}" width="${f1(fr.w)}" height="${f1(fr.h)}"/>${grid.map(([x1, y1, x2, y2]) => `<line class="ps-grid" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`).join('')}`;
  if (!a || !a.scene || !a.scene.pitches.length) return `<svg class="pscn" viewBox="0 8 336 294" preserveAspectRatio="xMidYMax meet">${ground}</svg>`;
  const P = a.scene.pitches;
  const ghosts = P.map((p, j) => { const e = p.pts[p.pts.length - 1]; const lab = j === P.length - 1 && a.flight ? 'X' : String(p.no); return `<g class="ps-ghost" data-j="${j}" visibility="hidden"><polyline class="st-${p.family}" points="${p.pts.map((q) => `${q[0]},${q[1]}`).join(' ')}"/><circle class="ps-ring st-${p.family}" cx="${e[0]}" cy="${e[1]}" r="${f1(e[2] / 2 + 3)}"/><text class="ps-no" x="${e[0]}" y="${f1(e[1] + 3)}" text-anchor="middle">${lab}</text></g>`; }).join('');
  const segs = Array.from({ length: SEG }, () => '<line visibility="hidden"/>').join('');
  return `<svg class="pscn" viewBox="0 8 336 294" preserveAspectRatio="xMidYMax meet">${ground}${ghosts}<g class="ps-trail">${segs}</g><circle class="ps-rel" cx="${f1(a.scene.release[0])}" cy="${f1(a.scene.release[1])}" r="2"/><circle class="ps-ball" r="0"/></svg>`;
}

function fieldInset(v, a) {
  if (!a.flight) return '';
  return `<div class="osfield">${fieldSvg(v, a, 0).replace(/style="--t:[^"]*"/g, '')}</div>`;
}

function osStage(v) {
  const a = v.cur;
  const bar = a && a.scene && a.scene.pitches.length
    ? `<div class="osbar"><span data-bn></span><span data-bm></span><span data-bs></span><span data-bc></span></div>`
    : `<div class="osbar osbar--seal"><span>${a ? 'No pitch tracking' : 'Sealed'}</span></div>`;
  const notice = notices(v);
  return `<div class="osstage ${a ? '' : 'is-sealed'}" data-osstage>${sceneSvg(v, a)}${a ? fieldInset(v, a) : ''}${notice ? `<div class="osnotice">${notice}</div>` : ''}${a ? '<button type="button" class="osreplay" data-osreplay>Replay</button>' : ''}${bar}</div>`;
}

function osUnder(v) {
  const a = v.cur;
  let line = '';
  if (a) {
    const ev = a.mid.flatMap((m) => m.moves.map((x) => `<b class="${x.out ? 'no' : ''}">${esc(x.code.split(' ')[0])}</b> ${esc(x.last)}`));
    const abs = a.track.filter((p) => p.ch).map((p) => `ABS ${p.ch.outcome === 'success' ? 'overturned' : 'stands'}`);
    const h = a.hit, t = { p: a.track.length, wh: a.track.filter((p) => p.cat === 'whiff').length, fo: a.track.filter((p) => p.cat === 'foul').length };
    const bats = a.track.map((p) => p.bat).filter(Boolean);
    line = [`<b>${t.p}</b> P · <b>${t.wh}</b> WH · <b>${t.fo}</b> FO`, h && h.ev != null ? `<b>${h.ev}</b> mph${h.dist ? ` · <b>${h.dist}</b> ft` : ''}` : '', bats.length ? `top bat <b>${Math.max(...bats).toFixed(0)}</b> mph` : '', ...ev, ...abs].filter(Boolean).join(' · ');
  }
  return `<div class="osunder">${runnersChip(v)}<div class="osline num">${line}</div></div>`;
}

// The batter is named once; the pitcher's line folds onto one row.
heroWho = function (v, a, sealed) {
  const L = dayLines(v);
  const pc = sealed ? a.pitcher.pcBefore : a.pitcher.pcAfter;
  return `<div class="hero__who"><div class="hero__name">${img(a.batter.id)}<div><b>${esc(a.batter.last)}</b><span>${[slotWord(a.batter.slot), esc(a.batter.pos), a.batter.jersey ? '#' + esc(a.batter.jersey) : ''].filter(Boolean).join(' · ')}</span></div></div>
    <div class="hero__line"><span>Today</span>${esc(batLine(L, a.batter.id))}</div>
    <div class="oswho"><b>vs ${esc(a.pitcher.last)}</b> #${esc(a.pitcher.jersey)} · ${a.pitcher.hand}HP<br><span class="num">${esc(pitLine(L, a.pitcher.id, pc))}</span></div></div>`;
};

harmonized = function (v) {
  const parts = LAYOUT === 'o1'
    ? [band(v), osStage(v), hero(v), osUnder(v), trail(v)]
    : [band(v), trail(v), hero(v), osStage(v), osUnder(v)];
  return `<div class="phone os os--${LAYOUT}"><div class="screen">${appHead(v)}<div class="osbody">${parts.join('')}${linescore(v)}</div>${sheet(v)}${bar(v)}</div></div>`;
};

// The animation: the same frame rule as PitchScene (sceneFrame, slow x3, play
// the at-bat once and rest), drawn through attributes per frame.
let osRaf = 0;
function osPlay(at) {
  cancelAnimationFrame(osRaf);
  const v = viewOf(), a = v.cur;
  const root = document.querySelector('[data-osstage]');
  if (!a || !a.scene || !a.scene.pitches.length || !root) return;
  const P = a.scene.pitches;
  const ghosts = [...root.querySelectorAll('.ps-ghost')], segs = [...root.querySelectorAll('.ps-trail line')], ball = root.querySelector('.ps-ball');
  const fld = root.querySelector('.osfield');
  const set = (sel, t) => { const n = root.querySelector(sel); if (n) n.textContent = t; };
  const draw = (el) => {
    const { idx, progress, slot, rest: done } = sceneFrameJs(P, el);
    const p = P[idx];
    ghosts.forEach((g, j) => g.setAttribute('visibility', j < idx || (j === idx && (done || progress >= 1)) ? 'visible' : 'hidden'));
    const lab = idx === P.length - 1 && a.flight ? 'X' : p.no;
    set('[data-bn]', `${lab} · ${p.name.replace(/^\d+ · /, '')}`); set('[data-bm]', `${p.mph} mph`); set('[data-bs]', `Pitch ${p.no} of ${P.length}`); set('[data-bc]', p.call || '');
    const m = progress * SEG, whole = Math.floor(m), pts = p.pts;
    let cur = pts[SEG];
    if (whole < SEG) { const t = m - whole, q0 = pts[whole], q1 = pts[whole + 1]; cur = [q0[0] + (q1[0] - q0[0]) * t, q0[1] + (q1[1] - q0[1]) * t, q0[2] + (q1[2] - q0[2]) * t]; }
    segs.forEach((s, i) => {
      if (done || i > whole || (i === whole && whole >= SEG)) { s.setAttribute('visibility', 'hidden'); return; }
      const q0 = pts[i], q1 = i < whole ? pts[i + 1] : cur;
      s.setAttribute('visibility', 'visible'); s.setAttribute('class', `st-${p.family}`);
      s.setAttribute('x1', f1(q0[0])); s.setAttribute('y1', f1(q0[1])); s.setAttribute('x2', f1(q1[0])); s.setAttribute('y2', f1(q1[1]));
      s.setAttribute('stroke-width', (q1[2] * 0.62).toFixed(2)); s.setAttribute('opacity', i < whole ? (0.25 + 0.6 * (i / SEG)).toFixed(2) : '0.85');
    });
    ball.setAttribute('cx', f1(cur[0])); ball.setAttribute('cy', f1(cur[1])); ball.setAttribute('r', done ? 0 : (cur[2] / 2).toFixed(2));
    // On contact (the last pitch lands, in play): the field comes up in the corner
    // and the flight draws to where the ball came down.
    if (fld) { const tc = P[P.length - 1].T * SLOWF; const k = Math.max(0, Math.min(1, (el - tc) / 1.0)); fld.style.opacity = Math.min(1, k * 3); fld.style.setProperty('--k', k); }
    return false;
  };
  if (at != null) { draw(at); return; }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(1e6); return; }
  let t0 = null;
  const tick = (ts) => { t0 ??= ts; if (!draw((ts - t0) / 1000)) osRaf = requestAnimationFrame(tick); };
  osRaf = requestAnimationFrame(tick);
}
window.osPlay = osPlay;
let DEFAULT_STAGE = null;
for (const g of D.games) for (const h of g.halves) for (const s of h.steps) if (!DEFAULT_STAGE && s.scene) DEFAULT_STAGE = s.scene.stage;
const _render = render;
render = function () { _render(); osPlay(); };
document.getElementById('phones').addEventListener('click', (e) => { if (e.target.closest('[data-osreplay]')) osPlay(); });
render();
