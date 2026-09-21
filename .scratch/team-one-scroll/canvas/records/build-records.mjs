// THE RECORDS CARD, REDRAWN AS A TWELVE-LINE LEDGER THAT UNFOLDS.
//
// Writes the artboards for ./records.md. Same .dc.html format as
// ../project/*.dc.html (support.js head line, <x-dc>/<helmet> wrapper,
// trailing data-dc-script block), so the boards can be placed on the same
// canvas without conversion.
//
//   node .scratch/team-one-scroll/canvas/records/build-records.mjs
//
// The values are REAL — ../data.mjs, scraped off the running dev server. A
// placeholder row would hide the crowding that is the whole problem here.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOKENS as T, CLUBS, RECORDS, RECORDS_249, DOW, DOW_249 } from '../data.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'boards')
mkdirSync(OUT, { recursive: true })

const W = 390
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* ------------------------------------------------------------ the summary */
// What a CLOSED line says about the group behind it. Two facts, both computed
// from the group's own rows so nothing is authored twice:
//   - how many splits are in there  ("9 splits")
//   - the spread of win pct inside  (".075–.966")
// The spread is the reason to open or not open: Leading and trailing runs
// .075 to .966 and Defense runs .544 to .677, and that difference IS the
// finding. Season counts has no pct, so it prints the count alone — a ledger
// line with one fewer figure, not a different row shape.
function summarise(g) {
  if (g.counts) return { n: g.counts.length, unit: 'tallies', lo: null, hi: null }
  const pcts = g.rows
    ? g.rows.map((r) => r[2])
    : g.innings.flatMap((r) => [r[2], r[5]]).filter(Boolean)
  const num = pcts.map(Number)
  const fmt = (v) => (v === 1 ? '1.000' : v.toFixed(3).replace(/^0/, ''))
  return { n: pcts.length, unit: 'splits', lo: fmt(Math.min(...num)), hi: fmt(Math.max(...num)) }
}

