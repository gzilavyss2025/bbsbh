// The chosen flow: direction A (Marquee) as the feed, opening into direction D
// (the poster), which is the door into lineups -> innings -> box score.
//
// Exported as one function so build.mjs stays the single entry point and both
// files share ONE set of helpers, colours and slate data — a second copy of
// disp()/mono()/SIGNAL would drift the moment either file was edited.

export function flowArtboards(k) {
  const { T, GAMES, g, SIGNAL, INK, head, tail, disp, mono, ghost, liveDot, sealGlyph,
          starGlyph, masthead, dayrail, sectionRule, marqueeBand, nickSize, liveChip, chestMark, colourMark } = k

  /* ------------------------------------------------------------ shared bits */

  // Bands or lines. The honest answer to direction A's one real cost: a
  // 118px band shows five games where a 56px line shows eleven, so the reader
  // gets the switch rather than an argument about which is right.
  const densityToggle = `
    <span style="display:flex;flex:none;border:1px solid rgba(255,255,255,.28)">
      <span style="display:grid;place-items:center;width:44px;height:32px;background:${SIGNAL}">
        <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true"><rect width="12" height="4" fill="${INK}"/><rect y="6" width="12" height="4" fill="${INK}"/></svg>
      </span>
      <span style="display:grid;place-items:center;width:44px;height:32px">
        <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true"><rect y="0.4" width="12" height="1.5" fill="rgba(255,255,255,.5)"/><rect y="4.2" width="12" height="1.5" fill="rgba(255,255,255,.5)"/><rect y="8" width="12" height="1.5" fill="rgba(255,255,255,.5)"/></svg>
      </span>
    </span>`

  // The five doors out of a game — the same set the app's tab row already has
  // (away club, home club, innings, box, scorecard). On the poster this row IS
  // the call to action; on the screens behind it, it is the nav.
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

  // The seal, in this language. The paper app tapes a game shut with kraft
  // amber; here the seal is the ground itself, hatched in the one signal
  // colour — same promise (nothing under this can spoil you until you say so),
  // stated in the palette the rest of the screen is drawn in.
  const sealSlab = (title, sub, h = 232) => `
    <div style="position:relative;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;background:#101216;border:1px solid rgba(233,218,0,.34);overflow:hidden">
      <span class="hatch"></span>
      <span style="position:relative">${sealGlyph(SIGNAL, 30)}</span>
      <span style="position:relative;${disp(27, { w: 74, wt: 900 })};color:${SIGNAL}">${title}</span>
      <span style="position:relative;${mono(8.5, { ls: '0.18em', color: 'rgba(255,255,255,.66)' })};text-align:center;max-width:250px;line-height:1.7">${sub}</span>
    </div>`

  // Nine innings, two halves each: filled where you have already broken the
  // seal, hollow where you have not. It draws a fact the app already keeps
  // (revealedThrough) and the box score already states in a sentence — the
  // point of drawing it is that "how far in am I" is the one question a
  // second-screen scorer asks between pitches.
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

  /* -------------------------------------------------- MAIN — the feed (A)
     The WHOLE fifteen-game slate, not the four games that made the first cut
     look roomy. The dashed rule marks the iPhone fold, so the density question
     is answered by looking rather than by a claim. */
  const fold = `
  <div style="position:absolute;left:0;right:0;top:844px;height:0;pointer-events:none;z-index:9">
    <div style="border-top:1px dashed rgba(255,255,255,.5)"></div>
    <span style="position:absolute;right:8px;top:5px;${mono(9, { wt: 700, ls: '0.18em', color: 'rgba(255,255,255,.6)' })}">FOLD &#183; IPHONE 14 PRO</span>
  </div>`
  const main = head() + `
<div style="position:relative;width:390px;background:${INK};overflow:hidden">
${fold}
${masthead()}
${dayrail()}
${sectionRule('YOUR CLUB', '01')}
${marqueeBand(g('ATL', 'MIL'), 118)}
${sectionRule('ON NOW', '08', densityToggle)}
${GAMES.slice(0, 8).map((x) => marqueeBand(x)).join('')}
${sectionRule('FIRST PITCH TO COME', '03')}
${GAMES.slice(8, 11).map((x) => marqueeBand(x)).join('')}
${sectionRule('EARLIER TODAY &#183; TAP TO UNSEAL', '04')}
${GAMES.slice(12, 15).map((x) => marqueeBand(x)).join('')}
</div>
` + tail

  /* ------------------------------------------- OPENING — the A → D motion
     The band and the poster are the SAME composition at two scales, which is
     why one can become the other: the band's wedge and the poster's diagonal
     are one clip-path with one set of four points, and the whole opening is
     that path travelling. Nothing cross-fades except the type, which has to —
     TB is not RAYS. */
  const OP = g('TB', 'BAL')
  const OA = T[OP.a]
  const OH = T[OP.h]
  const HERO_TOP = 132
  const BAND_H = 118
  // 3.2s loop, 440ms of it moving. The first cut ran nine beats from 5% to 64%
  // of a 5.4s loop — 3.19 SECONDS, against an iOS push of 350ms — and animated
  // `top` and `height` on a full-bleed element carrying two 74px strings and
  // two 400px images, which is layout and paint every frame. Three beats now,
  // on clip-path and opacity only, and the band expands OVER the list instead
  // of clearing it: a tap on game 12 of 15 would have split the slate in half
  // and thrown eleven bands upward, which is motion nobody asked for.
  const opening = head(`
    /* The hero is ALWAYS full height and full poster layout; the feed state is
       a clip. Un-clipping is one interpolated inset() — no geometry changes, so
       nothing reflows. */
    @keyframes op-open {
      0%, 12% { clip-path: inset(${HERO_TOP}px 0 ${844 - HERO_TOP - BAND_H}px 0) }
      26%, 92% { clip-path: inset(0px 0 0px 0) }
      92.01%, 100% { clip-path: inset(${HERO_TOP}px 0 ${844 - HERO_TOP - BAND_H}px 0) }
    }
    /* The band's own type and the poster's overlap deliberately: there is never
       a frame with neither, which is what left a 600px hole in the first cut. */
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
    /* There is no slower version of a screen opening; there is opening or
       already open. Reduced motion gets the destination, held. */
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
${sectionRule('ON NOW', '08', densityToggle)}
  </div>

  <div class="op-rest" style="position:absolute;left:0;right:0;top:${HERO_TOP + BAND_H}px;z-index:1">
${GAMES.slice(1, 6).map((x) => marqueeBand(x)).join('')}
  </div>

  <!-- Full-height poster, clipped down to the band. The wedge and the diagonal
       are the same four-point path at two scales, so this ONE element is both
       states — that is why the band can become the poster at all. -->
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
          <div style="${mono(10, { ls: '0.18em', color: 'rgba(255,255,255,.86)' })};margin-top:5px">${OA.city}</div>
        </div>
      </div>
      <div style="position:absolute;right:18px;top:18px;display:flex;align-items:center;gap:10px">
        <div style="text-align:right">
          <div style="${disp(39)};color:#fff">${OP.h}</div>
          <div style="${mono(10, { ls: '0.18em', color: 'rgba(255,255,255,.86)' })};margin-top:5px">${OH.city}</div>
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

  <!-- THE ART, IN COLOUR. This is the one screen where a club's own mark is the
       loudest object rather than a texture behind the type — and the reason the
       feed shows a grayscale patch: opening a game is where the logo inks in. -->
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

  /* --------------------------------------------------------- LINEUPS (ATH) */
  const ATH_ORDER = [
    ['1', 'BOLTE', 'HENRY', '33', 'CF', '.264'],
    ['2', 'McNEIL', 'JEFF', '22', '2B', '.263'],
    ['3', 'GELOF', 'ZACK', '20', '3B', '.262'],
    ['4', 'WILLIAMS', 'ALIKA', '12', 'PH', '.261'],
    ['5', 'BUTLER', 'LAWRENCE', '4', 'RF', '.217'],
    ['6', 'WHITE', 'TOMMY', '47', '1B', '.259'],
    ['7', 'HEIM', 'JONAH', '15', 'C', '.205'],
    ['8', 'WALTON', 'DONOVAN', '29', 'SS', '.285'],
    ['9', 'MUNCY', 'MAX', '3', 'DH', '.215'],
  ]
  const lineups = head() + `
<div style="position:relative;width:390px;height:844px;background:${INK};overflow:hidden;display:flex;flex-direction:column">
${gameHeader(PG.a, PG.h, 'TOP 1ST')}

  <!-- Themed to the jersey this club is wearing tonight, the way the paper app
       already themes its club bar. Identity, never game state. -->
  <div style="position:relative;background:${PA.p};padding:20px 20px 18px;overflow:hidden;flex:none">
    ${ghost(PG.a, 'right:-40px;top:-34px;height:200px;opacity:.16')}
    <div style="position:relative">
      <div style="${mono(8.5, { wt: 700, ls: '0.3em', color: 'rgba(255,255,255,.74)' })};margin-bottom:8px">VISITOR</div>
      <div style="${disp(46)};color:#fff">${PA.city}</div>
    </div>
  </div>

  <div style="flex:1;overflow:hidden">
    <div style="display:flex;align-items:center;gap:12px;padding:16px 20px 11px">
      <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">STARTING PITCHER</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
    </div>
    <div style="display:flex;align-items:center;gap:14px;padding:0 20px 16px">
      <span style="${disp(40, { w: 70, wt: 900 })};color:${SIGNAL};min-width:44px">57</span>
      <div style="min-width:0;flex:1">
        <div style="${disp(26, { w: 70, wt: 800 })};color:#fff">LOPEZ, JACOB</div>
        <div style="${mono(8, { ls: '0.17em', color: 'rgba(255,255,255,.64)' })};margin-top:5px">LHP &#183; 5&#8211;4 &#183; 4.98 ERA &#183; 118.2 IP</div>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:12px;padding:6px 20px 9px">
      <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">BATTING ORDER</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
      <span style="${mono(8, { ls: '0.14em', color: 'rgba(255,255,255,.6)' })}">AVG</span>
    </div>
${ATH_ORDER.map(([n, last, first, num, pos, avg]) => `
    <div style="display:grid;grid-template-columns:19px minmax(0,1fr) 30px 46px;gap:12px;align-items:center;height:52px;padding:0 20px;border-bottom:1px solid rgba(255,255,255,.075)">
      <span style="${mono(12, { wt: 700, ls: '0', color: SIGNAL })}">${n}</span>
      <span style="min-width:0">
        <span style="${disp(20, { w: 74, wt: 800 })};color:#fff;display:block">${last}</span>
        <span style="${mono(7.5, { ls: '0.16em', color: 'rgba(255,255,255,.62)' })};display:block;margin-top:3px">${first} &#183; #${num}</span>
      </span>
      <span style="${mono(9, { wt: 700, ls: '0.1em', color: 'rgba(255,255,255,.78)' })};text-align:center">${pos}</span>
      <span style="${mono(12, { wt: 500, ls: '0.02em', color: 'rgba(255,255,255,.85)' })};text-align:right;font-variant-numeric:tabular-nums">${avg}</span>
    </div>`).join('')}
  </div>

${doorRow('away', PG.a, PG.h)}
</div>
` + tail

  /* ---------------------------------------------------------- INNINGS (top 1st) */
  const diamond = `
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" style="flex:none">
      <g transform="rotate(45 28 28)">
        <rect x="30" y="30" width="13" height="13" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="1.6"/>
        <rect x="13" y="30" width="13" height="13" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="1.6"/>
        <rect x="13" y="13" width="13" height="13" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="1.6"/>
        <rect x="30" y="13" width="13" height="13" fill="${SIGNAL}"/>
      </g>
    </svg>`
  const innings = head() + `
<div style="position:relative;width:390px;height:844px;background:${INK};overflow:hidden;display:flex;flex-direction:column">
${gameHeader(PG.a, PG.h, 'LIVE')}

  <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.12);flex:none">
    <span style="${mono(9, { wt: 700, ls: '0.16em', color: 'rgba(255,255,255,.62)' })}">&#8249; BOT 1ST</span>
    <span style="${disp(24, { w: 76, wt: 900 })};color:#fff">TOP 2ND</span>
    <span style="${mono(9, { wt: 700, ls: '0.16em', color: 'rgba(255,255,255,.62)' })}">BOT 2ND &#8250;</span>
  </div>

  <div style="flex:1;overflow:hidden;padding:0 20px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 0 16px;border-bottom:1px solid rgba(255,255,255,.09)">
      <div style="min-width:0">
        <div style="${mono(8, { wt: 700, ls: '0.24em', color: SIGNAL })};margin-bottom:8px">NOW BATTING &#183; 4TH</div>
        <div style="${disp(34, { w: 70 })};color:#fff">WILLIAMS</div>
        <div style="${mono(8, { ls: '0.17em', color: 'rgba(255,255,255,.64)' })};margin-top:6px">ALIKA &#183; #12 &#183; .261 &#183; VS BROWN, RHP</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px;flex:none">
        ${diamond}
        <span style="display:flex;gap:5px">
          <span style="width:7px;height:7px;border-radius:50%;background:${SIGNAL}"></span>
          <span style="width:7px;height:7px;border-radius:50%;border:1.4px solid rgba(255,255,255,.4)"></span>
        </span>
        <span style="${mono(7.5, { ls: '0.18em', color: 'rgba(255,255,255,.62)' })}">1 OUT &#183; 2&#8211;1</span>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:12px;padding:16px 0 11px">
      <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">RUNS THIS HALF</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
    </div>
${sealSlab('TAP TO REVEAL', 'This half only. Nothing else on the page moves,<br />and the innings after it stay shut.', 212)}

    <div style="display:flex;align-items:center;gap:12px;padding:18px 0 11px">
      <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">DUE UP</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:9px">
${[['5', 'BUTLER', '.217'], ['6', 'WHITE', '.259'], ['7', 'HEIM', '.205']].map(([n, last, avg]) => `
      <div style="border:1px solid rgba(255,255,255,.14);padding:10px 11px 11px">
        <div style="${mono(8, { wt: 700, ls: '0.14em', color: SIGNAL })}">${n}</div>
        <div style="${disp(18, { w: 72, wt: 800 })};color:#fff;margin-top:7px">${last}</div>
        <div style="${mono(8, { ls: '0.1em', color: 'rgba(255,255,255,.62)' })};margin-top:5px">${avg}</div>
      </div>`).join('')}
    </div>

    <div style="display:flex;align-items:center;gap:12px;padding:20px 0 12px">
      <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">YOUR SCOREBOOK</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
      <span style="${mono(8, { ls: '0.14em', color: 'rgba(255,255,255,.6)' })}">3 OF 18 HALVES</span>
    </div>
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
  const boxscore = head() + `
<div style="position:relative;width:390px;height:844px;background:${INK};overflow:hidden;display:flex;flex-direction:column">
${gameHeader(PG.a, PG.h, 'LIVE')}

  <div style="flex:1;overflow:hidden;padding:0 20px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;padding:22px 0 16px">
      <span style="${disp(34, { w: 72 })};color:#fff">BOX SCORE</span>
      <span style="${mono(8, { ls: '0.16em', color: 'rgba(255,255,255,.62)' })};padding-bottom:5px">AS OF 9:26 PM</span>
    </div>

${sealSlab('TAP TO REVEAL', 'The whole box score, all at once. Once you open it,<br />it stays open &#8212; on this phone and every device you own.', 392)}

    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid rgba(255,255,255,.16);padding:15px 16px;margin-top:14px">
      <div style="min-width:0">
        <div style="${mono(8, { wt: 700, ls: '0.22em', color: 'rgba(255,255,255,.62)' })}">NEW TO THIS?</div>
        <div style="${disp(21, { w: 74, wt: 800 })};color:#fff;margin-top:7px">HOW TO READ A BOX SCORE</div>
      </div>
      <span style="${mono(15, { wt: 400, ls: '0', color: 'rgba(255,255,255,.66)' })};flex:none">&#8250;</span>
    </div>

    <div style="display:flex;align-items:center;gap:12px;padding:22px 0 12px">
      <span style="${mono(8.5, { wt: 700, ls: '0.24em', color: 'rgba(255,255,255,.74)' })}">YOUR SCOREBOOK</span>
      <span style="flex:1;height:1px;background:rgba(255,255,255,.14)"></span>
      <span style="${mono(8, { ls: '0.14em', color: 'rgba(255,255,255,.6)' })}">THROUGH TOP 2ND</span>
    </div>
${revealRail(3)}

    <div style="display:flex;align-items:center;justify-content:center;gap:9px;height:50px;margin-top:22px;border:1px solid rgba(255,255,255,.2)">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M10.4 6a4.4 4.4 0 1 1-1.3-3.1M10.4 1v2.6H7.8" stroke="rgba(255,255,255,.72)" stroke-width="1.3" stroke-linecap="square"/></svg>
      <span style="${mono(9, { wt: 700, ls: '0.2em', color: 'rgba(255,255,255,.72)' })}">REFRESH</span>
    </div>
  </div>

${doorRow('box', PG.a, PG.h)}
</div>
` + tail

  // doorRow and gameHeader go out too: the revealed states in extras.mjs are
  // the same screens, so they must be the same chrome, not a second copy.
  return { main, opening, poster, lineups, innings, boxscore, doorRow, gameHeader, revealRail }
}
