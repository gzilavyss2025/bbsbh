// The chosen flow: direction A (Marquee) as the feed, opening into direction D
// (the poster), which is the door into lineups -> innings -> box score.
//
// Exported as one function so build.mjs stays the single entry point and both
// files share ONE set of helpers, colours and slate data — a second copy of
// disp()/mono()/SIGNAL would drift the moment either file was edited.

export function flowArtboards(k) {
  const { T, GAMES, g, SIGNAL, INK, head, tail, disp, mono, ghost, liveDot, sealGlyph,
          masthead, dayrail, logoStrip, marqueeBand, nickSize, liveChip, chestMark,
          colourMark, FEED_ORDER } = k

  /* ------------------------------------------------------------ shared bits */

  // The five doors out of a game — the same set the app's tab row already has.
  const doorRow = (active, away, home) => {
    const doors = [
      { k: 'away', label: away, chip: T[away].p },
      { k: 'home', label: home, chip: T[home].p },
      { k: 'inn', label: 'INNINGS' },
      { k: 'box', label: 'BOX' },
      { k: 'card', label: 'CARD' },
    ]
    return `
      <nav style="display:grid;grid-template-columns:repeat(5, minmax(0, 1fr));background:${INK};border-top:1px solid rgba(255,255,255,.16)">
        ${doors.map((d, i) => `
        <span style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;height:58px;${i ? 'border-left:1px solid rgba(255,255,255,.12);' : ''}">
          ${d.chip ? `<span style="width:18px;height:3px;background:${d.chip}"></span>` : '<span style="width:18px;height:3px;background:rgba(255,255,255,.16)"></span>'}
          <span style="${disp(15, { w: 76, wt: 800 })};color:${d.k === active ? '#fff' : 'rgba(255,255,255,.5)'}">${d.label}</span>
          ${d.k === active ? `<span style="position:absolute;left:0;right:0;bottom:0;height:3px;background:${SIGNAL}"></span>` : ''}
        </span>`).join('')}
      </nav>`
  }

  // The seal, in this language — same promise as the kraft tape.
  const sealSlab = (title, sub, h = 232) => `
    <div style="position:relative;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;background:#101216;border:1px solid rgba(233,218,0,.34);overflow:hidden">
      <span class="hatch"></span>
      <span style="position:relative">${sealGlyph(SIGNAL, 30)}</span>
      <span style="position:relative;${disp(27, { w: 74, wt: 900 })};color:${SIGNAL}">${title}</span>
      <span style="position:relative;${mono(8.5, { ls: '0.18em', color: 'rgba(255,255,255,.66)' })};text-align:center;max-width:250px;line-height:1.7">${sub}</span>
    </div>`

  // Nine innings, two halves each: filled where you have broken the seal.
  const cell = (on) =>
    `<span style="height:12px;background:${on ? SIGNAL : 'transparent'};` +
    `border:1px solid ${on ? SIGNAL : 'rgba(255,255,255,.42)'}"></span>`
  const revealRail = (revealed) => `
    <div style="display:flex;align-items:flex-end;gap:4px">
${Array.from({ length: 9 }, (_, i) => `
      <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0">
        ${cell(i * 2 < revealed)}
        ${cell(i * 2 + 1 < revealed)}
        <span style="${mono(7.5, { ls: '0.04em', color: 'rgba(255,255,255,.6)' })};text-align:center;margin-top:4px">${i + 1}</span>
      </div>`).join('')}
    </div>`

  const gameHeader = (away, home, label) => `
    <header style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px 14px;background:${INK};border-bottom:1px solid rgba(255,255,255,.12)">
      <span style="display:flex;align-items:center;gap:11px">
        <span style="${mono(15, { wt: 400, ls: '0', color: 'rgba(255,255,255,.66)' })}">&#8249;</span>
        <span style="${disp(20, { w: 68, wt: 900 })};color:#fff">${away}</span>
        <span style="${mono(10, { ls: '0.1em', color: 'rgba(255,255,255,.62)' })}">AT</span>
        <span style="${disp(20, { w: 68, wt: 900 })};color:#fff">${home}</span>
      </span>
      <span style="display:flex;align-items:center;gap:6px;flex:none">${liveDot(SIGNAL, 5)}<span style="${mono(8.5, { wt: 700, ls: '0.18em', color: SIGNAL })}">${label}</span></span>
    </header>`

  // A headshot in the app's own frame: the MLB silo cutout, cropped 3:4 from
  // the top, on a faint well — Headshot.jsx's shape at this palette.
  const shot = (file, w, h) => `
    <span style="width:${w}px;height:${h}px;flex:none;display:block;overflow:hidden;` +
      `background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)">` +
      `<img src="${file}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:50% 8%;display:block" />` +
    `</span>`

  const fold = `
  <div style="position:absolute;left:0;right:0;top:844px;height:0;pointer-events:none;z-index:9">
    <div style="border-top:1px dashed rgba(255,255,255,.5)"></div>
    <span style="position:absolute;right:8px;top:5px;${mono(9, { wt: 700, ls: '0.18em', color: 'rgba(255,255,255,.6)' })}">FOLD &#183; IPHONE 14 PRO</span>
  </div>`

  const sectionLabel = (label, right = '') => `
    <div style="display:flex;align-items:center;gap:12px;padding:18px 0 11px">
      <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">${label}</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
      ${right ? `<span style="${mono(8, { ls: '0.14em', color: 'rgba(255,255,255,.6)' })}">${right}</span>` : ''}
    </div>`

  /* -------------------------------------------- PLAY DIAMOND, with notations
     PlayDiamond.jsx redrawn at this palette: HOME (50,80) → FIRST (80,50) →
     SECOND (50,20) → THIRD (20,50); ghost outline, inked legs, a filled
     diamond for a run scored, and the scorer's advance codes at the bases —
     1B at first, 2B&#179; at home (advanced by the 3-hitter), F8 in the
     middle for a fly out. */
  const pdPts = { home: [50, 80], first: [80, 50], second: [50, 20], third: [20, 50] }
  const pdLegPath = (n) => {
    const order = ['home', 'first', 'second', 'third', 'home']
    let d = ''
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pdPts[order[i]]
      const [x2, y2] = pdPts[order[i + 1]]
      d += `M${x1} ${y1}L${x2} ${y2}`
    }
    return d
  }
  const playDiamond = (size, { scored = false, legs = 0, notes = {}, center = null } = {}) => {
    const poly = '50,80 80,50 50,20 20,50'
    const lbl = {
      first: 'left:100%;top:50%;transform:translate(2px,-50%)',
      second: 'left:50%;bottom:100%;transform:translate(-50%,-1px)',
      third: 'right:100%;top:50%;transform:translate(-2px,-50%)',
      home: 'left:50%;top:100%;transform:translate(-50%,1px)',
    }
    return `
      <span style="position:relative;width:${size}px;height:${size}px;flex:none;display:block">
        <svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true" style="display:block;overflow:visible">
          <polygon points="${poly}" fill="${scored ? 'rgba(233,218,0,.92)' : 'none'}" stroke="${scored ? SIGNAL : 'rgba(255,255,255,.34)'}" stroke-width="2"/>
          ${!scored && legs ? `<path d="${pdLegPath(legs)}" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>` : ''}
        </svg>
        ${center ? `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);${mono(10, { wt: 700, ls: '0.02em', color: 'rgba(255,255,255,.85)' })}">${center}</span>` : ''}
        ${Object.entries(notes).map(([base, code]) => `
        <span style="position:absolute;${lbl[base]};${mono(10, { wt: 700, ls: '0.02em', color: base === 'home' && scored ? SIGNAL : 'rgba(255,255,255,.8)' })};white-space:nowrap">${code}</span>`).join('')}
      </span>`
  }

  /* ---------------------------------------------- DEFENSE DIAMOND (lineups)
     DefenseDiamond.jsx redrawn: each fielder's surname on a writing line with
     the scorer's position number beneath, at the shipping component's own
     percent spots; the infield square on its point, a ring for the mound. */
  const DEF_SPOTS = {
    CF: [50, 4], LF: [16, 13], RF: [84, 13], SS: [30, 36], '2B': [70, 36],
    '3B': [13, 60], '1B': [87, 60], C: [50, 82],
  }
  const defenseDiamond = (nine, pitcher, dh, w = 350, h = 250) => `
    <div style="position:relative;width:${w}px;height:${h}px;margin:0 auto">
      <svg viewBox="0 0 350 250" width="${w}" height="${h}" aria-hidden="true" style="position:absolute;inset:0">
        <polygon points="175,225 265,150 175,75 85,150" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>
        <circle cx="175" cy="150" r="17" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>
        <path d="M85 150 A 128 128 0 0 1 265 150" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1.5"/>
      </svg>
      <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-56%);text-align:center">
        <span style="${mono(10, { wt: 700, ls: '0.06em', color: '#fff' })};display:block;border-bottom:1px solid rgba(255,255,255,.35);padding:0 6px 2px">${pitcher}</span>
        <span style="${mono(7.5, { ls: '0.1em', color: 'rgba(255,255,255,.55)' })};display:block;margin-top:3px">1</span>
      </span>
      ${nine.map(([pos, name, num]) => `
      <span style="position:absolute;left:${DEF_SPOTS[pos][0]}%;top:${DEF_SPOTS[pos][1]}%;transform:translateX(-50%);text-align:center">
        <span style="${mono(10, { wt: 700, ls: '0.06em', color: '#fff' })};display:block;border-bottom:1px solid rgba(255,255,255,.35);padding:0 6px 2px">${name}</span>
        <span style="${mono(7.5, { ls: '0.1em', color: 'rgba(255,255,255,.55)' })};display:block;margin-top:3px">${num}</span>
      </span>`).join('')}
      <span style="position:absolute;left:50%;bottom:-26px;transform:translateX(-50%);${mono(8, { ls: '0.16em', color: 'rgba(255,255,255,.6)' })}">DH &#183; ${dh}</span>
    </div>`

  /* ------------------------------------------- OPENING — the A → D motion
     The band and the poster are the SAME composition at two scales: the
     band's wedge and the poster's diagonal are one clip-path, and the whole
     opening is that path travelling. 440ms, three beats, clip-path and
     opacity only. */
  const OP = g('TB', 'BAL')
  const OA = T[OP.a]
  const OH = T[OP.h]
  const HERO_TOP = 219
  const BAND_H = 118
  const opening = head(`
    @keyframes op-open {
      0%, 12% { clip-path: inset(${HERO_TOP}px 0 ${844 - HERO_TOP - BAND_H}px 0) }
      26%, 92% { clip-path: inset(0px 0 0px 0) }
      92.01%, 100% { clip-path: inset(${HERO_TOP}px 0 ${844 - HERO_TOP - BAND_H}px 0) }
    }
    @keyframes op-bandtype {
      0%, 13% { opacity: 1 }
      19%, 92% { opacity: 0 }
      92.01%, 100% { opacity: 1 }
    }
    @keyframes op-postertype {
      0%, 15% { opacity: 0; transform: translateY(10px) }
      26%, 92% { opacity: 1; transform: translateY(0) }
      92.01%, 100% { opacity: 0; transform: translateY(10px) }
    }
    @keyframes op-chromeout {
      0%, 12% { opacity: 1 }
      22%, 92% { opacity: 0 }
      92.01%, 100% { opacity: 1 }
    }
    @keyframes op-press {
      0%, 8% { transform: scale(1) }
      11% { transform: scale(0.988) }
      15%, 100% { transform: scale(1) }
    }
    @keyframes op-stage {
      0%, 86% { opacity: 1 }
      91%, 95% { opacity: 0 }
      100% { opacity: 1 }
    }
    .stage { animation: op-stage 3.2s linear infinite; }
    .op-chrome, .op-rest { animation: op-chromeout 3.2s cubic-bezier(.32,.72,0,1) infinite; }
    .op-hero { animation: op-open 3.2s cubic-bezier(.32,.72,0,1) infinite, op-press 3.2s ease-out infinite; }
    .op-bandtype { animation: op-bandtype 3.2s linear infinite; }
    .op-postertype { animation: op-postertype 3.2s cubic-bezier(.32,.72,0,1) infinite; }
    @media (prefers-reduced-motion: reduce) {
      .stage, .stage * { animation: none !important; }
      .op-chrome, .op-rest, .op-bandtype { opacity: 0 !important; }
      .op-hero { clip-path: none !important; }
      .op-postertype { opacity: 1 !important; transform: none !important; }
    }