/* ------------------------------------------------------------- the styles */
const SHEET = `
*{box-sizing:border-box}
body{margin:0;background:${T.paper0};font-family:'Source Sans 3',system-ui,sans-serif;color:${T.ink1};
  -webkit-font-smoothing:antialiased}
.u{text-transform:uppercase}
.disp{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;letter-spacing:.01em}

/* ---- the card, exactly as shipped (09-team-info.css). UNCHANGED. ---- */
.card{border:1px solid ${T.rule};border-radius:10px;background:${T.paper2};
  box-shadow:${T.shadowCard};overflow:hidden}
.card+.card{margin-top:16px}
.chead{display:flex;align-items:baseline;flex-wrap:wrap;justify-content:space-between;gap:8px;
  padding:10px 16px;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;
  text-transform:uppercase;letter-spacing:.09em}
.chead>span{font-size:1.2em}
.chead em{font-style:normal;font-weight:400;font-size:12px;letter-spacing:.05em}
.cbody{padding:12px 16px 16px}

/* ---- the SUB-HEAD, from design.md §5: full-bleed 1px pencil rule, 17px ---- */
.shead{margin:0 0 12px;font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;
  letter-spacing:.05em;text-transform:uppercase;color:${T.ink1};line-height:1.2}
.srule{height:1px;background:${T.rule};margin:32px -16px 10px}

/* ---- the SCOPE CONTROLS, unchanged from the shipped card ---- */
.tabrow{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid ${T.ruleSoft}}
.tab{flex:1;border:1px solid ${T.rule};border-radius:6px;padding:6px 8px;background:${T.paper3};
  font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;color:${T.graphite};text-align:center}
.tabrow.months .tab{flex:0 1 auto;min-width:3rem}
.tab.on{background:#F6E9D8;border-color:${T.seal};color:${T.ink0}}

/* =================================================================
   THE INDEX — twelve lines, each one a door into its own group.

   A line is a BUTTON the full width of the card body, 44px tall, so a
   one-handed reader hits it without aiming. It is a ledger line, not a menu
   item: it carries the two figures that decide whether to open it.

   Closed  NAME .......... 9 SPLITS  .075–.966   ›
   Open    NAME ..............................   ⌄
                (the rows now carry the figures)

   The chevron is drawn, not a glyph — two 1.5px pencil strokes on a rotated
   square, so it reads as a mark made on the paper rather than a UI icon, and
   so it takes a colour token like everything else.
   ================================================================= */
.idx{list-style:none;margin:0;padding:0}
.idxg+.idxg{border-top:1px solid ${T.rule}}
.idxb{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;
  padding:12px 4px;margin:0;border:0;background:none;text-align:left;cursor:pointer}
.idxn{flex:1 1 auto;min-width:0;font-family:'Barlow Condensed',sans-serif;font-size:12px;
  font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:${T.graphite};line-height:1.2}
.idxg.on .idxn{color:${T.ink0}}
/* Both figures are COLUMNS, not trailing text. Without a fixed width the count
   moves left whenever the range beside it is wide (".500–1.000" against
   ".611–.667") and twelve lines wobble instead of scanning. */
.idxc{flex:0 0 auto;min-width:64px;text-align:right;font-family:'Barlow Condensed',sans-serif;
  font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${T.graphite};
  white-space:nowrap}
.idxr{flex:0 0 auto;min-width:68px;text-align:right;font-family:'JetBrains Mono',monospace;
  font-variant-numeric:tabular-nums;font-size:11px;color:${T.ink0};white-space:nowrap}
.chev{flex:0 0 auto;width:7px;height:7px;margin-right:4px;
  border-right:1.5px solid ${T.graphite};border-bottom:1.5px solid ${T.graphite};
  transform:rotate(-45deg)}
.idxg.on .chev{transform:rotate(45deg);border-color:${T.ink0}}
/* The opened panel. No tint and no indent — a new plane has to show an edge
   the manila cannot (design.md §4), and the 44px line above it already does. */
.idxp{padding:0 0 12px}

/* ---- a W-L split row. The label may wrap; the figure never does. Without
   min-width:0 on the label a long one ("Opponent scores first") pushes its own
   win pct onto a THIRD line, which the shipped card does today — design.md's
   harmonization list names it. ---- */
/* ONE dotted rule per row, not two. The shipped card draws a dotted underline
   under the label (the door) AND a dotted rule under the whole row, so an open
   group prints two dotted lines per split and stops reading as a ledger — the
   card's own CSS comment warns about exactly this and then does it anyway.
   The label's underline stays, because that is the door; the row rule goes. */
.rgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}
.rrow{display:flex;align-items:baseline;justify-content:space-between;gap:6px;padding:6px 0;
  flex-wrap:nowrap}
/* text-decoration, not border-bottom. Two fifths of these labels wrap ("VS.
   AMERICAN / LEAGUE CENTRAL"), and a border-bottom then draws one short dash
   under the second line only, which reads as a mistake rather than as a door.
   A dotted text-decoration follows every line of the label. */
.rrow .rl{flex:1 1 auto;min-width:0;font-family:'Barlow Condensed',sans-serif;font-size:12px;
  font-weight:700;text-transform:uppercase;letter-spacing:.04em;line-height:1.3;color:${T.ink1};
  text-decoration:underline dotted ${T.rule};text-underline-offset:3px}
.rrow>span:last-child{flex:0 0 auto;white-space:nowrap}
.rrow .rv{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;
  color:${T.ink0}}
.rrow .rp{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;
  color:${T.graphite}}

/* ---- the by-inning matrix, shipped shape, unchanged ---- */
.inn{display:grid;grid-template-columns:2.6rem 1fr 1fr;gap:2px 8px;align-items:stretch}
.innh{padding-bottom:2px;border-bottom:1px solid ${T.rule};font-family:'Barlow Condensed',sans-serif;
  font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:${T.graphite}}
.innr{align-self:center;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;
  text-transform:uppercase;letter-spacing:.09em;color:${T.graphite}}
/* The cell is TWO lines, not three. Shipped stacks record / win pct / date, so
   ten innings cost thirty lines and the group alone is 644px — a fifth of the
   whole card. Record and win pct on one line is the same pairing every W-L row
   on this card already uses, which is the harmonization and the saving at once. */
.innc{display:flex;flex-direction:column;align-items:flex-start;padding:5px 6px;
  border-left:1px solid ${T.ruleGrid}}
.innv{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;
  color:${T.ink0};white-space:nowrap}
.innp{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;
  color:${T.graphite}}
.innl{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;color:${T.graphite};border-bottom:1px dotted ${T.rule}}
.innx{display:grid;grid-template-columns:2.6rem 1fr;gap:8px;align-items:center;margin-top:6px;
  padding-top:6px;border-top:1px solid ${T.ruleGrid}}

/* ---- season counts. NO separate shape: a count is a ledger row whose figure
   happens to be one number instead of two. Shipped stacks the figure over its
   label in a tile grid, which is the third way this one card draws a row and
   the reason the counts block reads as a different object bolted on. Label
   left, figure right, same .rrow — the harmonization Gary asked for, and 391px
   of tiles becomes ~270px of ledger. ---- */

/* ---- the card foot: one tap puts the card back exactly as it ships today ---- */
.foot{display:flex;justify-content:flex-end;padding:10px 4px 0;border-top:1px solid ${T.rule}}
.footb{border:0;background:none;padding:6px 2px;margin:0;cursor:pointer;
  font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;color:${T.field}}

.cap{font-size:11px;color:${T.graphite};line-height:1.35}
.note{font-size:11px;color:${T.graphite};line-height:1.35;padding:0 0 8px}

/* ---- the jump bar ---- */
.jump{display:flex;gap:6px;overflow:hidden;padding:8px 0}
.jump .jp{border:1px solid ${T.rule};border-radius:999px;padding:5px 11px;background:${T.paper2};
  font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;color:${T.ink1};white-space:nowrap}
.jump .jp.on{background:${T.navy};color:${T.paper2};border-color:${T.navy}}
.jumpstuck{border-bottom:1px solid ${T.rule};background:${T.paper0}}

/* ---- the measuring frame: a 390x844 phone screen, drawn as a bracket in the
   gutter so the board says how many screens it is without a caption ---- */
.scr{position:absolute;left:0;width:3px;background:${T.clay};opacity:.28}
`

