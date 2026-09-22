// THE SETTLED BAND SYSTEM, in one place, because design.md §5's first number is
// "ONE band-head treatment · 7 uses · 0 variants". Two builders draw this page —
// build.mjs (Phase 1, the four versions of the Standing band) and
// build-phase2.mjs (Ranks, About, the jump bar and the full pages) — and if each
// carried its own copy of the head, the canvas would be the first thing to break
// the claim it is making.
//
// Every value here is a token from src/tokens/*.css read at its literal value.
// Nothing is invented: ten type sizes, three block spacings, no new token.
import { TOKENS as T, CLUBS } from './data.mjs'

export const W = 390

/* The club table, seeded from data.mjs and extensible: Phase 2 draws Nashville,
   which Phase 1 never needed. chead() reads THIS, so a club added here is drawn
   with its own triad everywhere. */
export const CLUB = { ...CLUBS }
export const addClub = (id, triad) => { CLUB[id] = triad }

/* The three block spacings. There is no fourth. The 12px under the band title
   and the 16px under its standfirst are INSIDE the head, not between blocks. */
export const SEAM = 48        // --space-12, above a band head
export const SUBSEAM = 32     // --space-8, above a sub-head
export const CARDGAP = 16     // --space-4, between two cards in a band

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* ------------------------------------------------------ the furniture's CSS
   Appended to each builder's own sheet. Holds only what BOTH builders draw:
   the card, the band head, the sub-head and the jump bar. */
export const SYSTEM_SHEET = `
*{box-sizing:border-box}
body{margin:0;background:${T.paper0};font-family:'Source Sans 3',system-ui,sans-serif;color:${T.ink1};
  -webkit-font-smoothing:antialiased}
a{color:${T.field};text-decoration:none}a:hover{color:${T.field}}
.u{text-transform:uppercase}
.disp{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-weight:700}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;letter-spacing:.01em}

/* ---- the card, exactly as shipped (09-team-info.css). design.md §4: the card
   is right and stays. Nothing here changes it. ---- */
.card{border:1px solid ${T.rule};border-radius:10px;background:${T.paper2};
  box-shadow:${T.shadowCard};overflow:hidden}
.card+.card{margin-top:${CARDGAP}px}
.chead{display:flex;align-items:baseline;flex-wrap:wrap;justify-content:space-between;gap:8px;
  padding:10px 16px;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;
  text-transform:uppercase;letter-spacing:.09em}
.chead>span{font-size:1.2em}
.chead em{font-style:normal;font-weight:400;font-size:12px;letter-spacing:.05em}
.cbody{padding:12px 16px 16px}

/* ---- THE BAND HEAD, settled at v4. A FULL-BLEED 2px ink rule, the name at
   --fs-h2 21px, then a standfirst at --fs-small 13px in --ink-1, natural case,
   16px under it.

   The rule runs edge to edge of the PAGE, not from the end of the words to the
   column edge. A card is inset 16px and rounded, so a rule that runs full-bleed
   is a plane no card can reach at any weight or colour — and a plane difference
   survives a one-handed glance where a weight difference does not.

   The standfirst is not the band's question. A second screen ANSWERS; it does
   not ask. It says what is in the band, and it is also where 2G's level
   qualifier and Money's "not dated" note land, because those are sentences. ---- */
.brule{height:2px;background:${T.ink0};margin:0 -16px 12px}
.bhead4{margin:0 0 10px;font-family:'Barlow Condensed',sans-serif;font-size:21px;font-weight:700;
  letter-spacing:.05em;text-transform:uppercase;color:${T.ink0};line-height:1.25}
/* 16px under the standfirst, not 12: the line belongs to the HEAD, and at 12px
   it sat close enough to the first card to read as that card's caption. */
.bq4{margin:0 0 16px;font-size:13px;line-height:1.45;color:${T.ink1}}

/* ---- THE SUB-HEAD: the same gesture one step down. Full-bleed, 1px, pencil
   rather than 2px ink. So the page reads FULL-BLEED = page structure,
   CONTAINED = card structure — four levels from two devices and two planes. ---- */
.srule{height:1px;background:${T.rule};margin:${SUBSEAM}px -16px 10px}
.shead{margin:0 0 12px;font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;
  letter-spacing:.05em;text-transform:uppercase;color:${T.ink1};line-height:1.2}

/* ---- THE JUMP BAR. It is the SHIPPED control (.teamtabs / .teamtabs__btn,
   46-consent-modal.css:345) drawn as it ships and not as a pill: a 6px-radius
   rect, 34px tall, --fs-label on --surface-card under --shadow-card, laid out
   flex:1 0 auto so a bar that fits stretches to the full width and a bar that
   does not scrolls sideways with its scrollbar hidden.

   Club-NEUTRAL navy per ADR-0030 — a club may colour a card that identifies the
   club, never page chrome — and it is HubTabBar, shared with the player hub, so
   it is drawn here as one control rather than as a team-page control. ---- */
.jump{overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;padding:8px 0}
.jump::-webkit-scrollbar{display:none}
.jump__row{display:flex;gap:6px;min-width:min-content}
.jump .jp{flex:1 0 auto;min-height:34px;display:flex;align-items:center;justify-content:center;
  padding:0 12px;white-space:nowrap;border-radius:6px;border:1px solid ${T.rule};
  background:${T.paper2};box-shadow:${T.shadowCard};color:${T.graphite};
  font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.09em}
.jump .jp.on{background:${T.navy};color:${T.paper2};border-color:${T.navy}}
/* Stuck adds ONE pencil rule and the page's own paper. No new shadow: this is
   paper, and the shadow is already the control's own. */
.jumpstuck{border-bottom:1px solid ${T.rule};background:${T.paper0}}
`

