// Emits every .dc.html artboard and canvas.json for the team-page band system.
// The artboards are GENERATED rather than hand-written for two reasons: the
// Records card is 61 door rows plus a 10x2 inning table plus 18 counts and has
// to be drawn at its true 3,238px, and the four versions differ only in the
// band furniture — so the cards are written once and the furniture varies.
//
//   node .scratch/team-one-scroll/canvas/build.mjs
//
// Then publish with the Artifact tool. See README.md.
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOKENS as T, CLUBS, STANDINGS_158, STANDINGS_249, TEAM_SCORE, RECORDS, RECORDS_249, DOW, DOW_249, COMEBACKS } from './data.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'project')
mkdirSync(OUT, { recursive: true })

const W = 390
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* ---------------------------------------------------------------- the sheet
   Every value below is a token from src/tokens/*.css, read at its literal
   value. The global `#root *` uppercase is reproduced by .u on the elements
   that shout; body copy stays natural case, which is the house rule. */
const SHEET = `
*{box-sizing:border-box}
body{margin:0;background:${T.paper0};font-family:'Source Sans 3',system-ui,sans-serif;color:${T.ink1};
  -webkit-font-smoothing:antialiased}
a{color:${T.field};text-decoration:none}a:hover{color:${T.field}}
.u{text-transform:uppercase}
.disp{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;letter-spacing:.01em}

/* ---- the card, exactly as shipped (09-team-info.css) ---- */
.card{border:1px solid ${T.rule};border-radius:10px;background:${T.paper2};
  box-shadow:${T.shadowCard};overflow:hidden}
.card+.card{margin-top:16px}
.chead{display:flex;align-items:baseline;flex-wrap:wrap;justify-content:space-between;gap:8px;
  padding:10px 16px;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;
  text-transform:uppercase;letter-spacing:.09em}
.chead>span{font-size:1.2em}
.chead em{font-style:normal;font-weight:400;font-size:12px;letter-spacing:.05em}
.cbody{padding:12px 16px 16px}

/* ---- the BAND HEAD: BroadcastSection, promoted (68-around-the-game.css) ---- */
.bhead{display:flex;align-items:center;gap:12px;margin:0 0 12px;
  font-family:'Barlow Condensed',sans-serif;font-size:21px;font-weight:700;letter-spacing:.05em;
  text-transform:uppercase;color:${T.ink0};line-height:1.25}
.bhead::after{content:'';flex:1 1 auto;height:2px;background:${T.clay};opacity:.5}
.bq{margin:0 0 12px;font-size:13px;line-height:1.45;color:${T.ink2}}

/* ---- v4: the band head opens on a FULL-BLEED rule. A card is inset 16px on
   both sides and rounded; a rule that runs edge to edge is a plane no card can
   reach, at any weight or colour. That is what makes the band senior to the
   club-coloured card bar under it — a plane difference, which survives a
   one-handed glance, not a weight difference, which does not. ---- */
.bhead4{margin:0 0 10px;font-family:'Barlow Condensed',sans-serif;font-size:21px;font-weight:700;
  letter-spacing:.05em;text-transform:uppercase;color:${T.ink0};line-height:1.25}
.brule{height:2px;background:${T.ink0};margin:0 -16px 12px}
/* 16px under the standfirst, not 12: the line belongs to the HEAD, and at 12px
   it sat close enough to the first card to read as that card's caption. */
.bq4{margin:0 0 16px;font-size:13px;line-height:1.45;color:${T.ink1}}

/* ---- the SUB-HEAD: the same gesture one step down. Full-bleed rule, 1px in
   pencil rather than 2px in ink. FULL-BLEED is the page's structure and
   CONTAINED is a card's, so the two weights of page rule stay distinct from the
   card's filled bar and from the hairline over a group label inside it. ---- */
.shead{margin:0 0 12px;font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;
  letter-spacing:.05em;text-transform:uppercase;color:${T.ink1};line-height:1.2}
.srule{height:1px;background:${T.rule};margin:32px -16px 10px}

/* ---- tables and rows ---- */
table{width:100%;border-collapse:collapse}
th{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.09em;color:${T.graphite};text-align:right;padding:6px 4px;
  border-bottom:1px solid ${T.ruleSoft}}
th:first-child{text-align:left}
td{font-size:12px;padding:7px 4px;text-align:right;border-bottom:1px solid ${T.ruleGrid}}
td:first-child{text-align:left}
.tnum{font-family:'JetBrains Mono',monospace;font-size:11px;font-variant-numeric:tabular-nums}
.me{background:${T.fieldSoft}}
.gl{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.09em;color:${T.graphite};padding-top:14px;margin-top:14px;
  border-top:1px solid ${T.ruleSoft}}
.rgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}
.rrow{display:flex;align-items:baseline;justify-content:space-between;gap:6px;padding:6px 0;
  border-bottom:1px dotted ${T.rule};flex-wrap:nowrap}
/* The label wraps and the figure does not. Without min-width:0 a long label
   ("Opponent scores first") pushes its own pct onto a third line, which the
   shipped card does today — see design.md's harmonization list. */
.rrow .rl{font-size:11px;line-height:1.2;color:${T.ink1};text-transform:uppercase;
  font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:.04em;
  flex:1 1 auto;min-width:0}
.rrow>span:last-child{flex:0 0 auto;white-space:nowrap}
.rrow .rv{font-family:'JetBrains Mono',monospace;font-size:11px;white-space:nowrap;color:${T.ink0}}
.rrow .rp{font-family:'JetBrains Mono',monospace;font-size:11px;color:${T.graphite}}
.pill{display:inline-block;border:1px solid ${T.rule};border-radius:999px;padding:3px 10px;
  font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;background:${T.paper3};color:${T.ink1}}
.tabrow{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.tab{border:1px solid ${T.rule};border-radius:6px;padding:4px 10px;background:${T.paper3};
  font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;color:${T.ink1}}
.tab.on{background:${T.navy};color:${T.paper2};border-color:${T.navy}}
.cap{font-size:11px;color:${T.graphite};line-height:1.35}
.blurb{font-size:13px;line-height:1.45;color:${T.ink2};margin:0 0 12px}

/* ---- the jump bar ---- */
.jump{display:flex;gap:6px;overflow:hidden;padding:8px 0}
.jump .jp{border:1px solid ${T.rule};border-radius:999px;padding:5px 11px;background:${T.paper2};
  font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;color:${T.ink1};white-space:nowrap}
.jump .jp.on{background:${T.navy};color:${T.paper2};border-color:${T.navy}}
.jumpstuck{border-bottom:1px solid ${T.rule};background:${T.paper0}}

/* ---- skeleton + empty ---- */
.sk{background:${T.ruleGrid};border-radius:3px}
.skline{height:11px;margin:9px 0}
.empty{padding:18px 16px;font-size:13px;line-height:1.45;color:${T.ink2}}
`

