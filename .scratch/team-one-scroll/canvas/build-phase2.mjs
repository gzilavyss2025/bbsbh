// PHASE 2 — the settled band system extended past the Standing band it was
// chosen on: the two hard heads (Ranks at Single-A, About with four unlike
// modules), the jump bar, and the FULL PAGES at true proportion.
//
//   node .scratch/team-one-scroll/canvas/build-phase2.mjs
//
// The band furniture comes from system.mjs, which build.mjs also draws from, so
// there is one band head on this canvas and not two.
//
// WHAT IS REAL AND WHAT IS SHAPE, stated once rather than implied:
//   - Every band head, sub-head, seam and jump bar is the real thing.
//   - Every card is at its MEASURED height, taken off the running page on
//     2026-09-21 with ../page-shape.mjs. The page totals are the sum.
//   - The cards this study designs or re-draws — the standings, the reorganised
//     Records, the leaders ledger, and all four About modules — carry their real
//     content, scraped with ../scrape-phase2.mjs.
//   - The remaining ~20 cards are drawn as their true SHAPE at their true
//     height. They are shipped cards and design.md §4 changes nothing about
//     them; what a full-page board is for is the band furniture at page scale.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOKENS as T, CLUBS } from './data.mjs'
import {
  W, SEAM, CARDGAP, esc, SYSTEM_SHEET, STANDFIRST, bandHead, subHead, seam,
  chead, card, jumpBar, BANDS, page, CLUB, addClub,
} from './system.mjs'
import { recordsCard as recordsIndex, SHEET as RECORDS_SHEET } from './records/build-records.mjs'
import {
  LEDGER_249, LEDGER_556, LEDGER_675, ABS_556, BALLPARK, JERSEYS, AFFIL_HISTORY_249, ALUMNI_249,
  STANDINGS, PAGE, WINTER_LINEUP, WINTER_ARMS, CLUB_556,
} from './data-phase2.mjs'

addClub(556, CLUB_556)

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'project')
mkdirSync(OUT, { recursive: true })

/* -------------------------------------------------------------- the sheet
   Every value is a token from src/tokens/*.css at its literal value, and every
   size is one of design.md §5's ten. No eleventh, and no new token. */
