// THE BLOCK TABLE behind /design-lab's second half — every card block and pill
// block in src/styles/, with the partial that owns it, the modules that consume
// it, and the verdict proposed for issue #1113.
//
// This file is the PAGE's copy of `.scratch/design-system/inventory.md`. The
// markdown is the deliverable and the thing to read; this is the same table in
// a shape the page can render, so a verdict can be checked by looking at the
// block instead of by reading about it. When one changes, change both — the
// markdown first, because it is the one that has to survive this page.
//
// `group` sorts the entries into the five findings the inventory draws:
//   sheet     — draws the same box as every other sheet. Merge.
//   dense     — the same box at --radius-sm with no shadow. Merge as a variant.
//   namespace — owns NO base rule. Draws no box. Nothing to merge.
//   notcard   — the name says card and the block is not one.
//   bespoke   — a deliberate difference. A merge here is a regression.
//
// Counts are measured, not remembered: `node .scratch/design-system/inventory.mjs`.

export const SHEET_RECIPE = [
  'border: var(--bw-hair) solid var(--border-rule)',
  'border-radius: var(--radius-md)',
  'background: var(--surface-card)',
  'box-shadow: var(--shadow-card)',
]

export const PILL_RECIPE = [
  'display: inline-flex; align-items: center',
  'font-family: var(--font-display); font-size: var(--fs-label)',
  'letter-spacing: var(--ls-label); text-transform: uppercase',
  'padding: 2px var(--space-1h); border-radius: var(--radius-pill)',
]