/* ------------------------------------------------------------- the panels */
function wlRows(rows) {
  return `<div class="rgrid">` + rows.map((r) =>
    `<div class="rrow"><span class="rl">${esc(r[0])}</span>` +
    `<span><span class="rv">${esc(r[1])}</span> <span class="rp">${esc(r[2])}</span></span></div>`)
    .join('') + `</div>`
}

function innMatrix(g) {
  const cell = (rec, pct, last) => rec
    ? `<div class="innc"><span class="innv">${esc(rec)} <span class="innp">${esc(pct)}</span></span>` +
      `<span class="innl">${esc(last)}</span></div>`
    : `<div class="innc"><span class="innp">—</span></div>`
  const body = g.innings.filter((r) => r[0] !== 'Extras').map((r) =>
    `<div class="innr">${esc(r[0])}</div>${cell(r[1], r[2], r[3])}${cell(r[4], r[5], r[6])}`).join('')
  const x = g.innings.find((r) => r[0] === 'Extras')
  return `<div class="note">${esc(g.sub)}</div>` +
    `<div class="inn"><div></div><div class="innh">Top</div><div class="innh">Bottom</div>${body}</div>` +
    `<div class="innx"><div class="innr">Extras</div>${cell(x[1], x[2], x[3])}</div>`
}

// A count is a .rrow with one figure instead of two. Same row, same grid, same
// dotted door under the label as every W-L split above it.
function counts(g) {
  return `<div class="rgrid">` + g.counts.map((c) =>
    `<div class="rrow"><span class="rl">${esc(c[1])}</span>` +
    `<span><span class="rv">${esc(c[0])}</span></span></div>`).join('') + `</div>`
}

/* --------------------------------------------------------------- the card */
function recordsCard(club, open) {
  const R = club === 249 ? RECORDS_249 : RECORDS
  const c = CLUBS[club]
  const headStyle = c.themed
    ? `background:${c.bar};border-bottom:3px solid ${c.accent};color:${c.onBar}`
    : `background:transparent;border-bottom:1px solid ${T.ruleSoft};color:${T.graphite}`

  const isOpen = (name) => open === 'all' || (Array.isArray(open) && open.includes(name))

  const index = R.groups.map((g) => {
    const s = summarise(g)
    const on = isOpen(g.name)
    // OPEN: the summary figures leave the line, because the rows beneath say it
    // better and a chevron-down beside two numbers beside a name is crowded at
    // 390px. Closing puts them back. That move IS the unfold.
    const right = on ? '' :
      `<span class="idxc">${s.n} ${s.unit}</span>` +
      (s.lo ? `<span class="idxr">${esc(s.lo)}–${esc(s.hi)}</span>` : '')
    const panel = on
      ? `<div class="idxp">${g.rows ? wlRows(g.rows) : g.innings ? innMatrix(g) : counts(g)}</div>`
      : ''
    return `<div class="idxg${on ? ' on' : ''}">
      <button class="idxb" type="button"><span class="idxn">${esc(g.name)}</span>${right}
        <span class="chev"></span></button>${panel}</div>`
  }).join('')

  const anyOpen = open === 'all' || (Array.isArray(open) && open.length > 0)
  const foot = `<div class="foot"><button class="footb" type="button">${
    open === 'all' ? 'Close all' : 'Open all'} ›</button></div>`

  return `<div class="card">
    <div class="chead" style="${headStyle}"><span>${esc(R.head)}</span>
      <em style="opacity:.82">${esc(R.note)}</em></div>
    <div class="tabrow">${R.tabs.map((t, i) =>
      `<span class="tab${i === 0 ? ' on' : ''}">${esc(t)}</span>`).join('')}</div>
    <div class="tabrow months">${R.months.map((t, i) =>
      `<span class="tab${i === 0 ? ' on' : ''}">${esc(t)}</span>`).join('')}</div>
    <div class="cbody" style="padding:4px 16px 14px">
      <div class="idx">${index}</div>${foot}
    </div></div>`
}