const SHEET = SYSTEM_SHEET + `
/* A card pinned to its measured height. The body takes the rest and clips, so a
   board is at true proportion by construction rather than by estimate. */
.card--fixed{display:flex;flex-direction:column}
.card--fixed>.cbody{flex:1 1 auto;overflow:hidden;min-height:0}

/* ---- tables ---- */
table{width:100%;border-collapse:collapse}
th{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.09em;color:${T.graphite};text-align:right;padding:6px 3px;
  border-bottom:1px solid ${T.ruleSoft}}
th:first-child{text-align:left}
td{font-size:12px;padding:6px 3px;text-align:right;border-bottom:1px solid ${T.ruleGrid}}
td:first-child{text-align:left}
.tnum{font-family:'JetBrains Mono',monospace;font-size:11px;font-variant-numeric:tabular-nums}
.me{background:${T.fieldSoft}}
.cap{font-size:11px;color:${T.graphite};line-height:1.35}
.blurb{font-size:13px;line-height:1.45;color:${T.ink2};margin:0 0 10px}
.pill{display:inline-block;border:1px solid ${T.rule};border-radius:999px;padding:3px 10px;
  font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;background:${T.paper3};color:${T.ink1}}
.door{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;color:${T.field}}

/* ---- THE LEADERS LEDGER. Its head is a page-level group label with no card of
   its own, and its two sub-cards wear --accent-primary, the APP's navy — never
   the club's. On Wilson that puts an app-navy bar 16px under a club-navy one,
   and it is the clearest single instance of the head problem #1107 works
   through. ---- */
.ledg__head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:0 0 10px}
.ledg__title{font-family:'Barlow Condensed',sans-serif;font-size:14.4px;font-weight:700;
  text-transform:uppercase;letter-spacing:.09em;color:${T.ink0}}
.ledg__doors{display:flex;gap:12px}
.ledg__block{border:1px solid ${T.rule};border-radius:10px;background:${T.paper2};
  box-shadow:${T.shadowCard};overflow:hidden}
.ledg__block+.ledg__block{margin-top:10px}
.ledg__bt{margin:0;padding:6px 12px;background:${T.navy};color:${T.paper2};
  font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase}
.ledg__rows{list-style:none;margin:0;padding:0 12px 4px}
.ledg__row{display:flex;align-items:baseline;gap:10px;padding:7px 0;border-top:1px solid ${T.ruleGrid}}
.ledg__row:first-child{border-top:none}
.ledg__cat{flex:none;width:40px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;
  letter-spacing:.09em;color:${T.graphite};text-transform:uppercase}
.ledg__who{flex:1;min-width:0;display:flex;align-items:baseline;gap:6px}
.ledg__name{font-size:15px;color:${T.field};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ledg__pos{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:.09em;
  color:${T.graphite};text-transform:uppercase;flex:none}
.ledg__val{font-family:'JetBrains Mono',monospace;font-size:16px;color:${T.ink0};flex:none}

/* ---- ABOUT's four modules ---- */
.bp__photo{height:175px;background:${T.ruleGrid};border-radius:8px;display:flex;align-items:center;
  justify-content:center;color:${T.graphiteSoft};font-family:'Barlow Condensed',sans-serif;font-size:12px;
  letter-spacing:.09em;text-transform:uppercase}
.bp__name{margin:8px 0 0;font-size:15px;color:${T.ink0}}
.bp__facts{display:flex;justify-content:space-between;gap:8px;padding:5px 0;
  border-bottom:1px solid ${T.ruleGrid};font-size:12px}
.bp__facts b{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;color:${T.ink0}}
.bp__facts i{font-style:normal;font-size:11px;color:${T.graphite}}
.bp__gl{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.09em;color:${T.graphite};padding-top:12px;margin-top:12px;border-top:1px solid ${T.ruleSoft}}
.bp__dims{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.bp__dim{flex:1 1 0;text-align:center;border:1px solid ${T.ruleGrid};border-radius:6px;padding:5px 2px}
.bp__dim span{display:block;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;
  text-transform:uppercase;letter-spacing:.09em;color:${T.graphite}}
.bp__dim b{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;color:${T.ink0}}

.jd{display:flex;gap:10px;overflow:hidden}
.jd__card{flex:0 0 118px}
.jd__box{height:88px;background:${T.paper3};border:1px solid ${T.ruleGrid};border-radius:8px;
  display:flex;align-items:center;justify-content:center}
.jd__mark{width:46px;height:46px;border-radius:50%;background:${T.ruleGrid}}
.jd__name{display:block;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;
  text-transform:uppercase;letter-spacing:.06em;color:${T.ink1};margin-top:6px;line-height:1.15}
.jd__rec{display:block;font-family:'JetBrains Mono',monospace;font-size:16px;color:${T.ink0};margin-top:2px}

.ctl{display:flex;gap:10px;overflow:hidden}
.ctl__stop{flex:1 1 0;text-align:center}
.ctl__badge{width:42px;height:42px;margin:0 auto;border-radius:50%;background:${T.ruleGrid}}
.ctl__yrs{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;color:${T.graphite};margin-top:6px}

.alum__row{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid ${T.ruleGrid}}
.alum__row:first-child{border-top:none}
.alum__shot{flex:0 0 96px;height:117px;background:${T.ruleGrid};border-radius:6px}
.alum__name{font-size:15px;color:${T.field}}
.alum__ident{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;color:${T.graphite};margin-top:2px}
.alum__club{font-size:12px;color:${T.ink1};margin-top:2px}
.alum__stint{font-family:'JetBrains Mono',monospace;font-size:11px;color:${T.graphite};margin-top:4px}

/* ---- the shapes: a shipped card at its true height, drawn as what it is ---- */
.sh__row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;
  border-bottom:1px solid ${T.ruleGrid}}
.sh__l{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.04em;color:${T.ink1};flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap}
.sh__v{font-family:'JetBrains Mono',monospace;font-size:11px;color:${T.ink0};flex:0 0 auto}
.sh__grid{display:grid;gap:8px}
.sh__tile{border:1px solid ${T.ruleGrid};border-radius:6px;background:${T.paper3};padding:7px 8px}
.sh__tile b{display:block;font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:400;color:${T.ink0}}
.sh__tile span{display:block;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;
  text-transform:uppercase;letter-spacing:.09em;color:${T.graphite}}
.sh__rail{display:flex;gap:10px;overflow:hidden}
.sh__railc{flex:0 0 132px;background:${T.paper3};border:1px solid ${T.ruleGrid};border-radius:8px}
.sh__gl{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.09em;color:${T.graphite};padding-top:10px;margin-top:10px;border-top:1px solid ${T.ruleSoft}}
.sh__gl:first-child{padding-top:0;margin-top:0;border-top:none}
.sh__bar{height:10px;border-radius:2px;background:${T.ruleGrid};overflow:hidden}
.sh__bar i{display:block;height:100%;background:${T.field};opacity:.55}
.sh__plot{background:${T.paper3};border:1px solid ${T.ruleGrid};border-radius:6px;position:relative}
.sh__dot{position:absolute;width:7px;height:7px;border-radius:50%;background:${T.navy};opacity:.6}
.sh__ax{border-top:1px solid ${T.ruleSoft};margin-top:6px;padding-top:4px}

/* ---- the legend on a full-page board ---- */
.legend{margin:10px 0 0;padding:10px 12px;border:1px dashed ${T.rule};border-radius:6px;
  font-size:12px;line-height:1.45;color:${T.ink1};background:${T.paper2}}

/* ---- a board's own title. NOT the band head: a board is not a band, and
   using the band head to title one would put an eighth band on this canvas. ---- */
.boardtitle{font-family:'Barlow Condensed',sans-serif;font-size:21px;font-weight:700;letter-spacing:.05em;
  text-transform:uppercase;color:${T.ink0};margin:0 0 6px}
.boardsub{font-size:13px;line-height:1.45;color:${T.ink1};margin:0 0 24px}
code{font-family:'JetBrains Mono',monospace;font-size:11px;color:${T.ink0}}

/* ---- the jump bar's three states ---- */
/* A stage is FULL-BLEED so the bar gets the 358px a real page gives it — the
   first draft nested it inside two 16px gutters, starved it to 292px, and the
   floor's five pills clipped where the measurement says they fit. And it draws
   NO border: the difference between resting and stuck IS a 1px rule, so a box
   around both states hides the only thing the board is comparing. */
.stage{margin:0 -16px;background:${T.paper0}}
.statelabel{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.09em;color:${T.graphite};margin:0 0 6px}
.statenote{font-size:13px;line-height:1.45;color:${T.ink1};margin:8px 0 22px}
/* Stuck is the SAME bar with a rule under it and the page's own paper behind.
   No new shadow: this is paper, and a shadow is the card's device. */
.jump--rest{background:transparent;border-bottom:1px solid transparent}
`