/* ---------------------------------------------------------------- cards */
function chead(club, title, note) {
  const c = CLUBS[club]
  const style = c.themed
    ? `background:${c.bar};border-bottom:3px solid ${c.accent};color:${c.onBar}`
    : `background:transparent;border-bottom:1px solid ${T.ruleSoft};color:${T.graphite}`
  const em = note ? `<em style="opacity:.82">${esc(note)}</em>` : ''
  return `<div class="chead" style="${style}"><span>${esc(title)}</span>${em}</div>`
}

const card = (club, title, note, body) =>
  `<div class="card">${chead(club, title, note)}<div class="cbody">${body}</div></div>`

function standingsCard(club, S) {
  const head = `<table><tr>${S.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>` +
    S.rows.map((r) => `<tr${r[6] ? ' class="me"' : ''}>` +
      `<td class="u disp" style="font-size:12px">${esc(r[0])}</td>` +
      r.slice(1, 6).map((v) => `<td class="tnum">${esc(v)}</td>`).join('') + '</tr>').join('') +
    '</table>'
  const note = S.pill ? null : null
  const pill = S.pill ? `<span class="pill">${esc(S.pill)}</span>` : ''
  const c = CLUBS[club]
  const style = c.themed
    ? `background:${c.bar};border-bottom:3px solid ${c.accent};color:${c.onBar}`
    : `background:transparent;border-bottom:1px solid ${T.ruleSoft};color:${T.graphite}`
  return `<div class="card"><div class="chead" style="${style}">` +
    `<span>${esc(S.head)}</span>${pill}</div><div class="cbody">${head}</div></div>`
}