`) + `
<div class="stage" style="position:relative;width:390px;height:844px;background:${INK};overflow:hidden">

  <div class="op-chrome" style="position:absolute;left:0;right:0;top:0;z-index:3">
${masthead()}
${dayrail()}
${logoStrip()}
  </div>

  <div class="op-rest" style="position:absolute;left:0;right:0;top:${HERO_TOP + BAND_H}px;z-index:1">
${FEED_ORDER.filter((x) => x !== OP).slice(0, 5).map((x, i) => marqueeBand(x, 118, i)).join('')}
  </div>

  <!-- Full-height poster, clipped down to the band. -->
  <div class="op-hero" style="position:absolute;inset:0;background:${OH.p};overflow:hidden;z-index:4;transform-origin:50% ${HERO_TOP + BAND_H / 2}px">
    ${ghost(OP.h, 'right:-118px;bottom:-64px;height:420px;opacity:.17')}
    <div style="position:absolute;inset:0;background:#FFFFFF;clip-path:polygon(0 0, 100% 0, 100% 27.6%, 0 69.8%)"></div>
    <div style="position:absolute;inset:0;background:${OA.p};clip-path:polygon(0 0, 100% 0, 100% 26.7%, 0 68.9%)"></div>
    ${ghost(OP.a, 'left:-92px;top:-52px;height:400px;opacity:.17')}

    <!-- The band's own type, sitting exactly where the feed had it. -->
    <div class="op-bandtype" style="position:absolute;left:0;right:0;top:${HERO_TOP}px;height:${BAND_H}px">
      <div style="position:absolute;left:18px;top:16px;display:flex;align-items:center;gap:10px">
        ${chestMark(OP.a, 48)}
        <div>
          <div style="${disp(44)};color:#fff">${OP.a}</div>
          <div style="${mono(10, { wt: 700, ls: '0.14em', color: 'rgba(255,255,255,.86)' })};margin-top:5px">${OA.nick}</div>
        </div>
      </div>
      <div style="position:absolute;right:18px;top:18px;display:flex;align-items:center;gap:10px">
        <div style="text-align:right">
          <div style="${disp(39)};color:#fff">${OP.h}</div>
          <div style="${mono(10, { wt: 700, ls: '0.14em', color: 'rgba(255,255,255,.86)' })};margin-top:5px">${OH.nick}</div>
        </div>
        ${chestMark(OP.h, 48)}
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:32px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:${INK}">
        <span style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.82)' })}">${OP.park}</span>
        ${liveChip()}
      </div>
    </div>

    <div class="op-postertype">
      <div style="position:absolute;left:22px;top:86px;display:flex;align-items:flex-start;gap:18px">
        ${colourMark(OP.a, 104)}
        <div style="padding-top:3px">
          <div style="${mono(10, { wt: 700, ls: '0.28em', color: 'rgba(255,255,255,.78)' })};margin-bottom:9px">VISITOR</div>
          <div style="${disp(25, { w: 68, wt: 800 })};color:rgba(255,255,255,.86)">${OA.city}</div>
          <div style="${disp(Math.min(nickSize(OA.nick), 52))};color:#fff;margin-top:2px">${OA.nick}</div>
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;top:344px;display:flex;justify-content:center">
        <span style="${disp(118, { w: 84, ls: '0' })};color:transparent;-webkit-text-stroke:2.5px rgba(255,255,255,.55)">@</span>
      </div>
      <div style="position:absolute;right:22px;top:434px;display:flex;align-items:flex-start;gap:18px">
        <div style="text-align:right;padding-top:3px">
          <div style="${mono(10, { wt: 700, ls: '0.28em', color: 'rgba(255,255,255,.78)' })};margin-bottom:9px">HOME</div>
          <div style="${disp(25, { w: 68, wt: 800 })};color:rgba(255,255,255,.86)">${OH.city}</div>
          <div style="${disp(Math.min(nickSize(OH.nick), 52))};color:#fff;margin-top:2px">${OH.nick}</div>
        </div>
        ${colourMark(OP.h, 104)}
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0">
        <div style="background:${INK};padding:14px 20px 13px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div style="min-width:0">
            <div style="${mono(11, { wt: 700, ls: '0.1em', color: '#fff' })}">6:05 PM CT</div>
            <div style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.66)' })};margin-top:4px">CAMDEN YARDS &#183; BALTIMORE</div>
          </div>
          ${liveChip('LIVE NOW')}
        </div>
