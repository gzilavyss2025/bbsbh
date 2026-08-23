// Everything the design review found missing: the light-ground comparison, the
// two REVEALED states (the set drew the locked door five ways and never opened
// it), and the edge cases the three-state mock had been sidestepping.
//
// Same contract as flow.mjs — one helper kit in, artboards out.

export function extraArtboards(k) {
  const { T, GAMES, g, SIGNAL, INK, head, tail, disp, mono, ghost, sealGlyph,
          starGlyph, nickSize, contrast, marqueeBand, baseTileSrc } = k

  /* ================================================== 1. THE LIGHT GROUND
     The review's highest-leverage finding, drawn instead of argued.

     On #0A0B0D, 17 of 30 club primaries sit under 1.4:1 against the page —
     Tigers and Yankees at 1.25:1 — so more than half the league does not read
     as a colour block at all. On a light ground only Miami (2.50:1) and the
     Giants (2.75:1) fall under 3:1 and the median is 10.59:1.

     This is NOT a retreat to manila. #E7E6E1 is a cool grey-white, two hue
     steps and a chroma step away from the app's #F6EFDC; the break that
     mattered — full-bleed club colour replacing cards — is untouched. What the
     light ground buys on top of the contrast: the separator becomes a 4px GAP
     of page rather than a drawn line, which is what a rack of jerseys actually
     looks like, and a finished game reads as finished by desaturating instead
     of by needing a device. */
  const onFieldL = (c) => (contrast('#FFFFFF', c) >= 3.4 ? '#FFFFFF' : '#0A0B0D')
  const dimOnL = (c) => (contrast('#FFFFFF', c) >= 3.4 ? 'rgba(255,255,255,.86)' : 'rgba(10,11,13,.74)')
  const PAPER = '#E7E6E1'
  const lInk = (a) => `rgba(16,17,20,${a})`

  const lightBand = (game, h) => {
    const A = T[game.a]
    const H = T[game.h]
    const seam = contrast('#FFFFFF', A.p) < 3 || contrast('#FFFFFF', H.p) < 3 ? '#101114' : '#FFFFFF'
    const wedge = 'polygon(0 0, 100% 0, calc(100% - 34px) 100%, 0 100%)'
    const big = h >= 108
    const scrim = game.state === 'sealed' ? 'rgba(231,230,225,.52)' : game.state === 'pre' ? 'rgba(231,230,225,.18)' : null
    return `
    <article style="position:relative;height:${h}px;overflow:hidden;background:${H.p}${game.pin ? ';box-shadow:inset 0 0 0 2px #101114' : ''}">
      <div style="position:absolute;inset:0;width:calc(45% + 6px);background:${seam};clip-path:${wedge}"></div>
      <div style="position:absolute;inset:0;width:calc(45% + 2px);background:${A.s};clip-path:${wedge}"></div>
      <div style="position:absolute;inset:0;width:45%;background:${A.p};clip-path:${wedge}"></div>
      ${ghost(game.a, `left:-24px;top:-14px;height:${h + 42}px;opacity:.14`)}
      ${ghost(game.h, `right:-20px;top:-18px;height:${h + 48}px;opacity:.15`)}
      ${scrim ? `<span style="position:absolute;inset:0;background:${scrim};pointer-events:none"></span>` : ''}
      <div style="position:absolute;left:0;right:0;top:0;height:${h - 30}px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;max-width:calc(45% - 24px)">
          ${baseTileSrc(A.logo, big ? 48 : 36)}
          <div style="min-width:0">
          <div style="${disp(big ? 42 : 30)};color:${onFieldL(A.p)}">${game.a}</div>
          ${big ? `<div style="${mono(10, { ls: '0.18em' })};color:${dimOnL(A.p)};margin-top:5px">${A.city}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <div style="text-align:right;min-width:0">
          <div style="${disp(big ? 37 : 27)};color:${onFieldL(H.p)}">${game.h}</div>
          ${big ? `<div style="${mono(10, { ls: '0.18em' })};color:${dimOnL(H.p)};margin-top:5px">${H.city}</div>` : ''}
          </div>
          ${baseTileSrc(H.logo, big ? 48 : 36)}
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:30px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px;background:${INK}">
        <span style="display:flex;align-items:center;gap:5px;${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.82)' })};overflow:hidden;white-space:nowrap">${game.pin ? starGlyph('#FFFFFF', 10) : ''}<span style="overflow:hidden;text-overflow:ellipsis">${game.park}</span></span>
        <span style="flex:none;display:flex;align-items:center;gap:6px">
          ${game.state === 'live'
            ? `<span class="pulse" style="width:6px;height:6px;border-radius:50%;background:${SIGNAL}"></span><span style="${mono(10, { wt: 700, ls: '0.18em', color: SIGNAL })}">LIVE</span>`
            : game.state === 'sealed'
              ? `${sealGlyph('rgba(255,255,255,.82)', 10)}<span style="${mono(10, { wt: 700, ls: '0.18em', color: 'rgba(255,255,255,.82)' })}">SEALED</span>`
              : `<span style="${mono(10, { wt: 700, ls: '0.18em', color: 'rgba(255,255,255,.82)' })}">${game.t}</span>`}
        </span>
      </div>
    </article>`
  }

  const lRule = (label, count) => `
    <div style="display:flex;align-items:center;gap:10px;padding:11px 18px 10px">
      <span style="${mono(10, { wt: 700, ls: '0.22em', color: lInk(0.74) })}">${label}</span>
      <span style="${mono(10, { ls: '0.1em', color: lInk(0.42) })}">${count}</span>
      <span style="flex:1;height:1px;background:${lInk(0.18)}"></span>
    </div>`

  const feedLight = head() + `
<div style="position:relative;width:390px;background:${PAPER};overflow:hidden">
  <header style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px 10px;border-bottom:1px solid ${lInk(0.16)}">
    <span style="${disp(23, { w: 66, ls: '0.005em' })};color:#101114">TAL<span style="color:#B8A800">1</span>Y</span>
    <span style="display:flex;align-items:center;gap:16px">
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.2" stroke="${lInk(0.7)}" stroke-width="1.6"/><path d="M11.4 11.4 15 15" stroke="${lInk(0.7)}" stroke-width="1.6" stroke-linecap="square"/></svg>
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true"><path d="M2 4h14M2 9h14M2 14h14" stroke="${lInk(0.7)}" stroke-width="1.6" stroke-linecap="square"/></svg>
    </span>
  </header>
  <nav style="display:flex;align-items:center;gap:2px;padding:0 12px;border-bottom:1px solid ${lInk(0.16)}">
    ${['MLB', 'AAA', 'AA', 'A+', 'A'].map((lv) => `
    <span style="display:grid;place-items:center;min-width:46px;height:44px;${lv === 'MLB' ? 'background:#101114;' : ''}">
      <span style="${mono(10, { wt: 700, ls: '0.14em', color: lv === 'MLB' ? PAPER : lInk(0.6) })}">${lv}</span>
    </span>`).join('')}
  </nav>
  <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 12px;border-bottom:1px solid ${lInk(0.16)}">
    <div style="display:flex;align-items:center;gap:4px">
      <span style="display:grid;place-items:center;width:44px;height:44px;${mono(15, { wt: 400, ls: '0', color: lInk(0.6) })}">&#8249;</span>
      <span style="${disp(19, { w: 78, wt: 800, ls: '0.01em' })};color:#101114">SAT 22 AUG</span>
      <span style="display:grid;place-items:center;width:44px;height:44px;${mono(15, { wt: 400, ls: '0', color: lInk(0.6) })}">&#8250;</span>
    </div>
    <span style="display:flex;align-items:center;gap:7px;min-height:44px;border:1px solid ${lInk(0.3)};padding:0 11px">
      ${sealGlyph(lInk(0.8), 12)}
      <span style="${mono(10, { wt: 700, ls: '0.16em', color: lInk(0.8) })}">SEALED</span>
      <span style="width:26px;height:15px;border:1px solid ${lInk(0.4)};position:relative;display:block">
        <span style="position:absolute;left:1px;top:1px;width:11px;height:11px;background:${lInk(0.55)}"></span>
      </span>
    </span>
  </div>
${lRule('YOUR CLUB', '01')}
  <!-- The separator is a 4px gap of page, not a drawn line. On a dark ground it
       had to be a border because the bands and the page were the same value. -->
  <div style="display:flex;flex-direction:column;gap:4px;padding:0 0 4px">
${lightBand(g('ATL', 'MIL'), 118)}
  </div>
${lRule('ON NOW', '08')}
  <div style="display:flex;flex-direction:column;gap:4px;padding:0 0 4px">
${GAMES.slice(0, 8).map((x) => lightBand(x, x.state === 'live' ? 118 : 88)).join('')}
  </div>
${lRule('FIRST PITCH TO COME', '03')}
  <div style="display:flex;flex-direction:column;gap:4px;padding:0 0 4px">
${GAMES.slice(8, 11).map((x) => lightBand(x, 88)).join('')}
  </div>
${lRule('EARLIER TODAY &#183; TAP TO UNSEAL', '04')}
  <div style="display:flex;flex-direction:column;gap:4px;padding:0 0 18px">
${GAMES.slice(12, 15).map((x) => lightBand(x, 68)).join('')}
  </div>
  <div style="position:absolute;left:0;right:0;top:844px;height:0;pointer-events:none;z-index:9">
    <div style="border-top:1px dashed ${lInk(0.55)}"></div>
    <span style="position:absolute;right:8px;top:5px;${mono(9, { wt: 700, ls: '0.18em', color: lInk(0.6) })}">FOLD &#183; IPHONE 14 PRO</span>
  </div>
</div>
` + tail

  /* ============================================ 2. THE REVEALED STATES
     Six artboards showed a seal; none showed what is under one. The reveal is
     the product, so these are the two screens that had to exist before any of
     this could be called finished. */

  const PG = g('ATH', 'HOU')
  const PA = T[PG.a]
  const PH = T[PG.h]

  const doorRow = k.doorRow
  const gameHeader = k.gameHeader

  // A revealed half. The runs land in the slot the seal was occupying, at the
  // same height, so opening one does not shove the rest of the page down.
  const inningsOpen = head() + `
<div style="position:relative;width:390px;height:844px;background:${INK};overflow:hidden;display:flex;flex-direction:column">
${gameHeader(PG.a, PG.h, 'LIVE')}
  <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.12);flex:none">
    <span style="${mono(10, { wt: 700, ls: '0.16em', color: 'rgba(255,255,255,.62)' })}">&#8249; BOT 1ST</span>
    <span style="${disp(24, { w: 76, wt: 900 })};color:#fff">TOP 2ND</span>
    <span style="${mono(10, { wt: 700, ls: '0.16em', color: 'rgba(255,255,255,.62)' })}">BOT 2ND &#8250;</span>
  </div>

  <div style="flex:1;overflow:hidden;padding:0 20px">
    <div style="display:flex;align-items:center;gap:12px;padding:18px 0 11px">
      <span style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.74)' })}">RUNS THIS HALF</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
      <span style="${mono(10, { ls: '0.12em', color: 'rgba(255,255,255,.5)' })}">OPENED 9:26 PM</span>
    </div>

    <!-- Same 212px the seal held, so the page does not jump when it comes off. -->
    <div style="position:relative;height:212px;display:flex;align-items:center;gap:22px;padding:0 24px;background:${PA.p};overflow:hidden">
      ${ghost(PG.a, 'right:-42px;top:-30px;height:270px;opacity:.15')}
      <div style="position:relative;text-align:center;flex:none">
        <div style="${disp(96, { w: 78 })};color:${SIGNAL};line-height:.82">2</div>
        <div style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.86)' })};margin-top:9px">RUNS</div>
      </div>
      <div style="position:relative;flex:1;min-width:0">
        ${[['3', 'HITS'], ['0', 'ERRORS'], ['1', 'LEFT ON'], ['4', 'BATTERS']].map(([n, l], i) => `
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:7px 0;${i ? 'border-top:1px solid rgba(255,255,255,.2)' : ''}">
          <span style="${mono(10, { ls: '0.18em', color: 'rgba(255,255,255,.82)' })}">${l}</span>
          <span style="${mono(15, { wt: 700, ls: '0.02em', color: '#fff' })};font-variant-numeric:tabular-nums">${n}</span>
        </div>`).join('')}
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:12px;padding:18px 0 11px">
      <span style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.74)' })}">HOW IT WENT</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
    </div>