/* ================================================================ the shapes
   ONE RULE, so a reader can tell at a glance what was measured and what was
   drawn: a shape card carries the card's true GEOMETRY at its true height, and
   its figures and names are GHOSTED.

   The first draft printed figures into them, and the floor page came back with
   Milwaukee's opponents on Los Mochis' schedule and Wilson's leaders under the
   winter club's head. A board that invents a figure is worse than a board that
   shows none, because this canvas's whole claim is that its numbers are real.

   What survives in a shape is the label the CARD's own design supplies and
   which is the same on every club — a position group, a day name, a month, a
   column head — because that is what makes a shape legible as that card rather
   than as a grey box. */
const px = (n) => `${Math.max(0, Math.round(n))}px`
// The cap is a runaway guard, not a row budget. It was 60, and the winter
// club's 2,387px 40-man — the largest card on any of these pages — stopped
// 600px short of its own height because of it.
const fit = (h, unit, max = 400) => Math.max(1, Math.min(max, Math.floor(h / unit)))
const gh = (w, h = 9) =>
  `<span style="display:inline-block;width:${w};height:${h}px;border-radius:2px;background:${T.ruleGrid}"></span>`

const rowsShape = (h, unit = 26, nameW = ['62%', '74%', '55%', '68%', '48%'], figW = '34px') => {
  const n = fit(h, unit)
  return Array.from({ length: n }, (_, i) =>
    `<div class="sh__row" style="padding:${px((unit - 15) / 2)} 0">
       <span class="sh__l">${gh(nameW[i % nameW.length], 10)}</span>
       <span class="sh__v">${gh(figW, 10)}</span></div>`).join('')
}

const groupedRows = (h, groups, unit = 24) => {
  const per = Math.max(1, Math.floor((fit(h, unit) - groups.length * 1.4) / groups.length))
  return groups.map((g) => `<div class="sh__gl">${esc(g)}</div>` + rowsShape(per * unit, unit)).join('')
}

const tilesShape = (h, cols, labels, unit = 54) => {
  const rows = Math.max(1, Math.floor(h / unit))
  return `<div class="sh__grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">` +
    Array.from({ length: rows * cols }, (_, i) =>
      `<div class="sh__tile"><span>${esc(labels[i % labels.length])}</span>
         <div style="margin:3px 0 2px">${gh('56%', 14)}</div>${gh('38%', 9)}</div>`).join('') + `</div>`
}

const railShape = (h, n = 4, w = 132) =>
  `<div class="sh__rail">` + Array.from({ length: n }, () =>
    `<div class="sh__railc" style="height:${px(h - 4)};flex:0 0 ${w}px"></div>`).join('') + `</div>`

const gridShape = (h, cols = 3, unit = 74) => {
  const rows = Math.max(1, Math.floor(h / (unit + 8)))
  return `<div class="sh__grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">` +
    Array.from({ length: rows * cols }, () =>
      `<div class="sh__tile" style="height:${px(unit)};padding:7px 6px">
         ${gh('58%', 9)}<div style="margin:6px 0 5px">${gh('72%', 12)}</div>${gh('46%', 9)}</div>`).join('') +
    `</div>`
}

const plotShape = (h, dots = 13) =>
  `<div class="sh__plot" style="height:${px(h)}">` +
  Array.from({ length: dots }, (_, i) =>
    `<span class="sh__dot" style="left:${8 + (i * 79) % 84}%;top:${14 + (i * 37) % 70}%"></span>`).join('') +
  `</div>`

const barsShape = (h, unit = 30, widths = [64, 38, 82, 51, 29]) => {
  const n = fit(h, unit)
  return Array.from({ length: n }, (_, i) =>
    `<div style="padding:${px((unit - 22) / 2)} 0">
       <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
         ${gh(['58%', '44%', '66%', '50%'][i % 4], 10)}${gh('34px', 10)}</div>
       <div class="sh__bar" style="margin-top:4px"><i style="width:${widths[i % widths.length]}%"></i></div>
     </div>`).join('')
}

