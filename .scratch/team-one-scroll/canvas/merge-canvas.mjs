// MERGES THE PHASE 2 BOARDS ONTO THE LIVE CANVAS INDEX.
//
// canvas.json is HAND-POSITIONED — Gary moves the notes in the editor — so the
// generated index is never published. This reads the live one, adds only the
// Phase 2 keys, and writes the result for publishing. Every Phase 1 board,
// note and coordinate comes through untouched.
//
//   node .scratch/team-one-scroll/canvas/merge-canvas.mjs <live canvas.json> <out canvas.json>
import { readFileSync, writeFileSync } from 'node:fs'

const [livePath, outPath] = process.argv.slice(2)
const idx = JSON.parse(readFileSync(livePath, 'utf8'))

const COL = 470
const X0 = 4900          // clear of Phase 1, whose rightmost note ends at 4430
const ROW2 = 2000        // the pages, under the studies

// [name, x, y, h, title]
const P2 = [
  ['P2-Ranks-249.dc.html', X0, 0, 1015, 'RANKS · Single-A — one card'],
  ['P2-Ranks-556.dc.html', X0 + COL, 0, 1790, 'RANKS · Triple-A — ABS above the ledger'],
  ['P2-About-249.dc.html', X0 + COL * 2, 0, 1570, 'ABOUT · four modules, as they ship'],
  ['P2-About-249-Carded.dc.html', X0 + COL * 3, 0, 1660, 'ABOUT · all four carded'],
  ['P2-About-158.dc.html', X0 + COL * 4, 0, 1465, 'ABOUT · MLB, two modules'],
  ['P2-About-675.dc.html', X0 + COL * 5, 0, 570, 'ABOUT · the floor, 349px'],
  ['P2-Jump.dc.html', X0 + COL * 6, 0, 1680, 'THE JUMP BAR · four states'],
  ['P2-Page-675.dc.html', X0, ROW2, 7960, 'THE FLOOR · Los Mochis, five bands, 7,110px'],
  ['P2-Page-158-1.dc.html', X0 + COL, ROW2, 5370, 'MILWAUKEE 1 of 3 · Standing · Ranks'],
  ['P2-Page-158-2.dc.html', X0 + COL * 2, ROW2, 6825, 'MILWAUKEE 2 of 3 · Games · Roster'],
  ['P2-Page-158-3.dc.html', X0 + COL * 3, ROW2, 7620, 'MILWAUKEE 3 of 3 · Farm · Money · About'],
  ['P2-Page-249-Diff.dc.html', X0 + COL * 4, ROW2, 6355, 'WILSON · what else differs'],
]

for (const [name, x, y, h, title] of P2) {
  idx.boards[name] = { x, y, w: 390, h, title }
  if (!idx.order.includes(name)) idx.order.push(name)
}

const NX = X0 + COL * 7   // one column of notes, clear of every board
const note = (i, text, color) => ({ x: NX, y: i * 940, w: 330, text, color })