${[
  ['1', 'BOLTE', 'singled to left'],
  ['2', 'McNEIL', 'flied out to center'],
  ['3', 'GELOF', 'doubled — Bolte scored'],
  ['4', 'WILLIAMS', 'homered — Gelof scored'],
].map(([n, who, what]) => `
    <div style="display:grid;grid-template-columns:16px 84px minmax(0,1fr);gap:11px;align-items:baseline;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.075)">
      <span style="${mono(10, { wt: 700, ls: '0', color: SIGNAL })}">${n}</span>
      <span style="${disp(17, { w: 74, wt: 800 })};color:#fff">${who}</span>
      <span style="font-family:'Lora',Georgia,serif;font-size:12.5px;line-height:1.4;color:rgba(255,255,255,.72)">${what}</span>
    </div>`).join('')}

    <div style="display:flex;align-items:center;gap:12px;padding:20px 0 12px">
      <span style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.74)' })}">YOUR SCOREBOOK</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
      <span style="${mono(10, { ls: '0.12em', color: 'rgba(255,255,255,.6)' })}">4 OF 18 HALVES</span>
    </div>
${k.revealRail ? k.revealRail(4) : ''}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(255,255,255,.16);flex:none">
    <span style="display:grid;place-items:center;height:52px;background:${INK};color:#fff;${mono(10, { wt: 700, ls: '0.18em' })}">&#8249; BOT 1ST</span>
    <span style="display:grid;place-items:center;height:52px;background:${SIGNAL};color:${INK};${mono(10, { wt: 700, ls: '0.18em' })}">BOT 2ND &#8250;</span>
  </div>
