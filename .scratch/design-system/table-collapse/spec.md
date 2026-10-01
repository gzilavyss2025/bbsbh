# Table — the proposed API (#1132, slice T0)

A proposal for Gary to sign off before anyone builds. Every count comes from
`census.md`, which `census.mjs` writes. Where the proposal needs a decision, it
points at `decisions.md`.

It follows the shape of `Card` (#1113): one component in `components/ui/`, one
CSS file in `styles/system/`, one class helper in `lib/design/`, a small set of
props, and a `className` that is the block's namespace. `Table` owns the box and
the cells. It never owns the space around it, and it never owns what a cell says.

EmptyState and Notice are the other two families of #1132. They get their own
census and spec after this one ships ("one family per PR").

---

## What the census found, in one table

| | count |
| --- | --- |
| `<table>` tags in `src/**/*.jsx` | **70** in **47** files (the issue says 40) |
| …that migrate to `Table` | **57** |
| …held: `scorecard/*` (3), `.sc-sheet` (1), `.bs__grid--tally` (1) | 5 |
| …held: the printable score sheet, lab and admin pages (decisions Q4) | 8 |
| tags that wear `.standings` | **38** (the issue says 30); `standings rpt` **24** (the issue says 18) |
| distinct full `padding` values on a cell rule that reaches a table | **16**; **44** with the one-side longhands (the issue says 25) |
| distinct plain-cell recipes (body td · head th) | **17** |
| owning partials (the issue's "about 13 families") | **25** |
| migrating tables with a sticky first column | **29** (24 report boards, 3 Standings boards, the rolling line, the contract grid) |
| migrating tables that scroll sideways | **48** |
| migrating tables inside the spoiler scope | **7** (the rolling line, two pitchers tables, four box score grids) |
| tables built from divs | **1** named (team leaders): it becomes a real table in T3 (Q5); 22 row-grid rules listed apart |

The issue's numbers were low for the same reason the card count was: it counted
tables that carry a class somebody remembered, not `<table>` tags. Its padding
list is also out of date. ADR-0085 moved every 7px to 6px, every 5px to 4px and
every 9px to 8px after the critique was written, so "7/8" reads 6/8 today and
"5/2" reads 4/2.

---

## File layout

- `src/components/ui/table/Table.jsx`
- `src/styles/system/table.css`
- `src/lib/design/tableClass.js` (the class helper, pure, unit-tested like `cardClass.js`)
- `test/table-cascade.test.js` (pins the CSS slot and the helper, like `test/card-cascade.test.js`)

Directory budgets (`scripts/check-dir-size.mjs`, cap 12 for a directory with no
budget):

| directory | today | after | note |
| --- | --- | --- | --- |
| `src/components/ui/` | 10 files, 2 folders | 10 files, 3 folders | `Table.jsx` goes in a NEW `ui/table/`, as asked. `ui/frame/` (3 files) would also fit; a folder of its own leaves room for the table's parts if a slice needs one. |
| `src/styles/system/` | 6 | 7 | no budget; under 12 |
| `src/lib/design/` | 5 | 6 | no budget; under 12 |
| `src/styles/` | 117 (budget 117) | 117 | no new partial: `table.css` goes in `system/` |

---

## Props

```jsx
<Table
  frame="sheet"        // 'sheet' (default) | 'bare'
  density="row"        // 'row' (default) | 'tight'
  sticky               // the first column stays put while the rest scroll
  label="Attendance board, every club ranked"  // optional: names the scroll region
  className="rpt"      // the block's NAMESPACE, on the <table>
  aria-describedby="…" // ...rest goes to the <table>
>
  <thead>…</thead>
  <tbody>…</tbody>
</Table>
```

It renders two elements:

```html
<div class="table table--sheet table--row table--sticky"
     role="region" tabindex="0" aria-label="…">   <!-- the last three only with `label` -->
  <table class="table__grid rpt">…</table>
</div>
```

| prop | values | what it does | tables (of 57) |
| --- | --- | --- | --- |
| `frame` | `sheet` | the WRAP draws the box: `--radius-md`, `--shadow-card`, a hairline `--border-rule` edge, `--surface-card`. The table inside draws no edge. | **37**, of which **2** sit inside a `Card` and draw a second box (below) |
| | `bare` | no box. The table is ruled only. A table inside a `Card` is bare: the card already draws the box. | **20** (15 of them sit in a Card) |
| `density` | `row` | cells `var(--space-1h) var(--space-2)`: 6/8px | **49** after the snap (decisions Q2) |
| | `tight` | cells `var(--space-1) 2px`: 4/2px, the box score's | **7** |
| | (none) | `keep`: the namespace sets its own cells. Only the Nine Keys mark grid. | **1** |
| `sticky` | flag | the first cell of every row is `position: sticky; left: 0` | **29** |
| `label` | text | the wrap becomes a named, focusable region, so a keyboard can scroll it (WCAG 2.1.1) | the **24** report boards carry one today through `BoardScroller` |
| `className` | the namespace | goes on the `<table>`, where every family rule hooks today (`.rpt td.team`, `.bs__grid--bat`). Never a second frame. | all |

**Two boxes in a box.** The team hub's division standings (`StandingsCard`) and
the Minors tab's prospect table (`ProspectsCard`) sit in a `Card` and ALSO draw
the `.standings` / `.ledger` frame inside it. #1113's Q4 answer put boxes inside
boxes off to a later issue, so both keep `frame="sheet"` here and change nothing
on screen. The nested-box issue decides them with the rest.

`label` is one prop more than the issue named. It is not new behavior:
`components/around-the-game/BoardScroller.jsx` already does exactly this for the
report boards, and its header says it "is what that pass would adopt". `Table`
adopts it, and `BoardScroller` is deleted in T6. Whether the other 24 tables
that scroll sideways also get a `label` is decisions.md Q1.

There is no `tone`, no `striped`, no `caption` prop. The Game lines card banding
(ADR-0073) is that card's own namespace rule, and a `<caption>` is ordinary
children.

---

## What `table.css` owns

- **The wrap.** `.table`: `overflow-x: auto`, `-webkit-overflow-scrolling:
  touch`, and the thin paper scrollbar that `.standings-wrap` draws today
  (`scrollbar-width: thin` and the `::-webkit-scrollbar` set). `.table--sheet`
  adds the frame. The wrap clips the head row's square corners to its own radius,
  because an element with `overflow` other than `visible` clips to its
  `border-radius`. That is the job `overflow: hidden` on the `<table>` does today.
- **The grid.** `.table__grid`: `width: 100%`, `border-collapse: separate`,
  `border-spacing: 0`, `overflow: visible`.
- **The cells.** Padding from the density, through ONE custom property:
  `.table--row { --table-cell: var(--space-1h) var(--space-2) }`,
  `.table--tight { --table-cell: var(--space-1) 2px }`, and
  `.table__grid :is(th, td) { padding: var(--table-cell) }`. `text-align: right`
  and `white-space: nowrap` on cells (`.ledger` and `.standings` set both today; a figure must
  not wrap at its en-dash).
- **Mono figures.** `td`: `--font-mono`, `font-variant-numeric: tabular-nums`,
  `--text-body`, `--fs-small`. Existing tokens only.
- **Condensed heads.** `thead th`: `--font-display`, uppercase,
  `--ls-caps`, `--fs-label`, `--text-caption`, `--bg-page` ground. This is the
  rule `.ledger thead th` and `.standings thead th` both write today, word for
  word.
- **The row rule.** One hairline at the top of each body row. See "The sticky
  trick" below for which method.
- **The sticky column** (`.table--sticky`). See below.

What it does NOT own, on purpose:

- **Margins.** The space above and below a table is the parent's (#1180). A
  block that sets a margin on its table today keeps it in its namespace rule.
- **Column widths, alignment of one column, a `.team` or `.lft` cell's type, a
  favorite-team row tint, a subtotal row, a footer.** These are what a family
  IS. They stay namespace rules. `.ledger tfoot`, `.standings tr.is-me`,
  `.rpt__between`, `.ctr__group` all stay.
- **The edge inset of the first and last cell.** Two tables pad only their
  outer cells (`.movedup__table :is(th, td):first-child`, the Nine Keys head). That is layout inside
  a card, and it stays in the namespace.

### Cascade

`system/table.css` goes into `src/index.css` right after `system/card.css`, before
`06-loader-and-cards.css`. Every family partial loads later, so a namespace rule
wins on order at equal specificity: `.table__grid :is(th, td)` is (0,1,1), the
same as `.rpt td` or `.ledger td`. The density is a custom property, not a
`.table--row td` selector, so it never out-ranks a family rule by one class.
`30-standings.css` is a per-route chunk (StandingsPage imports it) and links
after the core sheet, so it wins too. `test/table-cascade.test.js` pins the slot.

---

## The sticky trick, and how it survives

Two partials document it: `26-player-page.css` (`.standings-wrap`, lines 745 to
815) and `30-standings.css` (lines 276 to 320). `68-around-the-game.css` and
`20-charts.css` repeat it for the report boards and the rolling line. Seven parts,
and `table.css` keeps every one:

| # | the trap today | what `Table` does |
| --- | --- | --- |
| 1 | `position: sticky` resolves against the nearest ancestor whose `overflow` is not `visible`. `.standings` sets `overflow: hidden` ON THE TABLE (to clip the head row's corners), so the table, which never scrolls, became the container and the pinned cell slid away. `.standings-wrap .standings--full` and `.ledger-wrap .rpt` both reset it to `visible`. | `.table__grid` is ALWAYS `overflow: visible`. The wrap does the clipping and the scrolling. The trap cannot happen, because no table draws a frame any more. |
| 2 | Once the table is `visible`, its own border, radius and shadow draw a second rounded box inside the wrap's. `.standings-wrap .standings--full` sets all three to none. | The frame is drawn ONLY by `.table--sheet` on the wrap. The grid draws none. |
| 3 | `border-collapse: collapse` puts a shared border under the pinned cell a pixel adrift, so every row rule steps at the seam. | `border-collapse: separate; border-spacing: 0` on every grid. |
| 4 | Safari drops `position: sticky` on a cell whose own `display` is not `table-cell`. `.standings td.team { display: flex }` un-stuck the column on iPhone; `.standings--full td.team` and `.rpt td.team` set it back. | `table.css` never sets `display` on a cell. The sticky rule also restates `display: table-cell` on the first cell, so a family rule that flexes it loses on that one property. A family that lays out a rank and a name puts the flex on a child (`.rpt__club`, as the report boards do now). |
| 5 | The pinned cell must be OPAQUE, or scrolled figures show through it. The favorite-team row mixes its tint into `--surface-card`, not into transparent. | `.table--sticky .table__grid :is(th, td):first-child { background: var(--table-pin, var(--surface-card)) }`. A family that tints a row sets `--table-pin` on that row. |
| 6 | The pinned head cell sits in its own compositor layer, which some browsers do not clip to the wrap's radius, so its square corner pokes out. `.standings--full thead th.team` rounds its own top-left corner; the last body row rounds its bottom-left. | The same two rules, on `.table--sheet.table--sticky`, with `--radius-md`. Body cells `z-index: 1`, the head cell `z-index: 2`. |
| 7 | The row rule. `.standings` draws it as each cell's `border-top` (so the pinned cell owns its own copy). `.ledger` draws it as ONE gradient line on the `<tr>`, because a row with a logo cell has a fractional height and a per-cell border steps a device pixel at that cell (26-player-page.css, "Row dividers as ONE full-width line per row"). An opaque pinned cell covers a `<tr>` line. | One method for both: the `<tr>` gradient line (it fixes the fractional-height step), and the pinned cell repaints the same 1px line as the top layer of its own background: `background: linear-gradient(var(--border-hairline), var(--border-hairline)) top / 100% var(--bw-hair) no-repeat, var(--table-pin, var(--surface-card))`. **Risk:** if T8's 390px check shows a step at the seam, sticky tables fall back to the per-cell `border-top` and the census row says so. |

The scroll region also keeps `BoardScroller`'s focus ring (`.rpt-region`) as
`.table[tabindex]:focus-visible`.

`e2e/around-the-game.spec.js` pins the sticky club cell at 390px. Do not change
that spec to make it pass; it is the check that the trick survived.

---

## The two `__sub` renames

The ADR-0084 ledger (`docs/design-system-naming.md`, #1132 section) holds two
rows for this issue, and **both of its readings are wrong**. Read the code:

| class | what the ledger says | what it is | proposed name |
| --- | --- | --- | --- |
| `.bs__sub` | "a box-score SUBTOTAL row (`b.isSub`)" | a **substitute** batter's row. `api/boxscore.js` sets `isSub: code % 100 !== 0` (a batting-order code that is not a whole hundred), and the one rule, `.bs__sub .bs__nameCol`, indents him under his starter ("Substitute rows sit indented under their starter"). | `.bs__row--substitute` (a variant: what the row IS when it is made, ADR-0084 clause 4) |
| `.ledger__sub` | "a subtotal CELL (`tr.reg-subtotal .ledger__sub`)" | the ledger's **second label column** on every row: the club in the career register, the prospect's name on the Minors tab. `Ledger.jsx` writes it on every cell with `0 < i < leftCols`. Only ONE of its two rules is about the subtotal row. | `.ledger__label` (an element: the row's label cell, after the `.yr` key cell) |

The ledger's names (`.bs__row--subtotal`, `.ledger__cell--subtotal`) would print a
false statement into the class list, which is what ADR-0084 exists to stop.
`decisions.md` Q3 asks Gary to approve the corrected names.

**How they happen: one small slice, T2, before T3 and T4.** It is renames only,
like #1113's H3, and it needs no `Table`, so it runs beside T1. The files (9):

- `src/screens/BoxScore.jsx` (the `<tr>` class), `src/styles/21-box-score.css` (one rule)
- `src/components/player/Ledger.jsx` (the cell helper),
  `src/screens/team/modules/minors/ProspectsCard.jsx` (one `<td>`),
  `src/styles/26-player-page.css` (two rules), `src/styles/31-wild-card.css`
  (`.prospecttable .lft.ledger__sub`)
- `test/card-cascade.test.js`: the "H3: the held rows keep their names" test
  lists both classes as held. Take them off the held list AND add a test that
  the old names are gone and the new ones are written. That is a stronger
  assertion, not a looser one.
- `docs/design-system-naming.md`: mark both rows "landed in #NNNN", with the
  corrected reading. `docs/adr/0084-…md`: its "Clause 3 reaches the head…"
  paragraph repeats the wrong readings. Add a dated correction note under it;
  do not rewrite the record.

Before the rename, grep the boundary-safe way the naming doc asks for
(`(?![a-z0-9-])`, not `\b`). Today there are no other uses in `src/`, `e2e/`,
`scripts/` or `api/`.

---

## The spoiler scope

7 migrating tables are inside it (census Part 1, slice T3). The rule is the
Card rule: **move the box, never the gate.**

- `Table` imports nothing and computes nothing, so it may render inside a
  `SealBox` reveal function. `Table.jsx` and `tableClass.js` must never import an
  `src/api/` module or a stamp module (ADR-0035).
- Do not move a `SealBox`, a `revealedThrough` check or a reveal-only call. The
  rolling line's `idx <= revealedThrough` check lives in its cell render;
  the pitchers table is gated through `computePitcherLines`, NOT a `SealBox`
  (ADR-0009), and must not gain one; the box score grids render inside the box
  score's one reveal function. The census names each gate in its `gate` column.
- **Keep the namespace class on the table.** The spoiler e2e invariants find
  these tables by name: `e2e/invariants/extra-innings-gating.spec.js` reads
  `.rolling__grid` and `e2e/invariants/reveal-persistence.spec.js` reads
  `.pitchers__grid`. A renamed table makes those locators find nothing, and a
  spoiler check that finds nothing can pass in silence. T3 passes
  `className="rolling__grid"` and `className="pitchers__grid"` and changes no
  e2e file.
- Two HELD tables share a class with migrating ones: `InningTally` wears
  `.bs__grid`, and `Scorecard.jsx` wears `.pitchers__grid`. T3 must leave the
  `.bs__grid` and `.pitchers__grid` base rules in place for them (or copy what
  they need into `21b-box-score-tally.css` and `scorecard/footer.css` in the
  same PR, and screenshot both).

---

## Held — `Table` never draws these

| | why |
| --- | --- |
| `screens/Scorecard.jsx` (3 tables), `components/scoring/ScorecardSheet.jsx` (`.sc-sheet`) | `scorecard/*`: the #22 sheet you score on (critique finding 8). Three sticky edges and CSS `zoom`. |
| `screens/boxscore/InningTally.jsx` (`.bs__grid--tally`) | the inning tally you score on (finding 8) |
| `screens/sheet/ScoreSheet.jsx` (`.printsheet__grid`) | the PRINTABLE blank score sheet: millimetres, collapsed borders, borders only because print drops backgrounds. Same reason as the scorecard; not on the issue's list (Q4) |
| design lab (4), identity lab (1), `/admin/research` and `/admin/contenders` (2) | tool pages (#1113 Q5's answer for cards; Q4 asks again for tables). `/game-notes-debug` is a lab page too, but it MIGRATES: it wears `.standings`, which T8 deletes. |

---

## The team leaders become a table (Q5)

Gary's answer to Q5 (2026-10-01): the team-leaders "Batting / Pitching" pair
(`components/teamstats/TeamLeadersLedger.jsx`), a `<ul>` of flex rows today,
becomes two `Table`s, one per block, each `frame="bare"` (the block's `Card`
draws the box) and `density="row"`, with a head row naming the columns:
Category, Leader, and the figure. The leader's position tag and injured mark
stay in the Leader cell. A long name still ellipsises: the Leader column takes
the free width. It is not gated (season aggregates, ADR-0034). It moves in T3
only because its CSS (`.tledg__*`) lives in `23-box-score-detail.css`, which T3
already edits; that partial sits near its `check-file-size` budget (692 of 700),
so the table rules must replace the list rules, not add to them.

## The lab

`/design-lab` gets a `Table` entry in T1: a `sheet` + `row` + `sticky` board and a
`bare` + `tight` grid inside a `Card`, at 390px and 740px, with enough columns to
scroll at 390px so the sticky column can be checked by eye. The catalog's two
`.bs__grid` demos stay as they are (they demo the held tally's class).