${doorRow(null, OP.a, OP.h)}
      </div>
    </div>
  </div>
</div>
` + tail

  /* --------------------------------------------- POSTER — D, as the cover */
  const PG = g('ATH', 'HOU')
  const PA = T[PG.a]
  const PH = T[PG.h]
  const poster = head() + `
<div style="position:relative;width:390px;height:844px;background:${PH.p};overflow:hidden">
  ${ghost(PG.h, 'right:-186px;bottom:-38px;height:470px;opacity:.15')}
  <div style="position:absolute;inset:0;background:#FFFFFF;clip-path:polygon(0 0, 100% 0, 100% 27.6%, 0 69.8%)"></div>
  <div style="position:absolute;inset:0;background:${PA.p};clip-path:polygon(0 0, 100% 0, 100% 26.7%, 0 68.9%)"></div>
  ${ghost(PG.a, 'left:-86px;top:-46px;height:390px;opacity:.17')}

  <div style="position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;padding:20px">
    <span style="display:flex;align-items:center;gap:9px">
      <span style="${mono(15, { wt: 400, ls: '0', color: 'rgba(255,255,255,.75)' })}">&#8249;</span>
      <span style="${mono(8.5, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.75)' })}">SAT 22 AUG</span>
    </span>
    <span style="display:flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.45);padding:4px 8px 3px">
      ${liveDot(SIGNAL, 6)}<span style="${mono(8.5, { wt: 700, ls: '0.2em', color: '#fff' })}">LIVE NOW</span>
    </span>
  </div>

  <!-- THE ART, IN COLOUR — the reason the feed's mark is a pencil patch. -->
  <div style="position:absolute;left:22px;top:86px;display:flex;align-items:flex-start;gap:18px">
    ${colourMark(PG.a, 104)}
    <div style="padding-top:3px;min-width:0">
      <div style="${mono(8.5, { wt: 700, ls: '0.3em', color: 'rgba(255,255,255,.78)' })};margin-bottom:9px">VISITOR</div>
      <div style="${disp(25, { w: 68, wt: 800 })};color:rgba(255,255,255,.82)">${PA.city}</div>
      <div style="${disp(Math.min(nickSize(PA.nick), 52))};color:#fff;margin-top:2px">${PA.nick}</div>
    </div>
  </div>

  <div style="position:absolute;left:0;right:0;top:322px;display:flex;justify-content:center;pointer-events:none">
    <span style="${disp(118, { w: 84, ls: '0' })};color:transparent;-webkit-text-stroke:2.5px rgba(255,255,255,.55)">@</span>
  </div>

  <div style="position:absolute;right:22px;top:434px;display:flex;align-items:flex-start;gap:18px">
    <div style="text-align:right;padding-top:3px;min-width:0">
      <div style="${mono(8.5, { wt: 700, ls: '0.3em', color: 'rgba(255,255,255,.78)' })};margin-bottom:9px">HOME</div>
      <div style="${disp(25, { w: 68, wt: 800 })};color:rgba(255,255,255,.82)">${PH.city}</div>
      <div style="${disp(Math.min(nickSize(PH.nick), 52))};color:#fff;margin-top:2px">${PH.nick}</div>
    </div>
    ${colourMark(PG.h, 104)}
  </div>

  <div style="position:absolute;left:0;right:0;bottom:0">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:${INK};padding:14px 20px 13px">
      <div style="min-width:0">
        <div style="${mono(11, { wt: 700, ls: '0.1em', color: '#fff' })}">6:10 PM CT &#183; TOP 1ST</div>
        <div style="${mono(7.5, { ls: '0.16em', color: 'rgba(255,255,255,.66)' })};margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">DAIKIN PARK &#183; HOUSTON &#183; WILL LITTLE HP</div>
      </div>
      <span style="flex:none;display:flex;align-items:center;gap:6px;border:1px solid rgba(233,218,0,.5);color:${SIGNAL};padding:7px 9px 6px">
        ${sealGlyph(SIGNAL, 10)}<span style="${mono(8.5, { wt: 700, ls: '0.16em' })}">SEALED</span>
      </span>
    </div>