${doorRow('inn', PG.a, PG.h)}
</div>
` + tail

  // A revealed box score. This is the layout the set had never proved: tabular
  // mono figures on a hairline grid, the club's colour as the row header, the
  // totals row in the signal colour. Five columns fit 390px; the app's full
  // set (BB, SO, LOB, …) scrolls inside its own container.
  const BAT = [
    ['1', 'BOLTE', 'CF', '4', '1', '2', '0', '.266'],
    ['2', 'McNEIL', '2B', '4', '0', '1', '1', '.263'],
    ['3', 'GELOF', '3B', '3', '1', '1', '0', '.264'],
    ['4', 'WILLIAMS', 'PH', '4', '1', '1', '2', '.263'],
    ['5', 'BUTLER', 'RF', '4', '0', '0', '0', '.214'],
    ['6', 'WHITE', '1B', '3', '0', '1', '0', '.259'],
    ['7', 'HEIM', 'C', '3', '0', '0', '0', '.203'],
  ]
  const boxOpen = head() + `
<div style="position:relative;width:390px;height:844px;background:${INK};overflow:hidden;display:flex;flex-direction:column">
${gameHeader(PG.a, PG.h, 'LIVE')}
  <div style="flex:1;overflow:hidden">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;padding:18px 20px 12px">
      <span style="${disp(30, { w: 72 })};color:#fff">BOX SCORE</span>
      <span style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.55)' })};padding-bottom:4px">OPEN &#183; 9:26 PM</span>
    </div>

    <!-- The linescore, which is the one place a run total belongs. -->
    <div style="display:grid;grid-template-columns:52px repeat(9, minmax(0,1fr)) 26px 26px;gap:1px;background:rgba(255,255,255,.14);margin:0 20px;border:1px solid rgba(255,255,255,.14)">
      ${['', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'R', 'H'].map((c, i) => `
      <span style="display:grid;place-items:center;height:22px;background:${INK};${mono(10, { wt: 700, ls: '0.04em', color: 'rgba(255,255,255,.62)' })}">${c}</span>`).join('')}
      ${[[PG.a, PA.p, ['2', '0', '', '', '', '', '', '', ''], '2', '3'], [PG.h, PH.p, ['0', '', '', '', '', '', '', '', ''], '0', '1']].map(([ab, col, cells, r, h]) => `
      <span style="display:grid;place-items:center;height:26px;background:${col};${disp(14, { w: 76, wt: 800 })};color:#fff">${ab}</span>
      ${cells.map((c) => `<span style="display:grid;place-items:center;height:26px;background:${INK};${mono(11, { wt: 500, ls: '0', color: c ? '#fff' : 'rgba(255,255,255,.3)' })};font-variant-numeric:tabular-nums">${c || '&#183;'}</span>`).join('')}
      <span style="display:grid;place-items:center;height:26px;background:${INK};${mono(11, { wt: 700, ls: '0', color: SIGNAL })};font-variant-numeric:tabular-nums">${r}</span>
      <span style="display:grid;place-items:center;height:26px;background:${INK};${mono(11, { wt: 700, ls: '0', color: '#fff' })};font-variant-numeric:tabular-nums">${h}</span>`).join('')}
    </div>

    <div style="display:flex;align-items:center;gap:10px;padding:20px 20px 9px">
      <span style="width:16px;height:4px;background:${PA.p};flex:none"></span>
      <span style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.74)' })}">${PA.city} ${PA.nick} &#183; BATTING</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
    </div>
    <div style="display:grid;grid-template-columns:15px minmax(0,1fr) 26px 24px 24px 24px 24px 42px;gap:8px;align-items:center;padding:0 20px 7px">
      ${['', '', '', 'AB', 'R', 'H', 'RBI', 'AVG'].map((c) => `<span style="${mono(10, { wt: 700, ls: '0.06em', color: 'rgba(255,255,255,.5)' })};text-align:${c === '' ? 'left' : 'right'}">${c}</span>`).join('')}
    </div>
