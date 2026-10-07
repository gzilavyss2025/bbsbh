/* Animated at-bat stage: a mockup layer over the handoff canvas (template.html).
   It replaces the pitch track, the play sentence and the bases strip with one
   stage: pitches fly into the zone in order, the bat swings on every swing, and
   a ball in play flies to where it landed. The runners fold into a chip that
   opens a sheet. Three layouts: #v1 zone then field, #v2 side by side, #v3 the
   field with the zone at the plate. Only the revealed at-bat (v.cur) is drawn. */
const STAGE_V = (location.hash.match(/v[123]/) || ['v1'])[0];
const STEP = 560, FLY = 950;
const BASE_IX = { 1: 0, 2: 1, 3: 2 };

function zoneSvg(a, { w = 190, h = 238, bat = true } = {}) {
  const PAD = 6, DXr = [-1.55, 1.55], DZr = [0.4, 4.6];
  const X = (px) => PAD + ((-px - DXr[0]) / (DXr[1] - DXr[0])) * (w - 2 * PAD);
  const Y = (pz) => PAD + ((DZr[1] - pz) / (DZr[1] - DZr[0])) * (h - 2 * PAD);
  const pts = a ? a.track.filter((p) => p.px != null) : [];
  const med = (k) => { const xs = pts.map((p) => p[k]).filter((x) => x != null).sort((m, n) => m - n); return xs.length ? xs[xs.length >> 1] : (k === 'top' ? 3.4 : 1.6); };
  const E = 0.708, x0 = X(E), x1 = X(-E), y0 = Y(med('top')), y1 = Y(med('bot'));
  const grid = [1, 2].map((k) => `<line x1="${x0 + (x1 - x0) * k / 3}" y1="${y0}" x2="${x0 + (x1 - x0) * k / 3}" y2="${y1}"/><line x1="${x0}" y1="${y0 + (y1 - y0) * k / 3}" x2="${x1}" y2="${y0 + (y1 - y0) * k / 3}"/>`).join('');
  // Broadcast camera (behind the pitcher): a right-handed batter stands on the left.
  const lefty = a && a.batSide === 'L';
  const dots = !a ? '' : a.track.map((p, i) => {
    if (p.px == null) return '';
    const cx = X(p.px), cy = Y(p.pz), t = i * STEP;
    const swing = bat && /whiff|foul|inplay/.test(p.cat);
    // Savant bat speed (mph) sets how fast the bat comes through: 70 mph = 0.42 s.
    // swing_path_tilt (CSV, finished games only) sets the bat's angle through the
    // ball; without it, 30°. Barrel end dips toward the plate (inference: the
    // broadcast view of a tilted swing plane).
    const dur = p.bat ? Math.round(420 * 70 / p.bat) : 420;
    const tilt = p.swing ? p.swing.tilt : 30, rad = tilt * Math.PI / 180, sx = lefty ? -1 : 1;
    const pivX = cx - sx * 80 * Math.cos(rad), pivY = cy - 80 * Math.sin(rad);
    const batEl = swing ? `<g class="bat" style="--t:${t + 330}ms;--d:${dur}ms;--a:${sx * tilt}deg;--from:${sx * -135}deg;--past:${sx * 25}deg;transform-origin:${pivX.toFixed(1)}px ${pivY.toFixed(1)}px"><line x1="${pivX.toFixed(1)}" y1="${pivY.toFixed(1)}" x2="${(pivX + sx * 118).toFixed(1)}" y2="${pivY.toFixed(1)}"/></g>${p.bat ? `<text class="batmph" x="${w / 2}" y="${h - 22}" text-anchor="middle" style="--t:${t + 330}ms">${Math.round(p.bat)} mph swing</text>` : ''}` : '';
    const ring = p.ch ? `<circle r="12" cx="${cx}" cy="${cy}" class="${p.ch.outcome === 'success' ? 'ring-ok' : 'ring-no'}"/>` : '';
    return `${batEl}<g class="pdot ${p.side === 'strike' ? 'is-strike' : ''} ${p.label === 'X' ? 'is-x' : ''}" style="--t:${t}ms;--dx:${(w / 2 - cx).toFixed(1)}px;--dy:${(h * 0.36 - cy).toFixed(1)}px">${ring}<circle r="9.5" cx="${cx}" cy="${cy}"/><text x="${cx}" y="${cy + 3.6}" text-anchor="middle">${esc(p.label)}</text></g>`;
  }).join('');
  return `<svg class="stz" viewBox="0 0 ${w} ${h}" aria-label="Pitches, broadcast view"><rect class="stz__box" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/><g class="stz__grid">${grid}</g><path class="stz__plate" d="M${X(E)} ${h - 16} L${X(-E)} ${h - 16} L${X(-E)} ${h - 11} L${w / 2} ${h - 5} L${X(E)} ${h - 11} Z"/>${dots}</svg>`;
}