// ---------------------------------------------------------------------------
// CARDS — 31 blocks.
export const CARDS = [
  {
    cls: 'card card--sheet',
    partial: 'system/card.css',
    consumers: 16,
    group: 'sheet',
    verdict: 'Canonical',
    note: 'The Card component’s sheet (#1113). The team hub’s card moved onto it first: sixteen modules. Four of them pass a box-less namespace as className (chal, rvclub, depthchart, horizoncard), the variant pattern the hub already used.',
  },
  {
    cls: 'card card--sheet absframe',
    partial: 'system/card.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merged — sheet',
    note: 'Was the wide ABS card block: the sheet, plus overflow:hidden. It is a Card now (#1113, slice C4), and .absframe keeps only when it shows. Hidden below 740px, so it draws nothing on a phone.',
  },
  {
    cls: 'card card--sheet entering',
    partial: 'system/card.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merged — sheet',
    note: 'Was the entering-lineup card block: the sheet, plus a margin and overflow:hidden. It is a Card now (#1113, slice C4), and .entering keeps only its margin.',
  },
  {
    cls: 'card card--sheet metric',
    partial: 'system/card.css',
    consumers: 5,
    group: 'sheet',
    verdict: 'Merged',
    note: 'Was the sheet and a margin-top. It is a Card now (#1113, slice C3), and .metric keeps only the margin.',
  },
  {
    cls: 'card card--sheet starter',
    partial: 'system/card.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merged',
    note: 'Shared one rule with .lineup and .opp. All three are Cards now (#1113, slice C3), and that rule keeps only the margin-top.',
  },
  {
    cls: 'card card--sheet teammate',
    partial: 'system/card.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merged',
    note: 'Was the sheet, plus a three-column grid and break-inside:avoid. It is a Card now (#1113, slice C3), and .teammate keeps the grid and the column break.',
  },
  {
    cls: 'card card--sheet trade',
    partial: 'system/card.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merged',
    note: 'Was the sheet, plus padding that tightens under 420px. It is a Card now (#1113, slice C6b), and .trade keeps the padding.',
  },
  {
    cls: 'card card--sheet rehabcard',
    partial: 'system/card.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merged',
    note: 'Was the sheet with NO shadow, centred. It is a Card now (#1113, slice C6b), so it gains the shadow, and .rehabcard keeps the centred column.',
  },
  {
    cls: 'stampcard',
    partial: '48-logbook.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Hold',
    note: 'Geometry says merge — the sheet without a shadow. ADR-0035 says stop: stamp surfaces are safe because of WHERE stamp art may render, and check-stamp-surfaces.mjs enforces that list. Read it before touching this row.',
  },
  {
    cls: 'card card--sheet card--interactive offday__tile',
    partial: '06b-offday-cards.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merge — interactive',
    note: 'The sheet plus hover lift, focus ring and press. Its hover and focus mix --offday-accent into the border, which is club identity reaching the card surface. A generic interactive variant must keep that.',
  },
  {
    cls: 'gamecard',
    partial: '06-loader-and-cards.css',
    consumers: 4,
    group: 'bespoke',
    verdict: 'Stays bespoke',
    note: 'The slate card and the app’s front door — 112 selector hits, the most of any block. Its border is deliberately darker than the sheet: color-mix(--border-rule 35%, --text-muted 65%). It also carries park art and the @ watermark.',
  },
  {
    cls: 'phcard',
    partial: '72-player-hover-card.css',
    consumers: 1,
    group: 'bespoke',
    verdict: 'Stays bespoke',
    // The app positions this one FIXED. Its stage becomes the containing block
    // so the specimen draws inside its own entry (Entry.jsx's `contained`), and
    // the entry spans the grid because the popover is a real 300px wide — the
    // frame gives way to the specimen, never the other way round.
    contained: true,
    wide: true,
    note: 'position:fixed, pointer-events:none, z-index 100, --border-hairline and --shadow-raised. It is a popover. Popovers and cards diverge the moment either one grows.',
  },
  {
    cls: 'tally-cl-card',
    partial: '04-site-bar.css',
    consumers: 1,
    group: 'bespoke',
    verdict: 'Stays bespoke',
    note: 'Every declaration is !important, because it dresses Clerk’s own DOM inside a component this app does not render. It has to keep winning.',
  },
  {
    cls: 'pswscard',
    partial: '34-postseason.css',
    consumers: 1,
    group: 'bespoke',
    verdict: 'Stays bespoke',
    note: '1.5px solid var(--award-line) on --surface-inset. A championship is a medal, so it keeps a medal-amber edge rather than the paper-sheet one. It read var(--seal) until ADR-0083 — a World Series card is not a cover.',
  },

  {
    cls: 'card card--ledger playerline',
    partial: 'system/card.css',
    consumers: 5,
    group: 'dense',
    verdict: 'Merged — ledger',
    note: 'Was the performer tile block: --radius-sm, no shadow, 8px padding, flex row. It is a ledger Card now (#1113, slice C5), under its ledger name .playerline, and keeps only its padding and flex row.',
  },
  {
    cls: 'card card--ledger seed',
    partial: 'system/card.css',
    consumers: 2,
    group: 'dense',
    verdict: 'Merged — ledger + interactive',
    note: 'Was the tight sheet with a pointer. It is a ledger Card now (#1113, slice C6a); on the postseason history page the tap tile is a Card button. .seed keeps its layout and sets overflow: visible, so the bracket connectors still show.',
  },
  {
    cls: 'card card--ledger tstats',
    partial: 'system/card.css',
    consumers: 4,
    group: 'dense',
    verdict: 'Merged — ledger',
    note: 'Was the tstats card block: the tight sheet plus overflow:hidden. It is a ledger Card now (#1113, slice C1), and .tstats is its namespace.',
  },
  {
    cls: 'card card--ledger prospectcard',
    partial: 'system/card.css',
    consumers: 1,
    group: 'dense',
    verdict: 'Merged — ledger + accent',
    note: 'Was the tight sheet with a 3px --accent-primary rule on top. It is a ledger Card now (#1113, slice C2), and .prospectcard keeps only the accent rule and its margin.',
  },

  {
    cls: 'chal',
    partial: 'report/challenge-card.css',
    consumers: 1,
    group: 'namespace',
    verdict: 'Already correct',
    note: 'Renders as `<Card className="chal">`: a canonical card plus a box-less namespace. The Card component generalises this pattern (#1113).',
  },
  {
    cls: 'rvcard',
    partial: '75-run-value.css',
    consumers: 2,
    group: 'namespace',
    verdict: 'Already correct',
    note: 'Same shape: `<Card className="rvclub">`, with every .rvcard rule an __element.',
  },
  {
    cls: 'ballparkcard',
    partial: '57-ballpark-card.css',
    consumers: 1,
    group: 'namespace',
    verdict: 'Already correct',
    note: 'Fifteen selector hits, every one an __element, inside a Card.',
  },
  {
    cls: 'horizoncard',
    partial: '31-wild-card.css',
    consumers: 2,
    group: 'namespace',
    verdict: 'Already correct',
    note: 'No base rule. Sits on a Card.',
  },
  {
    cls: 'advcard',
    partial: '26-player-page.css',
    consumers: 1,
    group: 'namespace',
    verdict: 'Leave',
    note: 'Two __element rules and no box. Rename to .adv at most.',
  },
  {
    cls: 'foulcard',
    partial: '26-player-page.css',
    consumers: 1,
    group: 'namespace',
    verdict: 'Leave',
    note: 'Three __element rules and no box.',
  },
  {
    cls: 'scorecard',
    partial: 'scorecard/grid.css + scorecard/page.css',
    consumers: 39,
    group: 'notcard',
    verdict: 'Never merge',
    note: 'Not a card at all — a block of thirteen custom properties that size the paper grid (--sc-cell-w, --sc-name-w, --sc-strike-fill, and ten more). No border, no background. Thirty-nine modules read it, src/api/ among them. It is the app’s reason to exist.',
  },
  {
    cls: 'flipcard',
    partial: '22-box-score-tables.css',
    consumers: 1,
    group: 'notcard',
    verdict: 'Leave',
    note: 'One declaration: perspective: 1400px. A 3D transform container.',
  },
  {
    cls: 'delaycard',
    partial: '27-player-position-innings.css',
    consumers: 1,
    group: 'notcard',
    verdict: 'Leave',
    note: 'A notice, not a card: a 3px left rule in --navy, a tinted fill and a pop-in.',
  },
  {
    cls: 'txcard',
    partial: '29-team-transactions.css',
    consumers: 1,
    group: 'notcard',
    verdict: 'Leave',
    note: 'display:grid and a margin. A transaction row.',
  },
  {
    cls: 'derbycard',
    partial: '06-loader-and-cards.css',
    consumers: 1,
    group: 'notcard',
    verdict: 'Leave',
    note: 'text-decoration:none and cursor:pointer, applied ON TOP of a .gamecard. It is a modifier wearing a block’s name.',
  },
  {
    cls: 'contractcard',
    partial: '26b-player-contract.css',
    consumers: 1,
    group: 'notcard',
    verdict: 'Leave',
    note: 'One declaration: margin-top. A section wrapper given a card name.',
  },
  {
    cls: 'moundcard',
    partial: '26c-mound-card.css',
    consumers: 1,
    group: 'notcard',
    verdict: 'Leave',
    note: 'One declaration: margin-block-start.',
  },
]