${BAT.map(([n, who, pos, ab, r, h, rbi, avg]) => `
    <div style="display:grid;grid-template-columns:15px minmax(0,1fr) 26px 24px 24px 24px 24px 42px;gap:8px;align-items:center;height:34px;padding:0 20px;border-top:1px solid rgba(255,255,255,.075)">
      <span style="${mono(10, { wt: 700, ls: '0', color: SIGNAL })}">${n}</span>
      <span style="${disp(17, { w: 74, wt: 800 })};color:#fff;overflow:hidden;white-space:nowrap">${who}</span>
      <span style="${mono(10, { wt: 500, ls: '0.06em', color: 'rgba(255,255,255,.6)' })}">${pos}</span>
      ${[ab, r, h, rbi].map((v) => `<span style="${mono(11, { wt: 500, ls: '0', color: '#fff' })};text-align:right;font-variant-numeric:tabular-nums">${v}</span>`).join('')}
      <span style="${mono(11, { wt: 500, ls: '0', color: 'rgba(255,255,255,.72)' })};text-align:right;font-variant-numeric:tabular-nums">${avg}</span>
    </div>`).join('')}
    <div style="display:grid;grid-template-columns:15px minmax(0,1fr) 26px 24px 24px 24px 24px 42px;gap:8px;align-items:center;height:34px;padding:0 20px;border-top:1px solid ${SIGNAL}">
      <span></span>
      <span style="${disp(17, { w: 74, wt: 800 })};color:${SIGNAL}">TOTALS</span>
      <span></span>
      ${['25', '2', '6', '3'].map((v) => `<span style="${mono(11, { wt: 700, ls: '0', color: SIGNAL })};text-align:right;font-variant-numeric:tabular-nums">${v}</span>`).join('')}
      <span></span>
    </div>

    <div style="display:flex;align-items:center;gap:10px;padding:20px 20px 9px">
      <span style="width:16px;height:4px;background:${PH.p};flex:none"></span>
      <span style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.74)' })}">PITCHING</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 34px 26px 26px 26px 44px;gap:8px;align-items:center;padding:0 20px 7px">
      ${['', 'IP', 'H', 'R', 'ER', 'ERA'].map((c) => `<span style="${mono(10, { wt: 700, ls: '0.06em', color: 'rgba(255,255,255,.5)' })};text-align:${c === '' ? 'left' : 'right'}">${c}</span>`).join('')}
    </div>