${doorRow(null, PG.a, PG.h)}
  </div>
</div>
` + tail

  /* --------------------------------------------------------- LINEUPS (ATH)
     The real page's furniture, in this language: the club bar themed to
     tonight's jersey, the starting pitcher, the OPPOSING starter's headshot
     card, the batting order in its shipping anatomy (order · name · number ·
     position — no stat column), and the defense diamond with surnames and
     scorer's numbers. The page scrolls; the dashed rule is the fold. */
  const ATH_ORDER = [
    ['1', 'BOLTE', 'HENRY', '33', 'CF'],
    ['2', 'McNEIL', 'JEFF', '22', '2B'],
    ['3', 'GELOF', 'ZACK', '20', '3B'],
    ['4', 'WILLIAMS', 'ALIKA', '12', 'LF'],
    ['5', 'BUTLER', 'LAWRENCE', '4', 'RF'],
    ['6', 'WHITE', 'TOMMY', '47', '1B'],
    ['7', 'HEIM', 'JONAH', '15', 'C'],
    ['8', 'WALTON', 'DONOVAN', '29', 'SS'],
    ['9', 'MUNCY', 'MAX', '3', 'DH'],
  ]
  const ATH_DEFENSE = [
    ['C', 'HEIM', '2'], ['1B', 'WHITE', '3'], ['2B', 'McNEIL', '4'],
    ['3B', 'GELOF', '5'], ['SS', 'WALTON', '6'], ['LF', 'WILLIAMS', '7'],
    ['CF', 'BOLTE', '8'], ['RF', 'BUTLER', '9'],
  ]
  const lineups = head() + `