function fieldSvg(v, a, tFly) {
  const F = v.g.field;
  const on = a ? a.runners : v.next ? v.next.sealedRunners : [];
  const runners = on.map((r) => { const b = F.bases[BASE_IX[r.base]]; return b ? `<g class="frun"><circle cx="${b.x}" cy="${b.y}" r="15"/><text x="${b.x}" y="${b.y - 22}" text-anchor="middle">${esc(r.who.last)}</text></g>` : ''; }).join('');
  const fl = a && a.flight;
  const flight = fl ? `<path class="fpath ${fl.grounded ? 'fpath--ground' : ''}" pathLength="1" d="${fl.d}" style="--t:${tFly}ms"/>${fl.hr
    ? `<rect class="fland fland--hr" x="${fl.x - 15}" y="${fl.y - 15}" width="30" height="30" transform="rotate(45 ${fl.x} ${fl.y})" style="--t:${tFly + FLY}ms"/>`
    : `<circle class="fland ${fl.hit ? 'fland--hit' : ''}" cx="${fl.x}" cy="${fl.y}" r="15" style="--t:${tFly + FLY}ms"/>`}` : '';
  return `<svg class="sfield" viewBox="0 50 620 510" preserveAspectRatio="xMidYMax meet" aria-label="Where the ball went">
    <path class="sf-foul" d="${F.foul}"/><path class="sf-grass" d="${F.fair}"/><path class="sf-track" d="${F.track}"/>
    <path class="sf-dirt" d="${F.skin}"/><path class="sf-grass" d="${F.grassDiamond}"/>
    <circle class="sf-dirt" cx="${F.mound.x}" cy="${F.mound.y}" r="${F.moundDirtR}"/><circle class="sf-dirt" cx="${F.home.x}" cy="${F.home.y}" r="${F.homeDirtR}"/>
    <path class="sf-line" d="${F.foulLineL}"/><path class="sf-line" d="${F.foulLineR}"/>
    ${F.fenceSegs.map((s) => `<path class="sf-wall" d="${s.d}"/>`).join('')}
    ${F.bases.map((b) => `<rect class="sf-base" x="${b.x - 7}" y="${b.y - 7}" width="14" height="14" transform="rotate(45 ${b.x} ${b.y})"/>`).join('')}
    ${runners}${flight}</svg>`;
}

function runnersChip(v) {
  const a = v.cur;
  const on = a ? a.runners : v.next ? v.next.sealedRunners : [];
  const gone = a ? a.departed : [];
  const occ = new Set(on.map((r) => r.base));
  const di = `<svg class="mini" viewBox="0 0 40 30" aria-hidden="true">${[[30, 16, 1], [20, 6, 2], [10, 16, 3]].map(([x, y, b]) => `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" transform="rotate(45 ${x} ${y})" class="${occ.has(b) ? 'on' : ''}"/>`).join('')}</svg>`;
  const txt = gone.length ? gone.map((d) => `${esc(d.who.last)} ${d.fate === 'scored' ? 'scored' : 'out at ' + BASE[d.box.outAt]}`).join(' · ') : on.length ? `On ${on.map((r) => BASE[r.base]).sort().join(', ')}` : 'Bases empty';
  return `<button type="button" class="rchip ${gone.length ? 'rchip--mark' : ''}" data-sheet="runners" ${on.length || gone.length ? '' : 'disabled'}>${di}<span>${txt}</span>${on.length || gone.length ? '<b>›</b>' : ''}</button>`;
}