// ---------------------------------------------------------------------------
// PILLS — 10 blocks. Four are the same pill but for three values.
export const PILLS = [
  {
    cls: 'milestonepill',
    partial: '31-wild-card.css',
    consumers: 1,
    group: 'tone',
    verdict: 'Merged — Pill (#1131)',
    fill: 'Now <Pill ink="--accent-primary">. The recipe it held is .pill in system/pill.css.',
    pill: { ink: '--accent-primary' },
  },
  {
    cls: 'rookiepill',
    partial: '31-wild-card.css',
    consumers: 1,
    group: 'tone',
    verdict: 'Merged — Pill (#1131)',
    fill: 'Now <Pill ink="--field">. No class of its own.',
    pill: { ink: '--field' },
  },
  {
    cls: 'prospectpill',
    partial: '31-wild-card.css',
    consumers: 2,
    group: 'tone',
    verdict: 'Merged — Pill (#1131)',
    fill: 'Now <Pill className="prospect__tag"> with no ink: the neutral outline. .prospect__tag is a hook for two context rules.',
    pill: { className: 'prospect__tag' },
  },
  {
    cls: 'duepill',
    partial: '31-wild-card.css',
    consumers: 1,
    group: 'tone',
    verdict: 'Merge — tone seal',
    fill: '--seal-cover / --seal-cover-ink / --seal-deep — one of the 21 partials ADR-0083 leaves on kraft, because the due-up pill IS a reveal surface',
  },
  {
    cls: 'mastheadpill',
    partial: '10-lineup.css',
    consumers: 4,
    group: 'interactive',
    verdict: 'Merged — Pill (#1131)',
    fill: 'Now <Pill role="control" fill="paper" pressed>: a 34px paper control, because it rides a club bar. Pressed is the Pill’s navy with a tick. .mastheadpill keeps only its state dot.',
    pill: { role: 'control', fill: 'paper', pressed: false },
  },
  {
    cls: 'psodds-pill',
    partial: '39-manager-page.css',
    consumers: 2,
    group: 'interactive',
    verdict: 'Merged — Pill (#1131)',
    fill: 'Now <Pill role="control" fill="ink">: the one action on a card’s band, 34px, navy with paper text (seal-filled until ADR-0083). On a club-themed band it is a paper chip, a host tint through the pill’s own properties (09-team-info.css).',
    pill: { role: 'control', fill: 'ink' },
  },
  {
    cls: 'tierpill',
    partial: '09-team-info.css',
    consumers: 1,
    group: 'interactive',
    verdict: 'Merged — Pill (#1131)',
    fill: 'Now <Pill className="tier__tag tier__tag--elite">: a tier is a tint that sets the custom properties of the pill (09-team-info.css).',
    pill: { className: 'tier__tag tier__tag--elite' },
  },
  {
    cls: 'reg-pill',
    partial: '26-player-page.css',
    consumers: 2,
    group: 'notpill',
    verdict: 'Leave — and rename',
    fill: 'border-radius: var(--radius-xs) — 3px, not a capsule',
  },
  {
    cls: 'debutpill',
    partial: '31-wild-card.css',
    consumers: 1,
    group: 'notpill',
    verdict: 'Leave',
    fill: 'The shell only, no typography. It holds an icon.',
  },
  {
    cls: 'radarpill',
    partial: '31-wild-card.css',
    consumers: 1,
    group: 'notpill',
    verdict: 'Leave',
    fill: 'No base rule — namespace only, like the card namespaces above.',
  },
]

// ---------------------------------------------------------------------------
// PROTOTYPES — a design proposal, not a shipped block. The one band on this
// page that draws geometry of its own: its partial (styles/designlab/scout.css)
// is the proposal, on invented data, and it leaves when the real page ships.
export const PROTOTYPES = [
  {
    id: 'scout',
    title: 'Matchup Scout (#1408)',
    path: 'src/screens/designlab/scout/',
    verdict: 'Prototype',
    note: 'Spec: docs/scout-design.md. Thirteen regions, the pitcher’s and hitter’s mirror, every control and every state, on an invented pair. The head-to-head fixture has a row dated today; the cutoff must hide it.',
  },
]

export const GROUP_TITLES = {
  sheet: 'The sheet — one box, ten names',
  dense: 'The tight sheet — --radius-sm, no shadow',
  namespace: 'Namespace only — these draw no box at all',
  notcard: 'Not a card — the name says card and the block is not one',
  bespoke: 'Bespoke on purpose — a merge here is a regression',
  tone: 'One pill, four tones — identical but for three values',
  interactive: 'The same pill with its own padding',
  notpill: 'Not a pill',
}