<div style="position:relative;width:390px;background:${INK};overflow:hidden">
${fold}
${gameHeader(PG.a, PG.h, 'TOP 1ST')}

  <!-- Themed to the jersey this club is wearing tonight — identity, never
       game state. The chip names the treatment the uniforms feed resolved. -->
  <div style="position:relative;background:${PA.p};padding:18px 20px 16px;overflow:hidden">
    ${ghost(PG.a, 'right:-40px;top:-34px;height:200px;opacity:.16')}
    <div style="position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:12px">
      <div>
        <div style="${mono(8.5, { wt: 700, ls: '0.3em', color: 'rgba(255,255,255,.74)' })};margin-bottom:8px">VISITOR</div>
        <div style="${disp(46)};color:#fff">${PA.city}</div>
      </div>
      <span style="${mono(8, { wt: 700, ls: '0.16em', color: 'rgba(255,255,255,.8)' })};border:1px solid rgba(255,255,255,.35);padding:4px 7px 3px;flex:none">KELLY GREEN ALT</span>
    </div>
  </div>

  <div style="padding:0 20px">
${sectionLabel('STARTING PITCHER')}
    <div style="display:flex;align-items:center;gap:14px;padding:0 0 4px">
      ${shot('h-lopez.png', 54, 72)}
      <div style="min-width:0;flex:1">
        <div style="${disp(26, { w: 70, wt: 800 })};color:#fff">LOPEZ, JACOB</div>
        <div style="${mono(8, { ls: '0.17em', color: 'rgba(255,255,255,.64)' })};margin-top:6px">#57 &#183; LHP &#183; 5&#8211;4 &#183; 4.98 ERA &#183; 118.2 IP</div>
      </div>
    </div>