function teamScoreCard(club) {
  const rail = (filled) => `<div style="display:flex;gap:1px;margin-top:7px">` +
    Array.from({ length: 30 }, (_, i) =>
      `<div style="flex:1;height:14px;background:${i < filled ? T.field : T.ruleGrid}"></div>`).join('') +
    `</div>`
  const body = TEAM_SCORE.rows.map((r) => `
    <div style="padding:10px 0;border-top:1px solid ${T.ruleGrid}">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
        <div><div class="disp u" style="font-size:14px;color:${T.ink0}">${esc(r.label)}</div>
          <div class="cap">${esc(r.caption)}</div></div>
        <div style="text-align:right">
          <div class="mono" style="font-size:16px;color:${T.ink0}">${esc(r.score)}<span
            class="cap">${esc(r.of)}</span></div>
          <div class="cap mono">${esc(r.rank)}</div></div>
      </div>${rail(r.filled)}
    </div>`).join('')
  return card(club, TEAM_SCORE.head, TEAM_SCORE.note, body)
}

function recordsCard(club) {
  const R = club === 249 ? RECORDS_249 : RECORDS
  const rows = (g) => `<div class="rgrid">` + g.rows.map((r) => `
    <div class="rrow"><span class="rl">${esc(r[0])}</span>
      <span><span class="rv">${esc(r[1])}</span> <span class="rp">${esc(r[2])}</span></span></div>`)
    .join('') + `</div>`
  const innings = (g) => `<table style="margin-top:6px"><tr><th>Inn</th><th style="text-align:left">Top</th>` +
    `<th style="text-align:left">Bottom</th></tr>` + g.innings.map((r) => `<tr>` +
      `<td class="disp u" style="font-size:12px">${esc(r[0])}</td>` +
      `<td style="text-align:left"><span class="mono" style="font-size:14px">${esc(r[1])}</span>` +
      `<div class="cap mono">${esc(r[2])}</div><div class="cap">${esc(r[3])}</div></td>` +
      `<td style="text-align:left">${r[4] ? `<span class="mono" style="font-size:14px">${esc(r[4])}</span>` +
        `<div class="cap mono">${esc(r[5])}</div><div class="cap">${esc(r[6])}</div>` : ''}</td></tr>`).join('') +
    `</table>`
  const counts = (g) => `<div class="rgrid">` + g.counts.map((c) => `
    <div class="rrow"><span class="rl">${esc(c[1])}</span>
      <span class="rv">${esc(c[0])}</span></div>`).join('') + `</div>`

  const body = `<div class="tabrow">${R.tabs.map((t, i) =>
    `<span class="tab${i === 0 ? ' on' : ''}">${esc(t)}</span>`).join('')}</div>` +
    `<div class="tabrow">${R.months.map((t, i) =>
      `<span class="tab${i === 0 ? ' on' : ''}">${esc(t)}</span>`).join('')}</div>` +
    R.groups.map((g) => `<div class="gl">${esc(g.name)}</div>` +
      (g.sub ? `<div class="cap" style="margin:4px 0 2px">${esc(g.sub)}</div>` : '') +
      (g.rows ? rows(g) : g.innings ? innings(g) : counts(g))).join('')
  return card(club, R.head, R.note, body)
}

function dowCard(club) {
  const D = club === 249 ? DOW_249 : DOW
  const body = `<div class="rgrid">` + D.rows.map((r) => `
    <div class="rrow"><span class="rl">${esc(r[0])}</span>
      <span><span class="rv">${esc(r[1])}</span> <span class="rp">${esc(r[2])}</span></span></div>`)
    .join('') + `</div>`
  return card(club, D.head, D.note, body)
}

function comebacksCard(club) {
  const rail = (r) => `
    <div style="margin:14px 0 0">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <span class="disp u" style="font-size:12px;color:${T.ink1};letter-spacing:.06em">${esc(r.label)}</span>
        <span><span class="mono" style="font-size:14px;color:${T.ink0}">${esc(r.pct)}</span>
          <span class="cap mono"> · ${esc(r.rank)}</span></span>
      </div>
      <div style="position:relative;height:22px;margin-top:6px">
        <div style="position:absolute;left:0;right:0;top:11px;height:1px;background:${T.rule}"></div>
        <div style="position:absolute;left:${r.avgAt}%;top:2px;width:1px;height:18px;background:${T.ink2}"></div>
        <div style="position:absolute;left:calc(${r.at}% - 5px);top:6px;width:10px;height:10px;
          border:2px solid ${T.ink0};border-radius:999px;background:${T.paper3}"></div>
      </div>
      <div style="display:flex;justify-content:space-between"><span class="cap mono">${esc(r.lo)}</span>
        <span class="cap">${esc(r.avg)}</span><span class="cap mono">${esc(r.hi)}</span></div>
    </div>`
  const body = `<p class="blurb">${esc(COMEBACKS.blurb)}</p>` + COMEBACKS.rails.map(rail).join('')
  return card(club, COMEBACKS.head, COMEBACKS.note, body)
}