Object.assign(idx.notes, {
  t2: {
    kind: 'title1', x: X0, y: -320, maxW: COL * 7 + 390, w: 240,
    text: 'PHASE 2 — the system at page scale',
  },
  p1: note(0,
    'RANKS AT SINGLE-A — the hard case, and the one 2G named. ONE card under a full-width head, and the head '
    + 'has to make that read as a stated fact about the level rather than as a band that was cut short.\n\n'
    + 'The standfirst does it: "The league rank boards start at Triple-A, so this is the club’s own leaders." '
    + 'That is 2G’s level qualifier, in the slot v4 already built for it — no right-aligned action, which this '
    + 'page uses zero times.\n\n'
    + 'At 556 Nashville the ABS card simply slots in above the ledger under the same head: two cards, 1,014 + '
    + '534 = 1,548px, no new furniture and no variant.', 'green'),
  p2: note(1,
    'AND THE LEDGER IS WHERE THE HEAD PROBLEM IS WORST. It is not a .thub-card at all — it is a page-level '
    + 'group label with two doors, over two sub-cards whose bars are --accent-primary, the APP’s navy, never '
    + 'the club’s.\n\n'
    + 'So on Wilson an app-navy bar sits 16px under a club-navy one, and on Nashville it sits under crimson. '
    + 'Checked in the CSS rather than inferred: 23-box-score-detail.css:367 and colors.css:110. design.md §3 '
    + 'recorded this as "a themed bar on each of its two sub-cards", which is wrong, and the correction is in '
    + 'Part Two.', 'orange'),
  p3: note(2,
    'ABOUT, FOUR UNLIKE MODULES — 1,357px at Wilson, and the band that has to hold a real band AND read as '
    + 'the page’s close.\n\n'
    + 'It does both, and the drawing shows why it nearly does not: the four modules arrive in TWO chromes. The '
    + 'ballpark and the marks are cards. The affiliation history and Made The Show are bare page-level labels '
    + 'with no card at all, at 14.4px — which at band scale reads as a DIVISION of the band rather than as a '
    + 'module in it.\n\n'
    + 'All four sit 16px apart, not 32: 32 is the sub-head’s spacing, and About gets no sub-head. The page '
    + 'uses two-sections-under-one-head exactly once, in Standing, and the restraint is the point.', 'blue'),
  p4: note(3,
    'THE SAME FOUR, CARDED. Nothing about the card changes — design.md §4 keeps it exactly as shipped. It is '
    + 'APPLIED to the two modules that never had one.\n\n'
    + 'This is the single largest item on #1107’s element-by-element list, and it is drawn beside the shipped '
    + 'version so it is looked at rather than argued.\n\n'
    + 'And the Ballpark at 93px is the page’s one undrawn empty: a head and a single line of text, with no '
    + 'diagram, no dimensions, no photo and no "not posted yet". Carding the other two makes it the only '
    + 'module in the band that still looks like it failed to load.', 'green'),
  p5: note(4,
    'THE JUMP BAR — and the one thing it needs that a tab bar never did.\n\n'
    + 'A tab bar’s current tab is wherever the reader tapped it, so it is on screen by definition. A jump '
    + 'bar’s current pill changes by SCROLLING THE PAGE. Measured in the shipped control, the band names want '
    + '472px at Milwaukee in 358px of room — and the two that fall off the end are Money and About, the last '
    + 'two bands. A reader four screens into a 17,594px page arrives in About and the mark that says so is '
    + 'off the end of a control nobody has touched. The bar has to scroll itself.\n\n'
    + 'Resting carries no rule; stuck adds one 1px pencil rule and NO new shadow — this is paper, and the '
    + 'control already carries --shadow-card.\n\n'
    + 'Club-neutral navy per ADR-0030, and it is HubTabBar: the player hub gets the same object in the same '
    + 'commit.', 'green'),
  p6: note(5,
    'THE FLOOR — Caneros de los Mochis, five bands, 7,110px, and the page no board had shown.\n\n'
    + 'This club is UNTHEMED: headerThemeFor returns null, so every card head is graphite on transparent over '
    + 'a hairline, and the band head’s 2px ink rule is THE ONLY STRUCTURAL COLOUR ON THE PAGE. That is the '
    + 'band system carrying the page when the club theme cannot.\n\n'
    + 'Two seams here exist nowhere else. Farm and Money are ABSENT — not rendered, not in the bar, and there '
    + 'is no gap to read as broken. And Roster is 3,917px, LARGER than Milwaukee’s, because the winter 40-man '
    + 'is one uncapped list of 55 players. The floor page is lopsided, not small.\n\n'
    + 'Standing has no Records card, so its standfirst says "the record by day". A head that promised "split '
    + 'every way" would be describing a card that is not there.', 'green'),
  p7: note(6,
    'MILWAUKEE — seven bands, everything present, 17,594px. It runs across three frames because the Design '
    + 'type stops a frame at 8,000px; the page itself does not stop.\n\n'
    + 'WHAT THE SYSTEM COSTS, measured on the drawing rather than added up: 1,554px of furniture at Milwaukee '
    + 'and 648px at the floor — 8.8% and 9.1% of each page’s card height.\n\n'
    + 'Near enough the same, and that is the answer to whether a thin page pays more for the system than a '
    + 'long one. It does not, because the furniture scales with the number of BANDS and a thin club has fewer '
    + 'of them. Fixed chrome on a smaller page normally costs proportionally more. Here it does not.', 'blue'),
  p8: note(7,
    'WILSON IS A CHECK, NOT AN ARTBOARD. Its Ranks and its About are drawn above; the system holds at six '
    + 'bands and this is the rest of what differs.\n\n'
    + 'Games is two cards, not four — no Highlights and no Photos below MLB. Roster is three, not five — no '
    + 'bullpen health, no transactions deck. Both are absences INSIDE a band, which cost nothing, because the '
    + 'band head is what carries the rhythm and it is identical.\n\n'
    + 'Farm is the ONE head that differs: it names the org whose ladder is shown, which is 2G’s second '
    + 'qualifier and lands in the same standfirst slot as the level. The four cards under it are Milwaukee’s, '
    + 'unchanged, because all three affiliates share one org’s system.\n\n'
    + '572 is identical to this. 556 differs by one card, in Ranks.', 'blue'),
  p9: note(8,
    'WHAT IS REAL AND WHAT IS SHAPE, stated on every page board rather than implied.\n\n'
    + 'Every card is at its MEASURED height, off the running page on 2026-09-21. The page totals are the sum, '
    + 'and all three were re-measured rather than trusted: 17,594 / 11,332 / 7,110, band by band. Nothing '
    + 'moved.\n\n'
    + 'The cards this study draws carry their real figures. The other ~20 carry the card’s true GEOMETRY with '
    + 'their figures ghosted — because the first draft printed figures into them and the floor page came back '
    + 'with Milwaukee’s opponents on Los Mochis’ schedule. A board that invents a figure is worse than one '
    + 'that shows none.', 'orange'),
})

writeFileSync(outPath, JSON.stringify(idx, null, 2), 'utf8')
console.log(`merged ${P2.length} boards and 10 notes onto the live index -> ${outPath}`)
console.log(`boards now: ${Object.keys(idx.boards).length}  ·  order: ${idx.order.length}  ·  notes: ${Object.keys(idx.notes).length}`)