/* The shape catalogue. Each entry is (bodyHeight, club) -> markup. */
const SHAPES = {
  teamscore: (h) => barsShape(h, 44),
  // The seven day names are the card's own design and are the same on every
  // club, so they stay; the records behind them are ghosted.
  dow: (h) => `<div class="sh__grid" style="grid-template-columns:repeat(7,minmax(0,1fr))">` +
    ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) =>
      `<div class="sh__tile" style="padding:6px 2px;text-align:center"><span>${d}</span>
         <div style="margin-top:4px">${gh('80%', 11)}</div></div>`).join('') +
    `</div><div style="margin-top:10px">${gh('64%', 9)}</div>`,
  comebacks: (h) => `<div style="margin-bottom:10px">${gh('88%', 11)}</div>` + barsShape(h - 40, 44),
  ranktiles: (h) => tilesShape(h, 2, ['RUNS', 'HR', 'AVG', 'OPS', 'SB', 'BB']),
  runvalue: (h) => `<div class="sh__bar" style="height:22px;margin-bottom:8px"><i style="width:68%"></i></div>` +
    `<div style="margin-bottom:10px">${gh('42%', 9)}</div>` + rowsShape(h - 96, 30) +
    `<div class="door" style="margin-top:10px">League run value board &rsaquo;</div>`,
  abs: (h) => `<div style="margin:2px 0 4px">${gh('34%', 30)}</div>${gh('56%', 9)}
    <div style="margin:6px 0 10px;display:flex;gap:6px">
      <span class="pill" style="background:${T.navy};color:${T.paper2};border-color:${T.navy}">At the plate</span>
      <span class="pill">Behind it</span></div>` + plotShape(178) +
    `<div class="sh__ax">${gh('60%', 9)}</div>` + rowsShape(h - 400, 27) +
    `<div class="door" style="margin-top:8px">League challenge board &rsaquo;</div>`,
  // A club's own months, because a winter club plays October to January and a
  // board that printed MAR-SEP on Los Mochis would be drawing Milwaukee again.
  schedule: (h, club) => {
    const months = club === 675
      ? ['OCT', 'NOV', 'DEC', 'JAN']
      : ['MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP']
    const on = months.length - 1
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">` +
      months.map((m, i) => `<span class="pill"${i === on
        ? ` style="background:${T.navy};color:${T.paper2};border-color:${T.navy}"` : ''}>${m}</span>`).join('') +
      `</div><div class="sh__grid" style="grid-template-columns:repeat(7,minmax(0,1fr))">` +
      Array.from({ length: Math.max(7, Math.floor((h - 70) / 46) * 7) }, () =>
        `<div class="sh__tile" style="height:40px;padding:6px 2px;display:flex;align-items:center;
           justify-content:center">${gh('60%', 10)}</div>`).join('') + `</div>`
  },
  rail: (h) => railShape(h),
  projection: (h) => `<div style="display:flex;gap:12px">
      <div style="flex:1 1 0">${rowsShape(Math.min(h - 8, 280), 30, ['70%', '58%', '64%', '52%'], '22px')}</div>
      <div style="flex:1 1 0"><div class="sh__gl">Starting Pitchers</div>
      ${rowsShape(Math.min(h - 46, 250), 30, ['66%', '74%', '58%'], '26px')}</div>
    </div>` + (h > 340 ? groupedRows(h - 320, ['Bench', 'Bullpen'], 28) : ''),
  bullpen: (h) => barsShape(h, 42),
  roster40: (h) => groupedRows(h, ['Pitchers', 'Catchers', 'Infielders', 'Outfielders'], 27),
  illist: (h) => rowsShape(h, 30),
  txdeck: (h) => railShape(h - 22, 3, 172) +
    `<div class="cap" style="margin-top:6px;text-align:right">&lsaquo; &rsaquo;</div>`,
  affiliates: (h) => rowsShape(h, 62, ['72%', '64%', '80%', '58%'], '30px'),
  horizon: (h) => rowsShape(h, 74, ['58%', '48%', '66%', '54%'], '58px'),
  prospects: (h) => rowsShape(h, 46, ['62%', '54%', '70%', '46%'], '18px'),
  depth: (h) => `<div class="sh__grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">` +
    ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].map((pos) =>
      `<div class="sh__tile" style="height:${px(Math.max(40, (h - 40) / 3 - 8))};padding:6px">
        <span>${pos}</span><div style="margin-top:5px">${gh('70%', 10)}</div></div>`).join('') + `</div>`,
  payroll: (h) => tilesShape(120, 2, ['ACTIVE', 'LUXURY TAX', 'DEAD MONEY', '2027 COMMITTED']) +
    `<div class="sh__gl">The commitment cliff</div>` + barsShape(160, 40) +
    `<div class="sh__gl">Every contract</div>` + rowsShape(h - 430, 30, ['64%', '52%', '72%'], '48px') +
    `<div class="cap" style="margin-top:10px">A season&rsquo;s book, not a day&rsquo;s &mdash; these figures do not move with a date.</div>`,
}

/* ============================================================ the real cards */
function standingsCard(club) {
  const S = STANDINGS[club]
  const odds = S.pill ? `<span class="pill" style="font-size:11px;padding:2px 8px">${esc(S.pill)}</span>` : ''
  const body = `<table><tr>${S.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>` +
    S.rows.map((r) => `<tr${r[9] ? ' class="me"' : ''}>` +
      `<td class="disp u" style="font-size:12px">${esc(r[0])}</td>` +
      r.slice(1, 9).map((v) => `<td class="tnum">${esc(v)}</td>`).join('') + `</tr>`).join('') + `</table>`
  return card(club, S.head, S.note ?? null, body, odds)
}

// The ledger, drawn as it ships: a page-level group label with two doors, over
// two sub-cards whose bars are the app's navy.
const LEDGERS = { 249: LEDGER_249, 556: LEDGER_556, 675: LEDGER_675 }
function ledgerCard(club, data = LEDGERS[club] ?? LEDGER_249) {
  const block = (name, rows) =>
    `<div class="ledg__block"><p class="ledg__bt">${esc(name)}</p><ul class="ledg__rows">` +
    rows.map(([cat, who, pos, val]) =>
      `<li class="ledg__row"><span class="ledg__cat">${esc(cat)}</span>
         <span class="ledg__who"><a href="#" class="ledg__name">${esc(who)}</a>
         <span class="ledg__pos">${esc(pos)}</span></span>
         <span class="ledg__val">${esc(val)}</span></li>`).join('') + `</ul></div>`
  return `<div class="ledg"><div class="ledg__head">
      <span class="ledg__title">${esc(data.title)}</span>
      <span class="ledg__doors">${data.doors.map((d) => `<a href="#" class="door">${esc(d)}</a>`).join('')}</span>
    </div>${block('Batting', data.batting)}${block('Pitching', data.pitching)}</div>`
}