/* ------------------------------------------------- the four band furnitures */
// v1-v3 print the band's QUESTION, which is how scope.md names each band.
// v4 prints a STANDFIRST instead — see design.md: a second screen answers, it
// does not ask, and an interrogative under every head is seven questions the
// reader has to read to discover they carry no information. The standfirst says
// what is in the band, and it is also where 2G's level qualifier and "not
// dated" note land, because those are sentences.
const QUESTION = 'How is the season going?'
export const STANDFIRST = {
  standing: 'Where they stand, and the record split every way.',
  standing249: 'Where they stand, and the record split every way.',
  ranks: 'Where this club sits against its league.',
  ranks249: 'The league rank boards start at Triple-A, so this is the club’s own leaders.',
  games: 'Every game this season, and where they played it.',
  roster: 'Who plays here, and who arrived and left.',
  farm: 'The org ladder, and the players climbing it.',
  money: 'What the roster costs. This band does not move with the date.',
  about: 'The ballpark, and the marks this club wears.',
}

function furniture(v) {
  // v1  the plain promotion — BroadcastSection dropped in, nothing else
  // v2  the band tint 1D.4 asked for, so the rejection is visible not asserted
  // v3  over-correct: a rule above, a folio, and a closing mark
  // v4  the settled system
  const head = (name, q, note) => {
    if (v === 3) {
      return `<div style="border-top:2px solid ${T.ink0};padding-top:10px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
          <div class="bhead" style="flex:1 1 auto">${esc(name)}</div>
          <span class="mono cap" style="white-space:nowrap">1 / 7</span></div>
        <p class="bq">${esc(q)}${note ? ` ${esc(note)}` : ''}</p></div>`
    }
    if (v === 4) {
      return `<div class="brule"></div>
        <div class="bhead4">${esc(name)}</div>
        <p class="bq4">${esc(q)}${note ? ` ${esc(note)}` : ''}</p>`
    }
    return `<div class="bhead">${esc(name)}</div>
      <p class="bq">${esc(q)}${note ? ` ${esc(note)}` : ''}</p>`
  }
  const sub = (t) => {
    if (v === 4) return `<div class="srule"></div><div class="shead">${esc(t)}</div>`
    if (v === 3) return `<div class="shead" style="border-top:1px solid ${T.rule};padding-top:12px;margin-top:32px">${esc(t)}</div>`
    return `<div class="shead" style="margin-top:32px">${esc(t)}</div>`
  }
  const close = v === 3
    ? `<div style="text-align:center;margin:18px 0 0;color:${T.seal};letter-spacing:.6em">◆ ◆ ◆</div>`
    : ''
  const bandOpen = v === 2
    ? `<div style="background:#EFE6CE;margin:0 -16px;padding:20px 16px">`
    : `<div>`
  return { head, sub, close, bandOpen, bandClose: '</div>' }
}

/* ------------------------------------------------------------ the states */
function skeletonCard(club, title, lines) {
  const body = Array.from({ length: lines }, (_, i) =>
    `<div class="sk skline" style="width:${[100, 88, 94, 72, 90, 80][i % 6]}%"></div>`).join('')
  return card(club, title, null, body)
}

function bandBody(state, club) {
  if (state === 'loading') {
    return {
      first: skeletonCard(club, 'National League Central', 5) + skeletonCard(club, 'Season report', 4),
      second: skeletonCard(club, 'Records', 14) + skeletonCard(club, 'Record by day of week', 4) +
        skeletonCard(club, 'Comeback wins', 6),
    }
  }
  if (state === 'nodata') {
    const none = (title, msg) => card(club, title, null, `<div class="empty">${esc(msg)}</div>`)
    return {
      first: none('National League Central', 'No standings posted for this division yet.') +
        none('Season report', 'The season grade needs ten games. This club has not played them.'),
      second: none('Records', 'No splits posted for this club yet.') +
        none('Record by day of week', 'No games played.'),
    }
  }
  return {
    first: standingsCard(club, club === 249 ? STANDINGS_249 : STANDINGS_158) + teamScoreCard(club),
    second: recordsCard(club) + dowCard(club) + comebacksCard(club),
  }
}