${[['BROWN', 'HOU', '2.0', '3', '2', '2', '3.58'], ['LOPEZ', 'ATH', '1.0', '1', '0', '0', '4.94']].map(([who, club, ip, h, r, er, era]) => `
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 34px 26px 26px 26px 44px;gap:8px;align-items:center;height:34px;padding:0 20px;border-top:1px solid rgba(255,255,255,.075)">
      <span style="display:flex;align-items:baseline;gap:8px;min-width:0">
        <span style="${disp(17, { w: 74, wt: 800 })};color:#fff;white-space:nowrap">${who}</span>
        <span style="${mono(10, { ls: '0.08em', color: 'rgba(255,255,255,.5)' })}">${club}</span>
      </span>
      ${[ip, h, r, er].map((v) => `<span style="${mono(11, { wt: 500, ls: '0', color: '#fff' })};text-align:right;font-variant-numeric:tabular-nums">${v}</span>`).join('')}
      <span style="${mono(11, { wt: 500, ls: '0', color: 'rgba(255,255,255,.72)' })};text-align:right;font-variant-numeric:tabular-nums">${era}</span>
    </div>`).join('')}

    <!-- The home club's card, closed. A box score is two of these; the screen
         opens on the club whose half you were last reading. -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;height:56px;margin:20px 20px 0;padding:0 16px;border:1px solid rgba(255,255,255,.2)">
      <span style="display:flex;align-items:center;gap:10px;min-width:0">
        <span style="width:16px;height:4px;background:${PH.p};flex:none"></span>
        <span style="${disp(19, { w: 74, wt: 800 })};color:#fff;white-space:nowrap">${PH.city} ${PH.nick}</span>
      </span>
      <span style="${mono(15, { wt: 400, ls: '0', color: 'rgba(255,255,255,.6)' })};flex:none">&#8250;</span>
    </div>
  </div>
${doorRow('box', PG.a, PG.h)}
</div>
` + tail

  /* ================================================== 3. THE EDGE CASES
     `GAMES` carried three states — live, pre, sealed — and the band had one
     43px status slot. Everything below is a real row the feed will be handed
     and had no drawing for. */
  const plainBand = (h, bg, body) => `
    <article style="position:relative;height:${h}px;overflow:hidden;background:${bg}">${body}</article>`

  const edgeRail = (left, right) => `
    <div style="position:absolute;left:0;right:0;bottom:0;height:30px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px;background:${INK}">
      <span style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.82)' })};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${left}</span>
      <span style="flex:none">${right}</span>
    </div>`

  const edges = head() + `
<div style="position:relative;width:390px;background:${INK};overflow:hidden;padding-bottom:20px">
  <div style="padding:20px 20px 14px;border-bottom:1px solid rgba(255,255,255,.14)">
    <div style="${disp(28, { w: 72 })};color:#fff">EDGE CASES</div>
    <div style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.6)' })};margin-top:8px;line-height:1.7">THE ROWS THE THREE-STATE MOCK WAS NOT DRAWING</div>
  </div>

  <div style="display:flex;align-items:center;gap:10px;padding:16px 18px 9px">
    <span style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.74)' })}">POSTPONED</span>
    <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
  </div>
  ${plainBand(88, T.WSH.p, `
    <div style="position:absolute;inset:0;width:calc(45% + 6px);background:#FFFFFF;clip-path:polygon(0 0, 100% 0, calc(100% - 38px) 100%, 0 100%)"></div>
    <div style="position:absolute;inset:0;width:45%;background:${T.STL.p};clip-path:polygon(0 0, 100% 0, calc(100% - 38px) 100%, 0 100%)"></div>
    <span style="position:absolute;inset:0;background:rgba(10,11,13,.5)"></span>
    <div style="position:absolute;left:0;right:0;top:0;height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 20px">
      <span style="${disp(30)};color:rgba(255,255,255,.7)">STL</span>
      <span style="transform:rotate(-4deg);border:2px solid ${SIGNAL};color:${SIGNAL};padding:4px 10px 3px;${mono(11, { wt: 700, ls: '0.2em' })}">POSTPONED</span>
      <span style="${disp(27)};color:rgba(255,255,255,.7)">WSH</span>
    </div>
    ${edgeRail('RAIN &#183; MAKE-UP TBA', `<span style="${mono(10, { wt: 700, ls: '0.18em', color: 'rgba(255,255,255,.62)' })}">NO GAME</span>`)}`)}

  <div style="display:flex;align-items:center;gap:10px;padding:20px 18px 9px">
    <span style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.74)' })}">DOUBLEHEADER</span>
    <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
  </div>
  <!-- Two games, one row: the second sheet shows as a 6px ledge on the right
       rather than a stacked card, because a band has no corner to peel. -->
  <div style="position:relative;padding-right:7px">
    <span style="position:absolute;right:0;top:7px;bottom:7px;width:7px;background:${T.CHC.p};border-left:2px solid ${INK}"></span>
    ${plainBand(118, T.SEA.p, `
      <div style="position:absolute;inset:0;width:calc(45% + 6px);background:#FFFFFF;clip-path:polygon(0 0, 100% 0, calc(100% - 38px) 100%, 0 100%)"></div>
      <div style="position:absolute;inset:0;width:calc(45% + 2px);background:${T.CHC.s};clip-path:polygon(0 0, 100% 0, calc(100% - 38px) 100%, 0 100%)"></div>
      <div style="position:absolute;inset:0;width:45%;background:${T.CHC.p};clip-path:polygon(0 0, 100% 0, calc(100% - 38px) 100%, 0 100%)"></div>
      <div style="position:absolute;left:0;right:0;top:0;height:86px;display:flex;align-items:center;justify-content:space-between;padding:0 20px">
        <div><div style="${disp(44)};color:#fff">CHC</div><div style="${mono(10, { ls: '0.18em', color: 'rgba(255,255,255,.86)' })};margin-top:5px">CHICAGO</div></div>
        <div style="text-align:right;padding-top:6px"><div style="${disp(39)};color:#fff">SEA</div><div style="${mono(10, { ls: '0.18em', color: 'rgba(255,255,255,.86)' })};margin-top:5px">SEATTLE</div></div>
      </div>
      ${edgeRail('T-MOBILE PARK &#183; GAME 1 OF 2', `<span style="display:flex;align-items:center;gap:6px"><span style="${mono(10, { wt: 700, ls: '0.16em', color: SIGNAL })}">2 GAMES</span></span>`)}`)}
  </div>

  <div style="display:flex;align-items:center;gap:10px;padding:20px 18px 9px">
    <span style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.74)' })}">MiLB &#183; NO COLOURS, NO LOGO, NO LINEUP</span>
    <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
  </div>
  <!-- 50 of the 117 MiLB clubs in the repo's own table have a primary under
       L 0.02 (four are literally #000000) and 107 of 117 are flagged
       "confidence: medium". A band whose whole premise is club colour needs a
       drawing for the case where the colour is missing or untrustworthy: the
       type carries it, on the page's own ground, with a hairline frame. -->
  ${plainBand(88, 'transparent', `
    <span style="position:absolute;inset:0;border:1px solid rgba(255,255,255,.34)"></span>
    <span style="position:absolute;left:calc(45% + 2px);top:0;bottom:30px;width:1px;background:rgba(255,255,255,.34)"></span>
    <div style="position:absolute;left:0;right:0;top:0;height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 20px">
      <div><div style="${disp(30)};color:#fff">RC</div><div style="${mono(10, { ls: '0.18em', color: 'rgba(255,255,255,.6)' })};margin-top:4px">SACRAMENTO</div></div>
      <div style="text-align:right"><div style="${disp(27)};color:#fff">LV</div><div style="${mono(10, { ls: '0.18em', color: 'rgba(255,255,255,.6)' })};margin-top:4px">LAS VEGAS</div></div>
    </div>
    ${edgeRail('LAS VEGAS BALLPARK &#183; LINEUP NOT POSTED', `<span style="${mono(10, { wt: 700, ls: '0.18em', color: 'rgba(255,255,255,.62)' })}">9:05</span>`)}`)}

  <div style="display:flex;align-items:center;gap:10px;padding:20px 18px 9px">
    <span style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.74)' })}">LONG NAMES, ON THE POSTER</span>
    <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
  </div>
  <div style="padding:2px 20px 0">
    ${[['RAYS', T.TB.p], ['GUARDIANS', T.CLE.p], ['DIAMONDBACKS', T.ARI.p], ['RUMBLE PONIES', '#1F3A5F']].map(([nick, col]) => `
    <div style="display:flex;align-items:baseline;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.075)">
      <span style="width:14px;height:14px;background:${col};flex:none"></span>
      <span style="${disp(nickSize(nick))};color:#fff;white-space:nowrap;overflow:hidden">${nick}</span>
      <span style="${mono(10, { ls: '0.1em', color: 'rgba(255,255,255,.5)' })};margin-left:auto;flex:none">${nickSize(nick)}PX</span>
    </div>`).join('')}
    <div style="${mono(10, { ls: '0.12em', color: 'rgba(255,255,255,.6)' })};padding:11px 0 0;line-height:1.8">SIZE STEPS BY NAME LENGTH &#183; 74 / 62 / 52 / 44</div>
  </div>