function absCard(club) {
  const A = ABS_556
  const body = `<div style="font-family:'JetBrains Mono',monospace;font-size:34px;color:${T.ink0};line-height:1.1">${esc(A.rate)}</div>
    <div class="cap">${esc(A.unit)}</div>
    <div class="cap" style="color:${T.field};margin-top:2px">14 of 30 clubs</div>
    <div class="cap">${esc(A.league)}</div>
    <div style="display:flex;gap:6px;margin:10px 0">
      <span class="pill" style="background:${T.navy};color:${T.paper2};border-color:${T.navy}">${esc(A.views[0])}</span>
      <span class="pill">${esc(A.views[1])}</span></div>
    ${plotShape(183)}
    <div class="sh__ax cap" style="display:flex;justify-content:space-between"><span>${esc(A.axis[0])}</span><span>${esc(A.axis[1])}</span></div>
    <div class="cap">${esc(A.axisNote)}</div>
    <table style="margin-top:12px"><tr><th>${esc(A.cols[0])}</th>${A.cols.slice(1).map((c) => `<th>${esc(c)}</th>`).join('')}</tr>` +
    A.rows.map((r) => `<tr><td style="font-size:12px">${esc(r[0])}</td>` +
      r.slice(1).map((v) => `<td class="tnum">${esc(v)}</td>`).join('') + `</tr>`).join('') +
    `</table><p class="cap" style="margin:10px 0 0;font-size:12px;line-height:1.45">${esc(A.foot)}</p>
     <div class="door" style="margin-top:10px">${esc(A.door)}</div>`
  return card(club, A.title, A.note, body)
}