${sectionLabel('THE MAN THEY FACE')}
    <div style="display:flex;gap:14px;border:1px solid rgba(255,255,255,.14);padding:13px 14px">
      ${shot('h-brown.png', 88, 117)}
      <div style="min-width:0;flex:1;padding-top:2px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:14px;height:3px;background:${PH.p};flex:none"></span>
          <span style="${mono(8, { wt: 700, ls: '0.2em', color: 'rgba(255,255,255,.6)' })}">ASTROS &#183; RHP</span>
        </div>
        <div style="${disp(26, { w: 70, wt: 800 })};color:#fff;margin-top:8px">BROWN, HUNTER</div>
        <div style="${mono(8, { ls: '0.17em', color: 'rgba(255,255,255,.64)' })};margin-top:7px">#58 &#183; 11&#8211;4 &#183; 2.21 ERA &#183; 173 K</div>
        <div style="font-family:'Lora',Georgia,serif;font-size:12.5px;line-height:1.5;color:rgba(255,255,255,.68);margin-top:9px">Last start: 7 innings, one run, 9 strikeouts against Seattle.</div>
      </div>
    </div>

${sectionLabel('BATTING ORDER')}
${ATH_ORDER.map(([n, last, first, num, pos]) => `
    <div style="display:grid;grid-template-columns:19px minmax(0,1fr) 34px 36px;gap:12px;align-items:center;height:52px;border-bottom:1px solid rgba(255,255,255,.075)">
      <span style="${mono(12, { wt: 700, ls: '0', color: SIGNAL })}">${n}</span>
      <span style="min-width:0">
        <span style="${disp(20, { w: 74, wt: 800 })};color:#fff;display:block">${last}</span>
        <span style="${mono(7.5, { ls: '0.16em', color: 'rgba(255,255,255,.62)' })};display:block;margin-top:3px">${first}</span>
      </span>
      <span style="${mono(11, { wt: 700, ls: '0.02em', color: SIGNAL })};text-align:right">${num}</span>
      <span style="${mono(9, { wt: 700, ls: '0.1em', color: 'rgba(255,255,255,.78)' })};text-align:right">${pos}</span>
    </div>`).join('')}