/* ---------------------------------------------------------- the standfirsts
   One per band. Three of them carry a sentence the head needs to say — Ranks
   below Triple-A (2G's level qualifier), Farm (the parent org) and Money (not
   dated) — and they say it here rather than in a right-aligned slot, because
   the standfirst is a sentence and those are sentences. */
export const STANDFIRST = {
  standing: 'Where they stand, and the record split every way.',
  standing249: 'Where they stand, and the record split every way.',
  // The floor has no Records card — team-records is precomputed per MLB club
  // only — so its Standing band is the table and the day. A standfirst that
  // promised "split every way" would be the head describing a card that is not
  // there, which is the one thing a band head must never do.
  standing675: 'Where they stand, and the record by day.',
  ranks: 'Where this club sits against its league.',
  ranks249: 'The league rank boards start at Triple-A, so this is the club’s own leaders.',
  ranks556: 'Where this club sits against its league. The rank boards start here, at Triple-A.',
  ranks675: 'Winter ball runs no rank boards, so this is the club’s own leaders.',
  games: 'Every game this season, and where they played it.',
  roster: 'Who plays here, and who arrived and left.',
  roster675: 'Who plays here. A winter roster is one uncapped list.',
  farm: 'The org ladder, and the players climbing it.',
  farm249: 'The Milwaukee Brewers’ ladder, and the players climbing it.',
  money: 'What the roster costs. This band does not move with the date.',
  about: 'The ballpark, and the marks this club wears.',
  about249: 'The ballpark, the marks, the orgs this club has worn, and who it sent up.',
  about675: 'The ballpark, and the marks this club wears.',
}

/* ------------------------------------------------------------- the pieces */
export const bandHead = (name, standfirst) =>
  `<div class="brule"></div><div class="bhead4">${esc(name)}</div>` +
  `<p class="bq4">${esc(standfirst)}</p>`

export const subHead = (t) => `<div class="srule"></div><div class="shead">${esc(t)}</div>`

export const seam = (px = SEAM) => `<div style="height:${px}px"></div>`

/* A club's card head. Themed clubs get the filled bar under a 3px accent; an
   UNTHEMED club (headerThemeFor returns null — every winter club, and most of
   several hundred (club, treatment) pairs) gets graphite on transparent over a
   hairline. On that page the band head's ink rule is the only structural colour
   there is, which is the band system carrying the floor when the theme cannot. */
export function chead(club, title, note, extra = '') {
  const c = CLUB[club]
  const style = c.themed
    ? `background:${c.bar};border-bottom:3px solid ${c.accent};color:${c.onBar}`
    : `background:transparent;border-bottom:1px solid ${T.ruleSoft};color:${T.graphite}`
  const em = note ? `<em style="opacity:.82">${esc(note)}</em>` : ''
  return `<div class="chead" style="${style}"><span>${esc(title)}</span>${em}${extra}</div>`
}

export const card = (club, title, note, body, extra = '') =>
  `<div class="card">${chead(club, title, note, extra)}<div class="cbody">${body}</div></div>`

/* The bands a club renders. A band a club cannot fill is ABSENT — not rendered,
   not in the jump bar — so this list IS the jump bar and the page both. */
export const BANDS = {
  158: ['Standing', 'Ranks', 'Games', 'Roster', 'Farm', 'Money', 'About'],
  556: ['Standing', 'Ranks', 'Games', 'Roster', 'Farm', 'About'],
  249: ['Standing', 'Ranks', 'Games', 'Roster', 'Farm', 'About'],
  675: ['Standing', 'Ranks', 'Games', 'Roster', 'About'],
}

// `shift` scrolls the bar, which is how the CURRENT band's pill is kept on
// screen: a tab bar's current tab is wherever the reader tapped it, so it is
// always visible; a jump bar's current pill changes by SCROLLING THE PAGE, so
// without this it can sit off the end of a bar nobody has touched.
export const jumpBar = (club, on, stuck = true, shift = 0) =>
  `<div class="${stuck ? 'jumpstuck' : ''}" style="padding:0 16px">
     <div class="jump"><div class="jump__row" style="transform:translateX(${-shift}px)">${
       BANDS[club].map((n) => `<span class="jp${n === on ? ' on' : ''}">${esc(n)}</span>`).join('')
     }</div></div>
   </div>`

/* ----------------------------------------------------------- the .dc.html
   The Design type's artboard wrapper. The root element takes a FIXED size equal
   to the board's w/h and the same $preview. */
export const page = (title, h, body, sheet) => `<!doctype html>
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
<style>${sheet}</style>
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
