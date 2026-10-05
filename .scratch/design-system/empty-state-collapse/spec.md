# EmptyState — the proposed API (#1132, slice E0)

A proposal for Gary to sign off before anyone builds. Every count comes from
`census.md`, which `census.mjs` writes. Where the proposal needs a decision, it
points at `decisions.md`.

It follows the shape of `Card` (#1113) and `Table` (#1132): one component in
`components/ui/`, one CSS file in `styles/system/`, one class helper in
`lib/design/`, a small set of props, and a `className` that is the block's
namespace. `EmptyState` owns the inset and the copy faces. It never owns the
space around it, and it never decides WHEN a thing is empty: the caller does.

Notice is the third family of #1132. It gets its own census after this one
ships ("one family per PR"). This census hands it the error lines it found
(21 sites, `.hint--error` and the `AsyncStatus` error branch).

---

## What the census found

| | count |
| --- | --- |
| candidate selectors (a rule draws the class; the name carries an empty word, or the class sits on empty copy) | **115** |
| …of them true empty states | **25**: 14 MIGRATE, 11 HOLD |
| …the rest | tool 27, caveat 18, value mark 15, pencil mark 13, placeholder 7, loading 5, other 3, error 1, control 1 |
| JSX sites (a tag that wears a candidate, an `<AsyncStatus>`, or a tag whose copy starts "No …", "Nothing …", "Not posted …") | **301** in 168 files |
| …of them true empty states | **97**: 68 MIGRATE, 29 HOLD |
| …the rest | tool 64, caveat 61, error 21, value mark 19, loading 15, pencil mark 15, placeholder 7, control 1, other 1 |
| empty sites by shape today | bare hint 55, label 25, hint + own class 9, box 6, label + note 2 |
| `<AsyncStatus>` sites with an `emptyMessage` | **29** of 39. They all render ONE line in `AsyncGate.jsx` |
| empty selectors by border today | none 22, solid 2, dashed **1** (`.refpanel__empty`) |
| empty sites on a spoiler surface | **12** (8 move, 4 held); 3 in a file that reads `revealedThrough` |
| dashed or dotted rules | **87** in **54** partials (the issue says 44 partials) |

**The issue's "40 selectors" does not reproduce.** It is more than the 25 true
empties and far less than the 115 candidates. The word in a class name is a
poor signal: of the 24 classes named `empty`, 14 are empty states; of the 18
named `none`, 2 are; of the 30 named `hint`, 3 are. Most `--none`, `--nil` and `--tbd` classes are a value in a
cell or a pencil mark, and the census keeps them out.

**The real centre is `.hint`.** 115 sites wear it, for five jobs: loading,
error, caveat, empty, and tool-page copy. 55 of the 97 empty sites are a bare
`.hint` today, and 30 of those come through `AsyncStatus`. So the collapse is
mostly "give `.hint`'s empty job its own component", not "merge 40 bespoke
boxes".

---

## File layout

- `src/components/ui/state/EmptyState.jsx` — a NEW folder, `ui/state/`. Notice
  goes beside it when its census lands, so the two state blocks share a home.
- `src/styles/system/empty-state.css`
- `src/lib/design/emptyStateClass.js` (the class helper, pure, unit-tested like
  `tableClass.js`)
- `test/empty-state-cascade.test.js` (pins the CSS slot, the helper and the
  import rule, like `test/table-cascade.test.js`)

Directory budgets (`scripts/check-dir-size.mjs`, cap 12 for a directory with
no budget), counted on `main` at `14b7cbf50`:

| directory | today | after | note |
| --- | --- | --- | --- |
| `src/components/ui/` | 11 files, 5 folders | 11 files, 6 folders | `ui/` is one file under the cap, so the component goes in a folder |
| `src/styles/system/` | 10 | 11 | under 12 |
| `src/lib/design/` | 9 | 10 | under 12 |

---

## Props

```jsx
<EmptyState
  label="Standing vs level"   // optional: a caps line that names the slot that is empty
  note="300 PA needed to join the qualified population."  // optional: fine print (text or nodes)
  action={<Button onClick={resetFilters}>Clear filters</Button>}  // optional: ONE control
  size="block"                // 'block' (the default) | 'compact'
  className="payboard__empty" // the block's NAMESPACE, on the root
  role="status"               // ...rest goes to the root
>
  No salaried player at this club and position.
</EmptyState>
```

It renders one root and up to four children:

```html
<div class="emptystate emptystate--block payboard__empty" role="status">
  <span class="emptystate__label">…</span>      <!-- only with `label` -->
  <p class="emptystate__text">…children…</p>
  <p class="emptystate__note">…</p>             <!-- only with `note` -->
  <div class="emptystate__action">…</div>       <!-- only with `action` -->
</div>
```

| prop | values | what it does | migrating sites (of 68) |
| --- | --- | --- | --- |
| children | text | the one line that says what is missing | all |
| `label` | text | a caps line above it, naming the slot (the prospect card's "Standing vs level") | 2 |
| `note` | text or nodes | a smaller line under it: why, or what would fill it | 2 (the prospect card); more if a caller splits a long sentence (decisions Q2) |
| `action` | one element | one control under the copy. A `Button` that acts here, or a `Door` that leads on. Never a third kind (src/CLAUDE.md, "One control, one door") | 1 (`/prospects`, Clear filters) |
| `size` | `block` | padding `var(--space-4)`: an empty card body, a page section | 59 |
| | `compact` | padding `var(--space-2) var(--space-3)`: an empty tile, chart slot or short card row | 9: the Records card, the Horizon tile, the depth chart, the vs-club splits, the three scout chart slots, the roster panel and the lineup starter card (decisions Q3) |
| `className` | the namespace | goes on the root, where a family rule hooks (`.payboard__empty`). It may set a margin. Never a second frame | 17 sites carry a family class today; each slice keeps one only where a rule or a spec still reads it |

`...rest` goes to the root: `role="status"` for an empty that appears after the
reader acts (a filter, a search), `aria-live`, `id`. An empty that is there on
load needs no role.

There is no `tone`, no `icon`, no `as`. No migrating site needs one. An empty
inside a `<ul>`, a `<td>` or an SVG is held (below), so the root is always a
`<div>`.

Class names follow ADR-0084. `emptystate` carries no shape word (clause 1).
The elements are `__label`, `__text`, `__note` and `__action`; `__note` and
`__action` are clause 3's fixed names. The size is a variant (`--block`,
`--compact`), fixed when the block is made (clause 4).

---

## What `empty-state.css` owns

```css
.emptystate {
  margin: 0;
  border: var(--bw-hair) dashed var(--border-rule);
  border-radius: var(--radius-sm);
  color: var(--text-caption);
}
.emptystate--block   { padding: var(--space-4); }
.emptystate--compact { padding: var(--space-2) var(--space-3); }
.emptystate__label   { display: block; font-family: var(--font-display); font-size: var(--fs-label);
                       font-weight: var(--w-semibold); letter-spacing: var(--ls-label); }
.emptystate__text    { margin: 0; font-family: var(--font-body); font-size: var(--fs-small);
                       font-weight: var(--w-semibold); line-height: var(--lh-prose); }
.emptystate__note    { margin: var(--space-1) 0 0; font-family: var(--font-body); font-size: var(--fs-small);
                       font-weight: var(--w-regular); line-height: var(--lh-ui); }
.emptystate__action  { margin-top: var(--space-3); }
```

- **The dashed inset.** A hairline dashed edge in `--border-rule`, the
  `--radius-sm` corner, **no ground of its own** (decisions Q2). The one
  dashed empty today, `.refpanel__empty`, sets `--surface-card`; a ground of
  its own reads as a raised card on a card, and `--surface-inset` is the
  "revealed value" paper (`tokens/colors.css`), the wrong signal for "nothing
  here". With no ground, the copy sits on the card or the page under it.
  `--text-caption` on `--surface-card`, `--bg-page` and `--surface-inset` is
  already asserted at AA in `contrastPairings.js`, so `check-contrast` needs no
  new pair.
- **The graphite copy.** Every line is `--text-caption` (the graphite pencil).
  The label is the display caps face. The text and the note are the body face
  (the `.hint--prose` face), because most of the 68 are sentences and the app
  uppercases every string (`01-base.css`). `ReferencePanel.jsx` says why in a
  comment: "a full sentence shouted in caps reads far worse than four words
  do". Decisions Q2.
- **Tokens only.** No raw value, so `check-raw-values` budgets do not rise.

What it does NOT own:

- **Margins.** The space around an empty state is the parent's (#1180). A
  family that sets one today (`.txpage__empty { margin: 20px 0 }`) keeps it in
  its namespace rule, or drops it if a `Stack` already spaces the page.
- **When it shows.** `EmptyState` renders whatever it is given. The test
  (`rows.length === 0`, `armsEmpty`, `!data.isMilb`) stays in the caller.
- **The loading and error lines.** A site that says "Loading…" or "Couldn't…"
  keeps `.hint` (loading) or waits for `Notice` (error). Two migrating elements
  say loading OR empty in one `<p>` today (`.stampsheet__empty`,
  `.oseason__quiet`); E7 splits them, and only the empty branch moves.

### Cascade

`system/empty-state.css` goes into `src/index.css` right after
`system/table.css`, before `06-loader-and-cards.css`. Every family partial loads
later, so a namespace rule (`.payboard__empty { margin-top: … }`) wins on order
at equal specificity. `test/empty-state-cascade.test.js` pins the slot.

---

## `AsyncStatus` (decisions Q1)

`components/ui/AsyncGate.jsx` exports `AsyncStatus`. Its empty branch is one line:

```jsx
return <p className={emptyProse ? 'hint hint--prose' : 'hint'}>{emptyMessage}</p>
```

29 pages reach it through `emptyMessage`. Q1 proposes one change: that line
becomes `<EmptyState>{emptyMessage}</EmptyState>`, and the `emptyProse` prop is
deleted (the EmptyState text IS the prose face), with its 10 callers. The
loading branch (`Loader`) and the two error branches do not change; Notice
takes the error lines.

---

## The spoiler scope

12 empty sites sit on a spoiler surface (census Part 2, `surface` column;
`AsyncGate.jsx` counts because the slate imports it). 8 move: the slate's "No games scheduled." (through `AsyncStatus`, E2), and in
E3 the innings rail's "No pitching lines yet", the two lineup "Not posted yet."
lines, and the two Box Lines empties. The umpire modal (E7) opens from the box
score's umpire card. The rule is the Card and Table rule: **move the box,
never the gate.**

- **`EmptyState` fetches nothing, computes nothing and gates nothing.**
  `EmptyState.jsx` and `emptyStateClass.js` import no `src/api/` module and no
  stamp module (ADR-0035). The test pins this.
- **The empty TEST stays where it is, byte for byte.** `ReferencePanel.jsx`'s
  `armsEmpty` (line 446) is built from the half's margin notes and pitcher
  rows, which arrive reveal-clamped. Box Lines' `rows.length === 0` reads rows
  that `api/boxlines/rows.js` already gated (ADR-0069). A slice changes the
  element only.
- **An empty state inside the scope says what is missing, never what
  happened.** "No pitching lines yet" is safe. "No runs this inning" or "No
  hits yet" would state a result before the reveal. No migrating site says one;
  a new one must not.
- **It is never a placeholder for a value that a reveal fills.** That is the
  `SealBox`'s job (ADR-0002). `EmptyState` has no reveal prop and must not gain
  one. A sealed value is never "empty".
- **Keep the namespace classes the guards and specs read.** No spoiler e2e
  invariant reads a migrating class or `.hint` (checked: a grep of
  `e2e/invariants/` finds none). `e2e/box-lines.spec.js` names
  `.boxlines__hint` only in a comment. `e2e/salaries.spec.js` reads
  `.payboard__empty` (not in the scope): E7 passes
  `className="payboard__empty"`. `scripts/check-seal-scope.mjs` allowlists no
  candidate class.
- **The held surface sites stay held.** Express Lane (3 empties), the site
  search's no-result line, and the box score's stamp mount (a pencil mark,
  ADR-0035) do not move.

---

## Held — `EmptyState` never draws these

| | sites | why |
| --- | --- | --- |
| Express Lane: `.xl-deck__empty`, `.xl-expand__none`, `.xl__prerollmsg` | 3 | the dark album ground (`--album-*`). No contrast pair for graphite on the album is asserted, and graphite on a dark ground is unlikely to pass AA (inference, not measured). A paper inset on a film reel is the wrong object. Decisions Q4 |
| the search no-result lines: `.searchoverlay__hint`, `.searchbox__hint` | 2 | a combobox's status line inside the listbox, not a block on a page. Site search is ADR-0037's one non-sheet dialog |
| the bracket fold on a day with no games: `.pbkt-fold__quiet` | 1 | a fold head with a `Door` under it, not a stand-in for content |
| the series flow chart: `.psseries__flowempty` | 1 | an SVG `<text>`; `EmptyState` is HTML |
| the farm-system report's empty row | 1 | a `<tr>` that keeps the table's columns (— cells). `Table` owns it |
| lab, admin and dev-only pages | 21 | #1113 Q5's answer: leave them |

The look-alikes the census keeps OUT, counted in JSX sites (they never were empty states): 19 value
marks in a cell or a row (`--none`, `--nil`), 15 pencil marks (`--tbd`,
`--pending`, the bracket's blank slot, the stamp mount), 7 placeholders for
missing art (a stamp with no photo, the scorebug before data), 61 caveats (a
`.hint` used as a footnote under a board).

---

## The six ADR-0084 state rows

The naming ledger gives #1132 six state renames. This work renames none of
them. Census Part 5:

| class | touches EmptyState? |
| --- | --- |
| `.dh__row--open`, `.umptend__row--on`, `.cwb__row--done` | no: row states |
| `.posinn__box--empty` | no: a position box never played, a value mark |
| `.stampstrip__mount--empty` | no: the box score's dashed stamp mount, a pencil mark (and ADR-0035) |
| `.xl-deck--empty` | **yes**: the Express Lane deck with nothing written. Held with the album (Q4), so its rename stays in the ledger for whoever moves Express Lane |

---

## The dashed rule

The issue's rule: dashed means provisional (pencilled in); empty states keep a
dashed inset; doors go solid. Census Part 4 lists all 87 dashed rules. What it
found for this family:

- **22 of the 25 empty selectors are not dashed today** (20 with no edge, 2
  solid: `.prospects__empty` and `.payboard__empty`'s top rule). The 14 that
  migrate become dashed; the held ones stay as they are.
- **Two dashed classes are neither empty nor provisional**: the value marks
  `.awardtbl__chip--none` and `.trendstrip__col--none` draw "no value" dashed.
  They are the dashed-rule fix's call, not EmptyState's. The box score's stamp
  mount is dashed too, and agrees: the census calls it a pencil mark (where a
  stamp WOULD go).
- **Six dashed rules read as doors** by their selector (inference, not checked
  on screen): `button.starter__careervs`, `.passportpage__addpage`,
  `.shelf__newtile`, the Records card's rank button, `.vsteam__door` and
  `.sc-armnotice__more`. They go solid in the dashed-rule fix (#1130's `Door`).
  EmptyState does not touch them.

## The lab

`/design-lab` gets an `EmptyState` entry in E1: a `block` with text only, a
`block` with a label, a note and an action, and a `compact` one inside a `Card`
tile, at 390px and 740px.