${sectionLabel('HOW THEY LINE UP')}
    <div style="padding:8px 0 40px">
${defenseDiamond(ATH_DEFENSE, 'LOPEZ', 'MUNCY', 330, 240)}
    </div>
  </div>

${doorRow('away', PG.a, PG.h)}
</div>
` + tail

  /* ------------------------------------------------- HOVER CARD (desktop)
     PlayerHoverCard redrawn: club spine, the silo headshot, name, position ·
     bats · number, the club crest, four stat tiles. Pointer-only, ≥740px;
     read-only, so the pointer passes through it. */
  const hoverCard = head() + `
<div style="position:relative;width:350px;height:430px;background:${INK};overflow:hidden;display:grid;place-items:center">
  <div style="position:relative;width:300px;background:#12141A;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 40px rgba(0,0,0,.5)">
    <span style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${PA.p}"></span>
    <div style="display:flex;gap:13px;padding:15px 16px 12px 19px">
      ${shot('h-bolte.png', 54, 72)}
      <div style="min-width:0;flex:1;padding-top:2px">
        <div style="${disp(22, { w: 72, wt: 800 })};color:#fff">HENRY BOLTE</div>
        <div style="${mono(8, { ls: '0.16em', color: 'rgba(255,255,255,.64)' })};margin-top:7px">CF &#183; BATS R &#183; #33</div>
        <div style="${mono(7.5, { ls: '0.14em', color: 'rgba(255,255,255,.5)' })};margin-top:5px">IT'S JUST ATHLETICS</div>
      </div>
      <img src="ath.svg" alt="" style="width:30px;height:30px;object-fit:contain;flex:none;align-self:flex-start" />
    </div>
    <div style="height:1px;background:rgba(255,255,255,.12);margin:0 16px 0 19px"></div>
    <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:1px;background:rgba(255,255,255,.09);border-top:1px solid transparent;margin:12px 16px 15px 19px;border:1px solid rgba(255,255,255,.12)">
      ${[['AVG', '.264'], ['HR', '19'], ['RBI', '55'], ['OPS', '.784']].map(([l, v]) => `
      <span style="display:flex;flex-direction:column;align-items:center;gap:5px;background:#12141A;padding:9px 0 8px">
        <span style="${mono(11, { wt: 700, ls: '0.02em', color: '#fff' })};font-variant-numeric:tabular-nums">${v}</span>
        <span style="${mono(7.5, { ls: '0.14em', color: 'rgba(255,255,255,.5)' })}">${l}</span>
      </span>`).join('')}
    </div>
  </div>
</div>
` + tail

  /* ---------------------------------------------------------- INNINGS (top 2nd) */
  const innings = head() + `
<div style="position:relative;width:390px;height:844px;background:${INK};overflow:hidden;display:flex;flex-direction:column">
${gameHeader(PG.a, PG.h, 'LIVE')}

  <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.12);flex:none">
    <span style="${mono(9, { wt: 700, ls: '0.16em', color: 'rgba(255,255,255,.62)' })}">&#8249; BOT 1ST</span>
    <span style="${disp(24, { w: 76, wt: 900 })};color:#fff">TOP 2ND</span>
    <span style="${mono(9, { wt: 700, ls: '0.16em', color: 'rgba(255,255,255,.62)' })}">BOT 2ND &#8250;</span>
  </div>

  <div style="flex:1;overflow:hidden;padding:0 20px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 0 16px;border-bottom:1px solid rgba(255,255,255,.09)">
      <div style="display:flex;gap:13px;min-width:0">
        ${shot('h-williams.png', 54, 72)}
        <div style="min-width:0">
          <div style="${mono(8, { wt: 700, ls: '0.24em', color: SIGNAL })};margin-bottom:8px">NOW BATTING &#183; 4TH</div>
          <div style="${disp(34, { w: 70 })};color:#fff">WILLIAMS</div>
          <div style="${mono(8, { ls: '0.17em', color: 'rgba(255,255,255,.64)' })};margin-top:6px">ALIKA &#183; #12 &#183; VS BROWN, RHP</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px;flex:none">
        ${playDiamond(56, { legs: 1 })}
        <span style="display:flex;gap:5px">
          <span style="width:7px;height:7px;border-radius:50%;background:${SIGNAL}"></span>
          <span style="width:7px;height:7px;border-radius:50%;border:1.4px solid rgba(255,255,255,.4)"></span>
        </span>
        <span style="${mono(7.5, { ls: '0.18em', color: 'rgba(255,255,255,.62)' })}">1 OUT &#183; 2&#8211;1</span>
      </div>
    </div>