</div>
` + tail

  return { feedLight, inningsOpen, boxOpen, edges }
}

/* ======================================================= THE MINOR LEAGUES
   The case for putting the art back, made where it is strongest.

   MiLB has the best logo work in American sport, and a design premised on club
   COLOUR was quietly throwing all of it away — which matters more down here
   than in MLB, because a Double-A club's mark is doing the job its colours
   cannot: 50 of the 117 clubs in the repo's own table have a primary under
   L 0.02 (four are literally #000000) and 107 of 117 are flagged
   "confidence: medium". The colour data is the untrustworthy part. The art is
   not. So the mark stops being texture and starts being the thing you scan. */

export function milbArtboards(k) {
  const { SIGNAL, INK, head, tail, disp, mono, sealGlyph, nickSize, contrast, baseTileSrc } = k
  const onField = (c) => (contrast('#FFFFFF', c) >= 3.4 ? '#FFFFFF' : '#0A0B0D')
  const dimOn = (c) => (contrast('#FFFFFF', c) >= 3.4 ? 'rgba(255,255,255,.8)' : 'rgba(10,11,13,.72)')

  // Colours from src/lib/data/milb-colors.json (`pair`), marks from the same
  // CDN the app already uses for every other club.
  const M = {
    BNG: { city: 'Binghamton',  nick: 'Rumble Ponies', p: '#bc0b35', s: '#0f213e', logo: 'rumble.svg' },
    HFD: { city: 'Hartford',    nick: 'Yard Goats',    p: '#002c76', s: '#009a49', logo: 'yardgoats.svg' },
    RCT: { city: 'Rocket City', nick: 'Trash Pandas',  p: '#e93c49', s: '#3378c2', logo: 'pandas.svg' },
    MTG: { city: 'Montgomery',  nick: 'Biscuits',      p: '#febe28', s: '#0b2b76', logo: 'biscuits.svg' },
    AMA: { city: 'Amarillo',    nick: 'Sod Poodles',   p: '#003A70', s: '#00A9E0', logo: 'sodpoodles.svg' },
    RIC: { city: 'Richmond',    nick: 'Flying Squirrels', p: '#c8102e', s: '#231f20', logo: 'squirrels.svg' },
    JAX: { city: 'Jacksonville', nick: 'Jumbo Shrimp', p: '#002D62', s: '#007DC3', logo: 'shrimp.svg' },
    ELP: { city: 'El Paso',     nick: 'Chihuahuas',    p: '#000000', s: '#A71930', logo: 'chihuahuas.svg' },
    TOL: { city: 'Toledo',      nick: 'Mud Hens',      p: '#002A5C', s: '#E71629', logo: 'mudhens.svg' },
    POR: { city: 'Portland',    nick: 'Sea Dogs',      p: '#e03a3e', s: '#003263', logo: 'seadogs.svg' },
  }
  const MG = [
    { a: 'BNG', h: 'HFD', t: '6:05', park: 'Dunkin’ Park', state: 'live' },
    { a: 'RCT', h: 'MTG', t: '6:35', park: 'Riverwalk Stadium', state: 'live' },
    { a: 'RIC', h: 'POR', t: '6:00', park: 'Hadlock Field', state: 'live' },
    { a: 'AMA', h: 'ELP', t: '7:05', park: 'Southwest University Park', state: 'pre' },
    { a: 'JAX', h: 'TOL', t: '6:05', park: 'Fifth Third Field', state: 'sealed' },
  ]
  const H = { live: 118, pre: 88, sealed: 68 }
  const SCRIM = { live: null, pre: 'rgba(10,11,13,.16)', sealed: 'rgba(10,11,13,.46)' }

  const patch = (t, size, colour) => baseTileSrc(M[t].logo, size, { colour })

  const band = (game) => {
    const A = M[game.a]
    const Hm = M[game.h]
    const h = H[game.state]
    const big = h >= 108
    const mid = h >= 88
    const rail = big ? 32 : 30
    const size = big ? 48 : mid ? 36 : 28
    const wedge = 'polygon(0 0, 100% 0, calc(100% - 38px) 100%, 0 100%)'
    return `
    <article style="position:relative;height:${h}px;overflow:hidden;background:${Hm.p};border-bottom:1px solid rgba(255,255,255,.16)">
      <div style="position:absolute;inset:0;width:calc(45% + 6px);background:#FFFFFF;clip-path:${wedge}"></div>
      <div style="position:absolute;inset:0;width:calc(45% + 2px);background:${A.s};clip-path:${wedge}"></div>
      <div style="position:absolute;inset:0;width:45%;background:${A.p};clip-path:${wedge}"></div>
      ${SCRIM[game.state] ? `<span style="position:absolute;inset:0;background:${SCRIM[game.state]}"></span>` : ''}
      <div style="position:absolute;left:0;right:0;top:0;height:${h - rail}px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;max-width:calc(45% - 24px)">
          ${patch(game.a, size, false)}
          <div style="min-width:0">
            <div style="${disp(big ? 44 : mid ? 34 : 27)};color:${onField(A.p)}">${game.a}</div>
            ${mid ? `<div style="${mono(8, { ls: '0.2em' })};color:${dimOn(A.p)};margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${A.city}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <div style="text-align:right;min-width:0">
            <div style="${disp(big ? 39 : mid ? 30 : 24)};color:${onField(Hm.p)}">${game.h}</div>
            ${mid ? `<div style="${mono(8, { ls: '0.2em' })};color:${dimOn(Hm.p)};margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Hm.city}</div>` : ''}
          </div>
          ${patch(game.h, size, false)}
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:${rail}px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 18px;background:${INK}">
        <span style="${mono(8, { ls: '0.15em', color: 'rgba(255,255,255,.74)' })};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${game.park}</span>
        <span style="flex:none">${
          game.state === 'live'
            ? `<span style="display:flex;align-items:center;gap:6px"><span class="pulse" style="width:6px;height:6px;border-radius:50%;background:${SIGNAL}"></span><span style="${mono(10, { wt: 700, ls: '0.18em', color: SIGNAL })}">LIVE</span></span>`
            : game.state === 'sealed'
              ? `<span style="display:flex;align-items:center;gap:5px">${sealGlyph('rgba(255,255,255,.8)', 10)}<span style="${mono(10, { wt: 700, ls: '0.18em', color: 'rgba(255,255,255,.8)' })}">SEALED</span></span>`
              : `<span style="${mono(10, { wt: 700, ls: '0.18em', color: 'rgba(255,255,255,.8)' })}">${game.t}</span>`
        }</span>
      </div>
    </article>`
  }

  const milbFeed = head() + `
<div style="position:relative;width:390px;background:${INK};overflow:hidden">
  <header style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px 10px;border-bottom:1px solid rgba(255,255,255,.12)">
    <span style="${disp(23, { w: 66, ls: '0.005em' })};color:#fff">TAL<span style="color:${SIGNAL}">1</span>Y</span>
    <span style="${mono(10, { ls: '0.22em', color: 'rgba(255,255,255,.62)' })}">SAT 22 AUG</span>
  </header>
  <nav style="display:flex;align-items:center;gap:2px;padding:0 14px;border-bottom:1px solid rgba(255,255,255,.12)">
    ${['MLB', 'AAA', 'AA', 'A+', 'A'].map((lv) => `
    <span style="display:grid;place-items:center;min-width:46px;height:44px;${lv === 'AA' ? `background:${SIGNAL};` : ''}">
      <span style="${mono(10, { wt: 700, ls: '0.14em', color: lv === 'AA' ? INK : 'rgba(255,255,255,.6)' })}">${lv}</span>
    </span>`).join('')}
  </nav>
  <div style="display:flex;align-items:center;gap:10px;padding:11px 18px 10px;background:rgba(255,255,255,.035)">
    <span style="${mono(10, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.74)' })}">DOUBLE-A</span>
    <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
  </div>
${MG.map(band).join('')}
  <div style="padding:16px 18px 20px">
    <div style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.62)' })};line-height:1.9">THE COLOUR DATA DOWN HERE IS THE UNRELIABLE PART &#8212; 107 OF 117 CLUBS ARE FLAGGED &#8220;CONFIDENCE: MEDIUM&#8221; IN THE REPO&#8217;S OWN TABLE. THE ART IS NOT. LEAN ON IT.</div>
  </div>
