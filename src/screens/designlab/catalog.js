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
  'font-family: var(--font-display); font-size: var(--fs-caption)',
  'letter-spacing: var(--ls-label); text-transform: uppercase',
  'padding: 2px 7px; border-radius: var(--radius-pill)',
]

// ---------------------------------------------------------------------------
// CARDS — 32 blocks.
export const CARDS = [
  {
    cls: 'thub-card',
    partial: '09-team-info.css',
    consumers: 16,
    group: 'sheet',
    verdict: 'Canonical',
    note: 'The team hub’s card, and the most-used box in the app. Four of its sixteen consumers already put a second, box-less class beside it — which is the variant pattern #1113 proposes, already shipped.',
  },
  {
    cls: 'abscard',
    partial: '12-sealbox.css + 25-wide-layout.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merge',
    note: 'The sheet, plus overflow:hidden. Hidden below 740px, so it draws nothing on a phone.',
  },
  {
    cls: 'lineupcard',
    partial: '12-sealbox.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merge',
    note: 'The sheet, plus a margin and overflow:hidden.',
  },
  {
    cls: 'metriccard',
    partial: '44-pre-game-cards.css',
    consumers: 5,
    group: 'sheet',
    verdict: 'Merge',
    note: 'The sheet and a margin-top. Nothing else.',
  },
  {
    cls: 'startercard',
    partial: '44-pre-game-cards.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merge',
    note: 'Shares one rule with .lineup and .opp, so three names already draw from one declaration block. The sheet exactly.',
  },
  {
    cls: 'teammatecard',
    partial: '10-lineup.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merge',
    note: 'The sheet, plus a three-column grid and break-inside:avoid.',
  },
  {
    cls: 'tradecard',
    partial: '47-trade-deadline.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merge',
    note: 'The sheet, plus padding that tightens under 420px.',
  },
  {
    cls: 'rehabcard',
    partial: '31-wild-card.css',
    consumers: 1,
    group: 'sheet',
    verdict: 'Merge — flat',
    note: 'The sheet with NO shadow, centred. One of the two that want a flat variant.',
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
    cls: 'offdaycard',
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
    note: 'The slate card and the app’s front door — 178 selector hits, the most of any block. Its border is deliberately darker than the sheet: color-mix(--border-rule 35%, --text-muted 65%). It also carries park art and the @ watermark.',
  },
  {
    cls: 'phcard',
    partial: '72-player-hover-card.css',
    consumers: 1,
    group: 'bespoke',
    verdict: 'Stays bespoke',
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
    note: '1.5px solid var(--seal) on --surface-inset. That is the kraft-tape vocabulary, not the paper-sheet one. The seal means something here; folding it into a card variant turns a metaphor into a border width.',
  },

  {
    cls: 'playercard',
    partial: '22-box-score-tables.css',
    consumers: 5,
    group: 'dense',
    verdict: 'Merge — dense',
    note: '--radius-sm, no shadow, 8px padding, flex row.',
  },
  {
    cls: 'seedcard',
    partial: '34-postseason.css',
    consumers: 2,
    group: 'dense',
    verdict: 'Merge — dense + interactive',
    note: '#1112 asks whether this and .prospectcard are one card. They are: both are the tight sheet. This one adds a pointer.',
  },
  {
    cls: 'tstats-card',
    partial: '31-wild-card.css',
    consumers: 4,
    group: 'dense',
    verdict: 'Merge — dense',
    note: 'The tight sheet plus overflow:hidden.',
  },
  {
    cls: 'prospectcard',
    partial: '31d-prospect-card.css',
    consumers: 1,
    group: 'dense',
    verdict: 'Merge — dense + accent',
    note: 'The tight sheet with a 3px --accent-primary rule on top. The accent is the only difference from .seedcard.',
  },

  {
    cls: 'chalcard',
    partial: 'report/challenge-card.css',
    consumers: 1,
    group: 'namespace',
    verdict: 'Already correct',
    note: 'Renders as `className="thub-card chalcard"` — a canonical card plus a box-less namespace. This is the pattern step 2 should generalise, not change.',
  },
  {
    cls: 'rvcard',
    partial: '75-run-value.css',
    consumers: 2,
    group: 'namespace',
    verdict: 'Already correct',
    note: 'Same shape: `className="thub-card rvclub"`, with every .rvcard rule an __element.',
  },
  {
    cls: 'ballparkcard',
    partial: '57-ballpark-card.css',
    consumers: 1,
    group: 'namespace',
    verdict: 'Already correct',
    note: 'Sixteen selector hits, every one an __element, inside a .thub-card.',
  },
  {
    cls: 'horizoncard',
    partial: '31-wild-card.css',
    consumers: 2,
    group: 'namespace',
    verdict: 'Already correct',
    note: 'No base rule. Sits on a .thub-card.',
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
    cls: 'pin-card',
    partial: '12-sealbox.css',
    consumers: 0,
    group: 'namespace',
    verdict: 'Delete',
    note: 'One selector, ZERO consumers anywhere in src/. It is dead. Check git history before removing it, in case something outside src/ sets the hook.',
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
    verdict: 'Canonical — tone accent',
    fill: '--bg-page / --accent-primary / --accent-primary',
  },
  {
    cls: 'rookiepill',
    partial: '31-wild-card.css',
    consumers: 1,
    group: 'tone',
    verdict: 'Merge — tone positive',
    fill: '--bg-page / --field / --field',
  },
  {
    cls: 'prospectpill',
    partial: '31-wild-card.css',
    consumers: 2,
    group: 'tone',
    verdict: 'Merge — tone muted',
    fill: '--bg-page / --text-muted / --border-hairline',
  },
  {
    cls: 'duepill',
    partial: '31-wild-card.css',
    consumers: 1,
    group: 'tone',
    verdict: 'Merge — tone seal',
    fill: '--seal-cover / --seal-cover-ink / --seal-deep',
  },
  {
    cls: 'mastheadpill',
    partial: '10-lineup.css',
    consumers: 4,
    group: 'interactive',
    verdict: 'Merge — outline + interactive',
    fill: '--surface-card / --text-body / --seal, padding 3px 9px, cursor',
  },
  {
    cls: 'psodds-pill',
    partial: '39-manager-page.css',
    consumers: 2,
    group: 'interactive',
    verdict: 'Merge — seal-filled + interactive',
    fill: '--seal / --seal-ink / --seal, padding 4px 10px, cursor',
  },
  {
    cls: 'tierpill',
    partial: '09-team-info.css',
    consumers: 1,
    group: 'interactive',
    verdict: 'Merge — outline',
    fill: 'inline-block, --ls-caps, + line-height and white-space',
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