function dowCard(club) {
  const D = club === 249 ? DOW_249 : DOW
  const c = CLUBS[club]
  const headStyle = c.themed
    ? `background:${c.bar};border-bottom:3px solid ${c.accent};color:${c.onBar}`
    : `background:transparent;border-bottom:1px solid ${T.ruleSoft};color:${T.graphite}`
  return `<div class="card"><div class="chead" style="${headStyle}"><span>${esc(D.head)}</span>` +
    `<em style="opacity:.82">${esc(D.note)}</em></div>` +
    `<div class="cbody">${wlRows(D.rows)}</div></div>`
}

/* ------------------------------------------------------------ the artboard */
function board({ title, club, open, caption }) {
  const jump = ['Standing', 'Ranks', 'Games', 'Roster', 'Farm', 'Money', 'About']
    .filter((n) => !(club !== 158 && n === 'Money'))
    .map((n) => `<span class="jp${n === 'Standing' ? ' on' : ''}">${n}</span>`).join('')

  const body = `
  <div style="position:relative;width:${W}px;background:${T.paper0};padding-bottom:28px">
    <div class="jumpstuck" style="padding:0 16px"><div class="jump">${jump}</div></div>
    <div style="padding:0 16px">
      <div class="srule"></div>
      <div class="shead">Record, split every way</div>
      <p class="cap" style="margin:-6px 0 12px">${esc(caption)}</p>
      ${recordsCard(club, open)}
      ${dowCard(club)}
    </div>
  </div>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>${SHEET}</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${W},"height":900}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`
}

/* ------------------------------------------------------------------ emit */
const BOARDS = [
  ['Rec-Closed.dc.html', {
    title: 'Records · closed · Milwaukee', club: 158, open: [],
    caption: 'ON ARRIVAL — twelve lines, every door on one screen',
  }],
  ['Rec-Open.dc.html', {
    title: 'Records · two open · Milwaukee', club: 158,
    open: ['Leading and trailing', 'Scoring by inning'],
    caption: 'TWO OPEN — a W-L group and the by-inning matrix, the two shapes',
  }],
  ['Rec-All.dc.html', {
    title: 'Records · all open · Milwaukee', club: 158, open: 'all',
    caption: 'OPEN ALL — the ceiling, one tap from the foot',
  }],
  ['Rec-249-Closed.dc.html', {
    title: 'Records · closed · Wilson', club: 249, open: [],
    caption: 'WILSON ON ARRIVAL — eleven lines; no By league at Single-A',
  }],
  ['Rec-249.dc.html', {
    title: 'Records · Wilson, Single-A', club: 249, open: ['Schedule'],
    caption: 'WILSON — eleven lines, and a record that ends in a tie',
  }],
  ['Rec-249-All.dc.html', {
    title: 'Records · Wilson · all open', club: 249, open: 'all',
    caption: 'WILSON, OPEN ALL — the ceiling at Single-A',
  }],
]

for (const [name, opts] of BOARDS) writeFileSync(join(OUT, name), board(opts))
console.log(`wrote ${BOARDS.length} boards to ${OUT}`)

// The summary figures, printed so records.md quotes measurements rather than
// guesses at them.
for (const [label, R] of [['158', RECORDS], ['249', RECORDS_249]]) {
  console.log(`\n--- ${label} ---`)
  for (const g of R.groups) {
    const s = summarise(g)
    console.log(`  ${g.name.padEnd(22)} ${String(s.n).padStart(2)} ${s.unit.padEnd(7)} ${s.lo ? `${s.lo}–${s.hi}` : ''}`)
  }
}