${sectionLabel('RUNS THIS HALF')}
${sealSlab('TAP TO REVEAL', 'This half only. Nothing else on the page moves,<br />and the innings after it stay shut.', 212)}

${sectionLabel('DUE UP')}
    <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:9px">
${[['5', 'BUTLER'], ['6', 'WHITE'], ['7', 'HEIM']].map(([n, last]) => `
      <div style="border:1px solid rgba(255,255,255,.14);padding:10px 11px 11px">
        <div style="${mono(8, { wt: 700, ls: '0.14em', color: SIGNAL })}">${n}</div>
        <div style="${disp(18, { w: 72, wt: 800 })};color:#fff;margin-top:7px">${last}</div>
      </div>`).join('')}
    </div>

${sectionLabel('YOUR SCOREBOOK', '3 OF 18 HALVES')}
${revealRail(3)}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(255,255,255,.16);flex:none">
    <span style="display:grid;place-items:center;height:52px;background:${SIGNAL};color:${INK};${mono(10, { wt: 700, ls: '0.18em' })}">NEXT AT-BAT</span>
    <span style="display:grid;place-items:center;height:52px;background:${INK};color:#fff;${mono(10, { wt: 700, ls: '0.18em' })}">REST OF HALF</span>
  </div>
${doorRow('inn', PG.a, PG.h)}
</div>
` + tail

  /* -------------------------------------------------------------- BOX SCORE */
  const ON_FIELD = [
    ['LOPEZ', '1'], ['HEIM', '2'], ['WHITE', '3'], ['McNEIL', '4'], ['GELOF', '5'],
    ['WALTON', '6'], ['WILLIAMS', '7'], ['BOLTE', '8'], ['BUTLER', '9'],
  ]
  const boxscore = head() + `
<div style="position:relative;width:390px;height:844px;background:${INK};overflow:hidden;display:flex;flex-direction:column">
${gameHeader(PG.a, PG.h, 'LIVE')}

  <div style="flex:1;overflow:hidden;padding:0 20px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;padding:20px 0 14px">
      <span style="${disp(34, { w: 72 })};color:#fff">BOX SCORE</span>
      <span style="${mono(8, { ls: '0.16em', color: 'rgba(255,255,255,.62)' })};padding-bottom:5px">AS OF 9:26 PM</span>
    </div>

${sealSlab('TAP TO REVEAL', 'The whole box score, all at once. Once you open it,<br />it stays open &#8212; on every device you own.', 300)}

    <div style="display:flex;align-items:center;gap:12px;padding:16px 0 10px">
      <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">ON THE FIELD &#183; ATHLETICS</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
${ON_FIELD.map(([name, num]) => `
      <span style="display:flex;align-items:baseline;gap:5px;border:1px solid rgba(255,255,255,.14);padding:5px 8px 4px">
        <span style="${mono(9, { wt: 700, ls: '0.06em', color: '#fff' })}">${name}</span>
        <span style="${mono(7.5, { ls: '0', color: 'rgba(255,255,255,.5)' })}">${num}</span>
      </span>`).join('')}
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid rgba(255,255,255,.16);padding:13px 16px;margin-top:16px">
      <div style="min-width:0">
        <div style="${mono(8, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.62)' })}">NEW TO THIS?</div>
        <div style="${disp(21, { w: 74, wt: 800 })};color:#fff;margin-top:7px">HOW TO READ A BOX SCORE</div>
      </div>
      <span style="${mono(15, { wt: 400, ls: '0', color: 'rgba(255,255,255,.66)' })};flex:none">&#8250;</span>
    </div>

${sectionLabel('YOUR SCOREBOOK', 'THROUGH TOP 2ND')}
${revealRail(3)}
  </div>

${doorRow('box', PG.a, PG.h)}
</div>
` + tail

  // doorRow, gameHeader, revealRail, shot and playDiamond go out too: the
  // revealed states in extras.mjs are the same screens, same furniture.
  return { opening, poster, lineups, hoverCard, innings, boxscore,
           doorRow, gameHeader, revealRail, shot, playDiamond, sectionLabel }
}