/* ------------------------------------------------------------- the artboard */
function board({ title, v, state, club = 158, h, reduced = false, jumpOn = 'Standing' }) {
  const f = furniture(v)
  const b = bandBody(state, club)
  const stateLabel = { loaded: 'Loaded', loading: 'Loading', nodata: 'No data' }[state]

  const jump = ['Standing', 'Ranks', 'Games', 'Roster', 'Farm', 'Money', 'About']
    .filter((n) => !(club !== 158 && (n === 'Money' || (club === 675 && n === 'Farm'))))
    .map((n) => `<span class="jp${n === jumpOn ? ' on' : ''}">${n}</span>`).join('')

  const second = reduced
    ? recordsCard(club) + dowCard(club)
    : b.second

  const first = reduced
    ? standingsCard(club, STANDINGS_249)
    : b.first

  const body = `
  <div style="width:${W}px;height:${h}px;background:${T.paper0};overflow:hidden">
    <div class="jumpstuck" style="padding:0 16px">
      <div class="jump">${jump}</div>
    </div>
    <div style="padding:0 16px 24px">
      <div style="height:48px"></div>
      ${f.bandOpen}
        ${f.head('Standing', v === 4 ? STANDFIRST.standing : QUESTION, '')}
        ${first}
        ${f.sub('Record, split every way')}
        ${second}
        ${f.close}
      ${f.bandClose}
      <div style="height:48px"></div>
      ${v === 4
        ? `<div class="brule"></div><div class="bhead4">Ranks</div>
           <p class="bq4">${esc(club === 158 ? STANDFIRST.ranks : STANDFIRST.ranks249)}</p>`
        : `<div class="bhead">Ranks</div>
           <p class="bq">Where does this club sit among the rest?</p>`}
      <div class="card" style="opacity:.45"><div class="chead" style="${CLUBS[club].themed
        ? `background:${CLUBS[club].bar};border-bottom:3px solid ${CLUBS[club].accent};color:${CLUBS[club].onBar}`
        : `background:transparent;border-bottom:1px solid ${T.ruleSoft};color:${T.graphite}`}">
        <span>Team batting</span><em>rank out of 30</em></div>
        <div class="cbody"><div class="cap">the next band begins — shown so the seam is judged, not described</div></div></div>
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
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${W},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`
}

/* ------------------------------------------------------------------ emit */
const H_LOADED = 5200
const H_SHORT = 1500
const H_REDUCED = 4600

const BOARDS = [
  ['Main.dc.html', { title: 'v1 · loaded', v: 1, state: 'loaded', h: H_LOADED }],
  ['V1-Loading.dc.html', { title: 'v1 · loading', v: 1, state: 'loading', h: H_SHORT }],
  ['V1-Empty.dc.html', { title: 'v1 · no data', v: 1, state: 'nodata', h: H_SHORT }],
  ['V2-Loaded.dc.html', { title: 'v2 · loaded', v: 2, state: 'loaded', h: H_LOADED }],
  ['V2-Loading.dc.html', { title: 'v2 · loading', v: 2, state: 'loading', h: H_SHORT }],
  ['V2-Empty.dc.html', { title: 'v2 · no data', v: 2, state: 'nodata', h: H_SHORT }],
  ['V3-Loaded.dc.html', { title: 'v3 · loaded', v: 3, state: 'loaded', h: H_LOADED }],
  ['V3-Loading.dc.html', { title: 'v3 · loading', v: 3, state: 'loading', h: H_SHORT }],
  ['V3-Empty.dc.html', { title: 'v3 · no data', v: 3, state: 'nodata', h: H_SHORT }],
  ['V4-Loaded.dc.html', { title: 'v4 · loaded', v: 4, state: 'loaded', h: H_LOADED }],
  ['V4-Loading.dc.html', { title: 'v4 · loading', v: 4, state: 'loading', h: H_SHORT }],
  ['V4-Empty.dc.html', { title: 'v4 · no data', v: 4, state: 'nodata', h: H_SHORT }],
  ['V4-Reduced.dc.html', { title: 'v4 · Standing at Single-A', v: 4, state: 'loaded', club: 249, reduced: true, h: H_REDUCED }],
]

for (const [name, opts] of BOARDS) writeFileSync(join(OUT, name), board(opts), 'utf8')
console.log(`wrote ${BOARDS.length} artboards to ${OUT}`)