function ballparkCard(club) {
  const B = BALLPARK[club]
  // 93px and 91px: a head and one line. Drawn exactly as it renders, because an
  // undrawn empty is the thing About has to hold.
  if (!B.of) return card(club, 'Ballpark', null, `<p class="bp__name" style="margin:0">${esc(B.name)}</p>`)
  // Three separate fact lists on the shipped card, not one run of nine rows.
  const facts = B.facts.map((set, i) => `<div style="margin-top:${i ? 10 : 0}px">` + set.map(([k, v, n]) =>
    `<div class="bp__facts"><span>${esc(k)}</span><span><b>${esc(v)}</b>${n ? ` <i>${esc(n)}</i>` : ''}</span></div>`).join('') +
    `</div>`).join('')
  const dims = (label, list, note) => `<div class="bp__gl">${esc(label)}${note ? ` · ${esc(note)}` : ''}</div>
    <div class="bp__dims">` + list.map(([k, v]) =>
    `<div class="bp__dim"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('') + `</div>`
  return card(club, 'Ballpark', null,
    `<div class="bp__photo">the park</div><p class="bp__name">${esc(B.name)}</p>
     <div style="height:293px;margin:12px 0;border:1px solid ${T.ruleGrid};border-radius:6px;background:${T.paper3};
       display:flex;align-items:center;justify-content:center;color:${T.graphiteSoft};
       font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:.09em;text-transform:uppercase">the field, to scale</div>
     ${facts}${dims('Outfield distances', B.of, B.ofNote)}${dims('Wall heights', B.walls)}`)
}

function jerseysCard(club) {
  const J = JERSEYS[club]
  return card(club, 'Logos & jerseys', J.note,
    `<div class="jd">` + J.cards.map(([n, r]) =>
      `<div class="jd__card"><div class="jd__box"><span class="jd__mark"></span></div>
        <span class="jd__name">${esc(n)}</span><span class="jd__rec">${esc(r)}</span></div>`).join('') + `</div>`)
}

// Affiliation history and Made The Show are the OTHER head shape: a page-level
// group label with no card under it at all. Drawn as they ship.
const carded = (club, title, note, inner) => card(club, title, note, inner)

const affilHistory = () => `<div class="ledg__head" style="margin-bottom:8px">
    <span class="ledg__title">${esc(AFFIL_HISTORY_249.title)}</span></div>
  <div class="ctl">` + AFFIL_HISTORY_249.stops.map((y) =>
  `<div class="ctl__stop"><div class="ctl__badge"></div><span class="ctl__yrs">${esc(y)}</span></div>`).join('') + `</div>`

const affilHistoryCarded = (club) => carded(club, AFFIL_HISTORY_249.title, null,
  `<div class="ctl">` + AFFIL_HISTORY_249.stops.map((y) =>
    `<div class="ctl__stop"><div class="ctl__badge"></div><span class="ctl__yrs">${esc(y)}</span></div>`).join('') + `</div>`)

const alumni = () => `<div class="ledg__head" style="margin-bottom:8px">
    <span class="ledg__title">${esc(ALUMNI_249.title)}</span>
    <span class="cap">${esc(ALUMNI_249.note)}</span></div>` +
  ALUMNI_249.rows.map(([n, id, club, stint]) =>
    `<div class="alum__row"><div class="alum__shot"></div>
      <div><a href="#" class="alum__name">${esc(n)}</a>
        <div class="alum__ident">${esc(id)}</div>
        <div class="alum__club">${esc(club)}</div>
        <div class="alum__stint">${esc(stint)}</div></div></div>`).join('')

const alumniCarded = (club) => carded(club, ALUMNI_249.title, ALUMNI_249.note,
  ALUMNI_249.rows.map(([n, id, c, stint]) =>
    `<div class="alum__row"><div class="alum__shot"></div>
      <div><a href="#" class="alum__name">${esc(n)}</a>
        <div class="alum__ident">${esc(id)}</div>
        <div class="alum__club">${esc(c)}</div>
        <div class="alum__stint">${esc(stint)}</div></div></div>`).join(''))

/* ------------------------------------------------- one card from the table */
function renderCard(club, [title, note, h, shape]) {
  if (title === '@standings') return standingsCard(club)
  if (title === '@records') return recordsIndex(club, [])
  if (title === '@ledger') return ledgerCard(club)
  if (title === '@ballpark') return ballparkCard(club)
  if (title === '@jerseys') return jerseysCard(club)
  if (title === '@affilhistory') return affilHistory()
  if (title === '@alumni') return alumni()
  // The season's games are a bare grid, not a card (page-shape reports
  // .gamesgrid with no head at all — design.md §3's fifth card-head variant,
  // "none"). So it carries its own gap rather than inheriting .card + .card.
  if (title === '@grid') {
    return `<div style="height:${px(h)};margin-top:${CARDGAP}px;overflow:hidden">${gridShape(h)}</div>`
  }
  const HEAD = CLUBS[club].themed ? 43 : 38
  const body = (SHAPES[shape] ?? ((x) => rowsShape(x)))(h - HEAD - 28, club)
  const c = card(club, title, note, body)
  return c.replace('<div class="card">', `<div class="card card--fixed" style="height:${px(h)}">`)
}

/* -------------------------------------------------------------- a whole band */
function band(club, name, { standfirst } = {}) {
  const spec = PAGE[club][name]
  const sf = standfirst ?? STANDFIRST[name.toLowerCase() + (club === 158 ? '' : club)] ?? STANDFIRST[name.toLowerCase()]
  let out = seam(SEAM) + bandHead(name, sf)
  if (Array.isArray(spec)) {
    out += spec.map((c) => renderCard(club, c)).join('')
  } else {
    out += spec.first.map((c) => renderCard(club, c)).join('')
    if (spec.sub) out += subHead(spec.sub) + spec.second.map((c) => renderCard(club, c)).join('')
  }
  return out
}

const sheetFor = () => SHEET + RECORDS_SHEET + `
/* The reorganised Records card brings its own .card rule; the fixed-height
   helper has to win over it for the shape cards, so it is restated last. */
.card--fixed{display:flex;flex-direction:column}
.card--fixed>.cbody{flex:1 1 auto;overflow:hidden;min-height:0}
`

const board = (title, h, inner, pad = true) =>
  page(title, h, `<div style="width:${W}px;height:${px(h)};background:${T.paper0};overflow:hidden">` +
    `<div class="pagebody">${pad ? `<div style="padding:0 16px 24px">${inner}</div>` : inner}</div>` +
    `</div>`, sheetFor())

/* ================================================================== boards */
const BOARDS = []
const add = (name, title, h, inner, pad = true) =>
  BOARDS.push([name, board(title, h, inner, pad)])

// A ghost of the neighbouring band's card, so a seam is JUDGED rather than
// described. It is the same device the Phase 1 boards close on.
const legend = () => `<div class="legend">
    <b>Every card is at its measured height</b>, taken off the running page on 2026-09-21. The cards this
    study draws — the standings, Records, the leaders ledger, the ballpark and the marks — carry their real
    figures. The rest carry the card’s true geometry with their figures <b>ghosted</b>: a board that invented
    a figure would be a board that lies, and these are shipped cards this design does not change.
  </div>`

const ghostCard = (club, title, note, line) =>
  `<div class="card" style="opacity:.45">${chead(club, title, note)}
     <div class="cbody"><div class="cap">${esc(line)}</div></div></div>`

/* ---- 1 · RANKS, the hard case: ONE card under a full-width head ---------- */
add('P2-Ranks-249.dc.html', 'Ranks · Single-A — one card', 1015,
  jumpBar(249, 'Ranks') + `<div style="padding:0 16px 24px">` +
  seam(SEAM) + bandHead('Ranks', STANDFIRST.ranks249) + ledgerCard(249) +
  seam(SEAM) + bandHead('Games', STANDFIRST.games) +
  ghostCard(249, 'Schedule', 'Stamp In', 'the next band begins — shown so the seam is judged, not described') +
  `</div>`, false)

add('P2-Ranks-556.dc.html', 'Ranks · Triple-A — the ABS card above it', 1790,
  jumpBar(556, 'Ranks') + `<div style="padding:0 16px 24px">` +
  seam(SEAM) + bandHead('Ranks', STANDFIRST.ranks556) + absCard(556) +
  `<div style="height:${CARDGAP}px"></div>` + ledgerCard(556) + `</div>`, false)

/* ---- 2 · ABOUT: four unlike modules, and the page's close ---------------- */
// AS IT SHIPS. Two of the four are .thub-cards; two are page-level group labels
// with no card at all. All four sit 16px apart, because they are siblings in
// one band: 32px is the SUB-HEAD's spacing, and About does not get a sub-head.
// The page uses two-sections-under-one-head exactly once, in Standing, and the
// restraint is the point.
add('P2-About-249.dc.html', 'About · Single-A — four modules, as they ship', 1570,
  `<div style="padding:0 16px 24px">` +
  ghostCard(249, 'Depth chart', 'scouting vs. performance',
    'the last card of FARM — shown so the close is judged, not described') +
  seam(SEAM) + bandHead('About', STANDFIRST.about249) +
  ballparkCard(249) + `<div style="height:${CARDGAP}px"></div>` + jerseysCard(249) +
  `<div style="height:${CARDGAP}px"></div>` + affilHistory() +
  `<div style="height:${CARDGAP}px"></div>` + alumni() + `</div>`, false)

// HARMONIZED. The same four modules, all four carded. Nothing about the card
// changes; it is applied to the two modules that never had one. This is the
// single largest item on #1107's element-by-element list and it is drawn beside
// the shipped version so the difference is looked at rather than argued.
add('P2-About-249-Carded.dc.html', 'About · Single-A — all four carded', 1660,
  `<div style="padding:0 16px 24px">` +
  ghostCard(249, 'Depth chart', 'scouting vs. performance', 'the last card of FARM') +
  seam(SEAM) + bandHead('About', STANDFIRST.about249) +
  ballparkCard(249) + jerseysCard(249) + affilHistoryCarded(249) + alumniCarded(249) + `</div>`, false)

add('P2-About-158.dc.html', 'About · MLB — two modules', 1465,
  `<div style="padding:0 16px 24px">` + seam(SEAM) + bandHead('About', STANDFIRST.about) +
  ballparkCard(158) + jerseysCard(158) + `</div>`, false)

add('P2-About-675.dc.html', 'About · the floor — 349px', 570,
  `<div style="padding:0 16px 24px">` +
  ghostCard(675, 'Current Roster', null, 'the last card of ROSTER — 2,387px of it above this line') +
  seam(SEAM) + bandHead('About', STANDFIRST.about675) +
  ballparkCard(675) + jerseysCard(675) + `</div>`, false)

/* ---- 3 · THE STICKY JUMP BAR -------------------------------------------- */
// Drawn as the SHIPPED control, and measured rather than assumed: the bar has
// 358px of room at iPhone 13 width, and its buttons measure 80-84px for an
// eight-letter name. Milwaukee's seven bands want 470px of it.
const state = (label, bar, under, note) =>
  `<p class="statelabel">${esc(label)}</p>
   <div class="stage">${bar}<div style="padding:12px 16px 14px">${under}</div></div>
   <p class="statenote">${note}</p>`

const underBand = (name, sf) =>
  `<div class="brule" style="margin:0 -16px 12px"></div><div class="bhead4">${esc(name)}</div>
   <p class="bq4" style="margin-bottom:0">${esc(sf)}</p>`

add('P2-Jump.dc.html', 'The jump bar — resting, stuck, current, overflowing', 1680,
  `<div style="padding:24px 16px">
    <p class="boardtitle">The jump bar</p>
    <p class="boardsub">One control, shared with the player hub — it is HubTabBar, and the team page
      and <code>/player/{id}</code> get the same object in the same commit. Club-neutral navy per ADR-0030:
      a club may colour a card that identifies the club, never page chrome.</p>` +

  state('1 · resting — the top of the page',
    jumpBar(158, 'Standing', false),
    underBand('Standing', STANDFIRST.standing),
    'It sits on the page&rsquo;s own paper with no rule under it, because there is nothing above it to ' +
    'divide from. The first band&rsquo;s ink rule is the only rule on screen.') +

  state('2 · stuck — the reader has scrolled',
    jumpBar(158, 'Standing', true),
    underBand('Standing', STANDFIRST.standing),
    'The same bar, on the same paper, with one 1px pencil rule under it. <b>No new shadow</b> — this is ' +
    'paper, and the control already carries <code>--shadow-card</code>. The rule is the page&rsquo;s third ' +
    'full-bleed line, after the band head&rsquo;s 2px and the sub-head&rsquo;s 1px, which is why it needs no ' +
    'other signal to be read as page structure.') +

  state('3 · current section — the last band, and the bar scrolled to reach it',
    jumpBar(158, 'About', true, 114),
    underBand('About', STANDFIRST.about),
    '<b>And this is the one thing a jump bar needs that a tab bar never did.</b> A tab bar&rsquo;s current ' +
    'tab is wherever the reader tapped it, so it is on screen by definition. A jump bar&rsquo;s current pill ' +
    'changes by <b>scrolling the page</b>, and the bar is 472px of pills in 358px of room. Measured, the ' +
    'two that fall off the end are <b>Money</b> and <b>About</b> — the last two bands, which is the worst ' +
    'place for it: a reader four screens into a 17,594px page arrives in About and the mark that says so ' +
    'is off the end of a control nobody has touched. The bar is shifted 114px here, which is the whole of ' +
    'its overflow, and it is what puts ABOUT in view.') +

  state('4 · the floor, where it fits',
    jumpBar(675, 'Roster', true),
    `<div class="cap">five bands, 347px of pills in 358px of room</div>`,
    'A band a club cannot fill is <b>absent</b> — not rendered, and not in the bar. Los Mochis loses Farm ' +
    'and Money, and the five that are left are the only case in the app where the bar does not scroll. ' +
    'Nothing says a band is missing, because nothing is.') +

  `<div class="srule"></div><div class="shead">Measured, not assumed</div>
   <table><tr><th>Club</th><th>Bands</th><th>Pills</th><th>Room</th><th>Tabs today</th></tr>
     <tr><td>158 Milwaukee</td><td class="tnum">7</td><td class="tnum">472</td><td class="tnum">358</td><td class="tnum">460</td></tr>
     <tr><td>249 Wilson</td><td class="tnum">6</td><td class="tnum">405</td><td class="tnum">358</td><td class="tnum">367</td></tr>
     <tr><td>675 Los Mochis</td><td class="tnum">5</td><td class="tnum">347</td><td class="tnum">358</td><td class="tnum">358</td></tr></table>
   <p class="statenote" style="margin-top:12px">The shipped tab bar already overflows at Milwaukee by 102px
     and at Wilson by 9px, so sideways scrolling is not new. What is new is the third state above. And the
     control is <b>34px tall</b>, under the 44px the Records review held <code>Open all</code> to — named here
     for the harmonization list rather than changed, because it is HubTabBar and it would move the player hub
     in the same commit.</p>
  </div>`, false)

/* ---- 4 · THE FLOOR: 675, five bands, drawn whole ------------------------- */
const bandsOf = (club, names, opts = {}) => names.map((n) => band(club, n, opts[n] ?? {})).join('')

add('P2-Page-675.dc.html', 'Caneros de los Mochis — the floor, five bands', 7960,
  jumpBar(675, 'Standing') + `<div style="padding:0 16px">${legend()}</div><div style="padding:0 16px 24px">` +
  bandsOf(675, BANDS[675]) + `</div>`, false)

/* ---- 5 · MILWAUKEE: seven bands. Over the Design type's 8,000px frame, so it
       runs across three frames, cut at a band seam each time. --------------- */
add('P2-Page-158-1.dc.html', 'Milwaukee 1 of 3 — Standing · Ranks', 5370,
  jumpBar(158, 'Standing') + `<div style="padding:0 16px">${legend()}</div><div style="padding:0 16px 24px">` +
  bandsOf(158, ['Standing', 'Ranks']) +
  seam(SEAM) + `<p class="cap" style="text-align:center">the scroll continues on the next frame</p></div>`, false)

add('P2-Page-158-2.dc.html', 'Milwaukee 2 of 3 — Games · Roster', 6825,
  jumpBar(158, 'Games') + `<div style="padding:0 16px">${legend()}</div><div style="padding:0 16px 24px">` +
  bandsOf(158, ['Games', 'Roster']) +
  seam(SEAM) + `<p class="cap" style="text-align:center">the scroll continues on the next frame</p></div>`, false)

add('P2-Page-158-3.dc.html', 'Milwaukee 3 of 3 — Farm · Money · About', 7620,
  jumpBar(158, 'About', true, 114) + `<div style="padding:0 16px">${legend()}</div><div style="padding:0 16px 40px">` +
  bandsOf(158, ['Farm', 'Money', 'About']) +
  seam(SEAM) + `<p class="cap" style="text-align:center">the page ends here · 17,594px of cards</p></div>`, false)

/* ---- 6 · WILSON: the check. Ranks and About are drawn above; this is what
       else differs — the two thinner middle bands, and Farm's head naming the
       org whose ladder it shows. ---------------------------------------- */
add('P2-Page-249-Diff.dc.html', 'Wilson — what else differs', 6355,
  jumpBar(249, 'Games') + `<div style="padding:0 16px">${legend()}</div><div style="padding:0 16px 24px">` +
  bandsOf(249, ['Games', 'Roster']) +
  // Farm is the SAME four cards as Milwaukee's, because all three affiliates
  // share one org's farm system. What differs is the head: it names the org
  // whose ladder is being shown, which is 2G's second qualifier.
  seam(SEAM) + bandHead('Farm', STANDFIRST.farm249) +
  renderCard(249, ['Affiliates', null, 569, 'affiliates']) +
  ghostCard(249, 'On the horizon', null,
    'Farm is Milwaukee’s four cards, unchanged — all three affiliates share one org’s system') +
  `</div>`, false)

for (const [name, html] of BOARDS) writeFileSync(join(OUT, name), html, 'utf8')
console.log(`wrote ${BOARDS.length} Phase 2 artboards to ${OUT}`)

/* --------------------------------------------------- the page arithmetic
   Printed rather than asserted, so a board that moves is caught here first. */
for (const club of [158, 249, 675]) {
  const rows = []
  let total = 0
  for (const name of BANDS[club]) {
    const spec = PAGE[club][name]
    const list = Array.isArray(spec) ? spec : [...spec.first, ...spec.second]
    const px2 = list.reduce((a, c) => a + c[2], 0)
    rows.push(`  ${name.padEnd(9)} ${String(px2).padStart(6)}`)
    total += px2
  }
  console.log(`\n--- ${club} · ${CLUBS[club].name} · ${BANDS[club].length} bands ---`)
  console.log(rows.join('\n'))
  console.log(`  ${'TOTAL'.padEnd(9)} ${String(total).padStart(6)}`)
}