</div>
` + tail

  // The payoff, at the level where it matters most.
  const PA = M.BNG
  const PH = M.HFD
  const milbPoster = head() + `
<div style="position:relative;width:390px;height:844px;background:${PH.p};overflow:hidden">
  <img src="${PH.logo}" alt="" style="position:absolute;right:-120px;bottom:26px;height:420px;filter:brightness(0) invert(1);opacity:.15" />
  <div style="position:absolute;inset:0;background:#FFFFFF;clip-path:polygon(0 0, 100% 0, 100% 27.6%, 0 69.8%)"></div>
  <div style="position:absolute;inset:0;background:${PA.p};clip-path:polygon(0 0, 100% 0, 100% 26.7%, 0 68.9%)"></div>
  <img src="${PA.logo}" alt="" style="position:absolute;left:-96px;top:-40px;height:380px;filter:brightness(0) invert(1);opacity:.15" />

  <div style="position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;padding:20px">
    <span style="${mono(8.5, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.8)' })}">&#8249; SAT 22 AUG &#183; DOUBLE-A</span>
    <span style="display:flex;align-items:center;gap:7px;background:${INK};padding:5px 9px 4px">
      <span class="pulse" style="width:6px;height:6px;border-radius:50%;background:${SIGNAL}"></span>
      <span style="${mono(10, { wt: 700, ls: '0.18em', color: SIGNAL })}">LIVE NOW</span>
    </span>
  </div>

  <div style="position:absolute;left:22px;top:86px;display:flex;align-items:flex-start;gap:18px">
    ${patch('BNG', 104, true)}
    <div style="padding-top:3px;min-width:0">
      <div style="${mono(8.5, { wt: 700, ls: '0.3em', color: 'rgba(255,255,255,.78)' })};margin-bottom:9px">VISITOR</div>
      <div style="${disp(25, { w: 68, wt: 800 })};color:rgba(255,255,255,.82)">${PA.city}</div>
      <div style="${disp(Math.min(nickSize(PA.nick), 44))};color:#fff;margin-top:2px">${PA.nick}</div>
    </div>
  </div>

  <div style="position:absolute;left:0;right:0;top:322px;display:flex;justify-content:center;pointer-events:none">
    <span style="${disp(118, { w: 84, ls: '0' })};color:transparent;-webkit-text-stroke:2.5px rgba(255,255,255,.55)">@</span>
  </div>

  <div style="position:absolute;right:22px;top:434px;display:flex;align-items:flex-start;gap:18px">
    <div style="text-align:right;padding-top:3px;min-width:0">
      <div style="${mono(8.5, { wt: 700, ls: '0.3em', color: 'rgba(255,255,255,.78)' })};margin-bottom:9px">HOME</div>
      <div style="${disp(25, { w: 68, wt: 800 })};color:rgba(255,255,255,.82)">${PH.city}</div>
      <div style="${disp(Math.min(nickSize(PH.nick), 48))};color:#fff;margin-top:2px">${PH.nick}</div>
    </div>
    ${patch('HFD', 104, true)}
  </div>

  <div style="position:absolute;left:0;right:0;bottom:0">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:${INK};padding:14px 20px 13px">
      <div style="min-width:0">
        <div style="${mono(11, { wt: 700, ls: '0.1em', color: '#fff' })}">6:05 PM ET</div>
        <div style="${mono(10, { ls: '0.14em', color: 'rgba(255,255,255,.66)' })};margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">DUNKIN&#8217; PARK &#183; HARTFORD &#183; EASTERN LEAGUE</div>
      </div>
      <span style="flex:none;display:flex;align-items:center;gap:6px;border:1px solid rgba(233,218,0,.5);color:${SIGNAL};padding:7px 9px 6px">
        ${sealGlyph(SIGNAL, 10)}<span style="${mono(8.5, { wt: 700, ls: '0.16em' })}">SEALED</span>
      </span>
    </div>
    <nav style="display:grid;grid-template-columns:repeat(5, minmax(0, 1fr));background:${INK};border-top:1px solid rgba(255,255,255,.16)">
      ${[['BNG', PA.p], ['HFD', PH.p], ['INNINGS', null], ['BOX', null], ['CARD', null]].map(([l, c], i) => `
      <span style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;height:58px;${i ? 'border-left:1px solid rgba(255,255,255,.12);' : ''}">
        <span style="width:18px;height:3px;background:${c || 'rgba(255,255,255,.16)'}"></span>
        <span style="${disp(15, { w: 76, wt: 800 })};color:rgba(255,255,255,.6)">${l}</span>
      </span>`).join('')}
    </nav>
  </div>
</div>
` + tail

  return { milbFeed, milbPoster }
}