/* -------------------------------------------------------------- canvas.json
   Four columns, one per version, each stacked LOADED -> LOADING -> NO DATA.
   80px between frames in a row, 120 between rows, per the Design type's spec. */
const COL = 470
const FRAMES = {
  'Main.dc.html': [0, 0, 5200, 'v1 · the plain promotion'],
  'V1-Loading.dc.html': [0, 5320, 1500, 'v1 · loading'],
  'V1-Empty.dc.html': [0, 6940, 1500, 'v1 · no data'],
  'V2-Loaded.dc.html': [COL, 0, 5200, 'v2 · the band tint'],
  'V2-Loading.dc.html': [COL, 5320, 1500, 'v2 · loading'],
  'V2-Empty.dc.html': [COL, 6940, 1500, 'v2 · no data'],
  'V3-Loaded.dc.html': [COL * 2, 0, 5200, 'v3 · over-corrected'],
  'V3-Loading.dc.html': [COL * 2, 5320, 1500, 'v3 · loading'],
  'V3-Empty.dc.html': [COL * 2, 6940, 1500, 'v3 · no data'],
  'V4-Loaded.dc.html': [COL * 3, 0, 5200, 'v4 · SETTLED'],
  'V4-Loading.dc.html': [COL * 3, 5320, 1500, 'v4 · loading'],
  'V4-Empty.dc.html': [COL * 3, 6940, 1500, 'v4 · no data'],
  'V4-Reduced.dc.html': [COL * 4, 0, 4600, 'v4 · the reduced band, Single-A'],
  // Records reorganised (Gary, 2026-09-21). Generated by records/build-records.mjs
  // and copied in below, so `node build.mjs` stays the one regeneration command.
  'Rec-Closed.dc.html': [COL * 5, 0, 1400, 'Records · closed — 760px'],
  'Rec-Open.dc.html': [COL * 5, 1520, 2200, 'Records · two groups open'],
  'Rec-All.dc.html': [COL * 5, 3840, 3700, 'Records · all open — 3,039px'],
  'Rec-249-Closed.dc.html': [COL * 6, 0, 1400, 'Records · Single-A, closed — 715px'],
  'Rec-249.dc.html': [COL * 6, 1520, 2200, 'Records · Single-A, open'],
  'Rec-249-All.dc.html': [COL * 6, 3840, 3700, 'Records · Single-A, all open'],
}

// The six Records boards are generated by records/build-records.mjs into
// records/boards/. Copy them in so the canvas publishes from one folder.
for (const name of Object.keys(FRAMES)) {
  if (!name.startsWith('Rec-')) continue
  const from = join(HERE, 'records', 'boards', name)
  if (existsSync(from)) copyFileSync(from, join(OUT, name))
  else console.warn(`missing ${name} — run records/build-records.mjs first`)
}

const boards = {}
for (const [name, [x, y, h, title]] of Object.entries(FRAMES)) boards[name] = { x, y, w: W, h, title }

const note = (x, y, text, color, w = 330) => ({ x, y, text, color, w })