function stageEvents(v, a) {
  const lines = [];
  for (const m of a.mid) lines.push(`<span class="ev"><em>${midLabel(m)}</em>${m.moves.map((x) => `${esc(x.last)} <b class="${x.out ? 'no' : ''}">${esc(x.code)}</b> ${x.out ? `out at ${BASE[x.outBase] || ''}` : `${BASE[x.from] || ''} → ${BASE[x.to] || ''}`}`).join(' · ')}</span>`);
  a.track.forEach((p, i) => { if (p.ch) lines.push(absLine(v, p, i)); });
  const t = { p: a.track.length, wh: a.track.filter((p) => p.cat === 'whiff').length, fo: a.track.filter((p) => p.cat === 'foul').length };
  const h = a.hit;
  const bip = h && h.ev != null ? ` · <b>${h.ev}</b> mph${h.la != null ? ` · <b>${h.la}°</b>` : ''}${h.dist ? ` · <b>${h.dist}</b> ft` : ''}` : '';
  const bats = a.track.map((p) => p.bat).filter(Boolean);
  const hitSw = a.flight ? a.track[a.track.length - 1].swing : null;
  const batLine = bats.length ? `<div class="sbat num">Bat speed · ${bats.map((b) => `<b>${b.toFixed(1)}</b>`).join(' · ')} mph${hitSw ? `<br>Contact swing · <b>${hitSw.len}</b> ft long · <b>${Math.round(hitSw.attack)}°</b> attack angle · <b>${Math.round(hitSw.tilt)}°</b> tilt` : ''}</div>` : '';
  return `${lines.length ? `<div class="sev">${lines.join('')}</div>` : ''}${batLine}<div class="sfoot num"><span><b>${t.p}</b> P · <b>${t.wh}</b> WH · <b>${t.fo}</b> FO${bip}</span><span>Half · ${v.half.p} · ${v.half.wh} · ${v.half.fo}</span></div>`;
}

function stage(v) {
  const a = v.cur;
  const head = `<div class="stage__head"><span>${a ? `${a.track.length} pitch${a.track.length === 1 ? '' : 'es'}` : 'Pitches'}</span>${a ? '<button type="button" class="replay2" data-restage>Replay</button>' : ''}</div>`;
  if (!a) {
    // Sealed: a fixed, empty frame. Nothing about the hidden at-bat shapes it.
    return `<div class="stage stage--${STAGE_V} stage--sealed">${head}<div class="stage__body"></div>${runnersChip(v)}</div>`;
  }
  const n = a.track.length, tContact = Math.max(0, n - 1) * STEP + 420;
  const inPlay = !!a.flight;
  let body;
  if (STAGE_V === 'v1') {
    body = `<div class="s1 ${inPlay ? 's1--play' : ''}" style="--tc:${tContact}ms"><div class="s1__field">${fieldSvg(v, a, tContact + 250)}</div><div class="s1__zone">${zoneSvg(a)}</div></div>`;
  } else if (STAGE_V === 'v2') {
    body = `<div class="s2"><div class="s2__zone">${zoneSvg(a)}</div><div class="s2__field">${fieldSvg(v, a, tContact)}</div></div>`;
  } else {
    body = `<div class="s3"><div class="s3__field">${fieldSvg(v, a, tContact)}</div><div class="s3__zone">${zoneSvg(a, { w: 150, h: 188 })}</div></div>`;
  }
  return `<div class="stage stage--${STAGE_V}" data-stage>${head}<div class="stage__body">${body}</div>${runnersChip(v)}${stageEvents(v, a)}</div>`;
}

const _sheet = sheet;
sheet = function (v) {
  if (S.sheet !== 'runners') return _sheet(v);
  return `<button class="scrim" type="button" data-sheet="close" aria-label="Close"></button><div class="sheet" role="dialog" aria-label="Runners"><div class="sheet__head"><div class="sheet__tabs"><button type="button" aria-pressed="true">Runners</button></div><button class="sheet__close" type="button" data-sheet="close" aria-label="Close">×</button></div><div class="sheet__body">${bases(v)}<p class="sheet__note">Each runner's own #22 box. A runner who scored or was put out on this play shows for this step only.</p></div></div>`;
};
harmonized = function (v) {
  return `<div class="phone"><div class="screen ${S.anim ? 'anim' : ''}">${appHead(v)}<div class="scroll">${band(v)}${notices(v)}${trail(v)}${hero(v)}${stage(v)}${refbar()}${linescore(v)}</div>${sheet(v)}${bar(v)}</div></div>`;
};
document.getElementById('phones').addEventListener('click', (e) => {
  if (!e.target.closest('[data-restage]')) return;
  const s = document.querySelector('[data-stage] .stage__body'); if (s) s.replaceWith(s.cloneNode(true));
});
render();