const canvas = {
  v: 3,
  createdOnFiles: { v: 1, at: new Date().toISOString() },
  title: 'Team page one-scroll — the band system',
  launch: { view: 'canvas' },
  pages: [],
  designSystems: [],
  boards,
  order: Object.keys(FRAMES),
  notes: {
    t1: { kind: 'title1', x: 0, y: -320, maxW: COL * 4 + W, w: 240,
      text: 'STANDING, four times — the page’s longest band' },
    n0: note(COL * 5, 0,
      'THE BAND: Standing on Milwaukee. 4,511px, five cards, and it holds Records — 3,238px and 61 door rows, 72% of the band and 7.7x the next card in it.\n\nEvery figure on these boards is real, scraped off the running page. Records is at TRUE proportion: a placeholder would hide the crowding that is the whole problem here.',
      'blue'),
    n1: note(COL * 5, 700,
      'v1 — the plain promotion. BroadcastSection (the report pages’ section head) dropped in, nothing else changed.\n\nWRONG:\n1. Hierarchy inverted — the club-coloured card bar out-shouts the band head. Scroll to RANKS and the band head is the quietest of the three.\n2. The sub-head is weaker than the card it introduces, and it is the mechanism for the Records problem.\n3. The question is decoration. On Los Mochis it is load-bearing and nobody will see it.',
      'orange'),
    n2: note(COL * 5, 1560,
      'v2 — the band tint, which 1D.4 asked step 2 to decide.\n\nWRONG:\n1. It does nothing the 48px seam was not already doing.\n2. It makes a third paper value, so the card sits on tint sits on canvas — and the canvas now survives only in thin strips.\n3. Tint every band and it is a new page colour, not a band device. Alternate them and the band head sits on two grounds, which is a second variant. Rejected, and drawn so the rejection is visible.',
      'orange'),
    n3: note(COL * 5, 2420,
      'v3 — over-corrected, on purpose.\n\nRIGHT: the full-width rule ABOVE the head fixes v1’s inverted hierarchy outright.\n\nWRONG:\n1. Two rules for one head — the rule above and the trailing clay rule. One is redundant.\n2. “1 / 7” duplicates the jump bar, which already shows position.\n3. The closing dinkus marks an end the next band’s opening already marks.',
      'orange'),
    n4: note(COL * 5, 3280,
      'v4 — settled. v3’s rule, minus v3’s three accessories.\n\nThe band head opens on a FULL-BLEED 2px ink rule. A card is inset 16px and rounded; a rule running edge to edge is a PLANE no card can reach at any weight or colour — and a plane difference survives a one-handed glance where a weight difference does not.\n\nThe sub-head is the same gesture one step down: full-bleed, 1px, pencil. So the page reads FULL-BLEED = page structure, CONTAINED = card structure. Four levels, two devices, two planes.',
      'green'),
    n5: note(COL * 5, 4300,
      'AND THE QUESTION BECAME A STANDFIRST. scope.md names each band by its question, and v1–v3 print it. A second screen ANSWERS; it does not ask. Seven interrogatives are seven lines the reader must read to find they carry no information.\n\nv4 prints what is in the band instead — and that line is also where 2G’s level qualifier and Money’s “not dated” note land, because those are sentences.',
      'green'),
    n6: note(COL * 4, 4800,
      'THE REDUCED BAND, Single-A. Three cards: standings, Records, day-of-week. Team Score, Comebacks and Last Time are all MLB-only and simply absent.\n\nWilson’s own figures, not Milwaukee’s — and they carry a shape MLB never has: a MiLB record can end in a TIE, so the value is three parts (49-56-1), not two. The figure column has to be sized for it.',
      'blue'),
    n7: note(COL * 3, 8560,
      'LOADING shows the band head, the standfirst and the SHAPE — one skeleton per card the band will have — because which cards exist is decided from cheap identity data before any fetch.\n\nIt does NOT reserve Records’ 3,238px. A skeleton cannot honestly pretend to be four screens tall, so the page does jump when Records lands. Naming that rather than hiding it.',
      'blue'),
    n9: note(COL * 7, 0,
      'RECORDS, REORGANISED — Gary, 2026-09-21. Nothing removed; every row still on this page.\n\nThe twelve groups stop being headings inside a wall and BECOME the wall: each is a 44px ledger line carrying how many splits are behind it and the spread of win pct inside it. The spread is a finding, not a label — Leading and trailing runs .075–.966, Defense runs .544–.677, and today you read 61 rows to learn that.\n\n3,238px to 760px closed. 3.84 phone screens to 0.90.',
      'green'),
    n10: note(COL * 7, 1200,
      'CLOSED ON ARRIVAL. The sub-head above already says this material is reference, and a reference section opens at its contents. A scorekeeper wants ONE of these rows and which one changes with the inning, so opening any by default is right for almost nobody. Open all restores today\u2019s card in one tap — and fully open is 3,039px, SHORTER than today, so it is not a punishment.\n\nOpen groups persist in sessionStorage, per tab. They must survive a navigation, because every row is a door to /situational-records and plain state would close the group you just drilled out of. They must NOT persist across devices: ADR-0049 stores a consent, not a preference.',
      'blue'),
    n8: note(COL * 2, 8560,
      'NO DATA is the band rendering when its fetch returned nothing. The head and standfirst are there because they were never fetched.\n\nEach card states what is missing, in natural case, in the app’s voice. No apology, and no action offered — this is a read-only second screen, so there is nothing for the reader to do.\n\nA band a club CANNOT fill is a different thing: it does not render at all, and it is not in the jump bar.',
      'blue'),
  },
}
writeFileSync(join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2), 'utf8')
console.log('wrote canvas.json')
