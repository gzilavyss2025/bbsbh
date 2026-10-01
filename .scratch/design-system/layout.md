# Layout census: Stack, Cluster and Grid (#1180)

First step of #1180. This file counts what the layout rules do. It proposes the
gap steps. It builds nothing. Gary signs off on the proposals before any code
lands, as #1128 did for spacing.

Measured on `main` at `e7a783cf`, 2026-10-01, over every partial in
`src/styles/` (including the subfolders). Re-derive with:

```bash
node .scratch/design-system/layout/census.mjs          # tallies
node .scratch/design-system/layout/census.mjs --json   # every rule, for slicing
node .scratch/design-system/layout/census2.mjs         # gap-less stacks, sibling margins
```

A "rule" is one selector list with its declarations, at any depth (a rule inside
`@media` counts). Comments never count. `var(--space-N)` is resolved to its px
value. Bespoke rules (`scorecard/*`, the box-score partials, `.bs__grid`) are
counted but kept out of every "in scope" figure, as the issue says.

## The headline, and why it is lower than the issue says

The issue measured 367 / 291 / 160. This census finds more rules, because it
also counts `column-reverse`, `flex-flow` shorthand and rules inside `@media`
(54 of them):

| pattern | all rules | bespoke | **in scope** | partials |
| --- | ---: | ---: | ---: | ---: |
| vertical stack (`flex-direction: column`) | 381 | 40 | **341** | 91 |
| `display: grid` / `inline-grid` | 301 | 14 | **287** | 96 |
| wrapping row (`flex-wrap: wrap`) | 163 | 14 | **149** | 74 |

777 distinct rules in scope. But "818 rules to replace" overstates the work.
Three findings matter:

1. **A third of the stacks are not a spacing question.** 66 stacks set no gap,
   and 91 more set 1-3px. Neither reads a section-sized token (see Stack).
2. **Grid has a small real target.** Only 28 of the 287 grids use
   `auto-fit`/`auto-fill`, the one shape the issue's `Grid` describes. The rest
   fix their columns on purpose (see Grid).
3. **The page-level section gap has no single owner today.** Pages do not share
   a section wrapper. Spacing between sections sits in `margin-top` on the
   section's own block (see Section gap).

## Stack: 341 rules

How many rules use each gap (`gap` or `row-gap`):

| gap | rules | share | note |
| ---: | ---: | ---: | --- |
| none | 66 | 19% | 5 of them space children with a sibling margin instead |
| 1-3px (0, 1, 2, 3) | 91 | 27% | optical hairlines: a label over a value |
| 4px `--space-1` | 51 | 15% | |
| 6px `--space-1h` | 22 | 6% | half-step |
| 8px `--space-2` | 43 | 13% | |
| 10px `--space-2h` | 5 | 1% | half-step |
| 12px `--space-3` | 31 | 9% | |
| 14px `--space-3h` | 1 | <1% | half-step |
| 16px `--space-4` | 19 | 6% | |
| 18px, 20px | 8 | 2% | 4 rules each; 18px is off the scale |
| 24px `--space-6` | 3 | 1% | |
| 32px `--space-8` | 1 | <1% | |

Of the 341 rules, 95 write the gap as a raw px literal and 180 use a token.

### What the data says

- Four steps cover the heart: 4, 8, 12, 16 hold 144 rules, which is 42% of all
  stacks and 78% of the 184 stacks that set a gap above 3px.
- The issue guessed "3 or 4 gaps". The data agrees, with a fifth step for
  sections.
- The 91 hairline stacks (1-3px) are the "optical nudge" band that ADR-0085
  already exempts under a ceiling. A `Stack` that owned them would need a
  `--space-hair` token with no other use. Keep them bespoke.
- The 66 gap-less stacks probably use `flex-direction: column` for alignment,
  not for spacing (centering, `align-items`). I did not check each by hand.
  **This is inference from the selector text.**

### Proposed Stack steps

| prop value | token | px | rules that already sit here |
| --- | --- | ---: | ---: |
| `tight` | `--space-1` | 4 | 51 |
| `snug` | `--space-2` | 8 | 43 |
| `base` | `--space-3` | 12 | 31 |
| `loose` | `--space-4` | 16 | 19 |
| `section` | `--space-section` | 16 or 24 (decision 2) | 3 at 24px |

That is 144 exact matches on the four main steps, with no visible change when
a rule migrates. Not covered: 28 half-step rules (6, 10, 14px), 8 rules at 18
or 20px and 1 at 32px. Those 37 stay bespoke until the ADR-0085 follow-up
decides on the odd band. The names are placeholders; the naming rule is
`docs/design-system-naming.md`.

## Cluster: 149 rules

| gap | rules |
| ---: | ---: |
| 8px `--space-2` | 44 |
| 12px `--space-3` | 22 |
| 4px `--space-1` | 14 |
| 6px `--space-1h` | 12 |
| 10px | 2 |
| 16px, 24px | 2 |
| 0, 2px, 3px | 4 |
| none | 10 |
| **two values** (`row column`) | **39** |

The 39 two-value gaps are the notable group: 26% of all wrapping rows. The
commonest are `var(--space-2) var(--space-3)` (6), `var(--space-1)
var(--space-2)` (5) and `var(--space-2) var(--space-4)` (4). A wrapped row
often wants a tighter line gap than the gap between its items. A `Cluster`
with one `gap` prop cannot say that.

Proposed Cluster steps: `tight` 4, `snug` 8, `base` 12. They cover 80 rules
(54%). Add a `rowGap` prop for the two-value rows (decision 3).

## Grid: 287 rules

| `grid-template-columns` | rules |
| --- | ---: |
| explicit track list (`1fr auto`, `64px 1fr`, mixed) | 125 |
| none set (`grid-template-areas`, rows only, or set elsewhere) | 91 |
| `repeat(N, …)`, a fixed count | 40 |
| `auto-fit` / `auto-fill` | 28 |
| `subgrid` | 3 |

The 40 fixed-count grids are mostly `repeat(2, minmax(0, 1fr))` (13) and
`repeat(3, 1fr)` (8). The 28 `auto-fit` grids use these minimum widths: 150px
(4), 140px (3), 240px (2), and 19 other values at one rule each.

### What the data says

- **`Grid` replaces at most 28 + 40 = 68 of 287 rules.** The other 219 are
  label/value rows, named areas and mixed tracks. They are layouts you author,
  not "fit as many as you can". `Grid` should not try to absorb them.
- The 40 fixed-count grids are a **behaviour change** if they move to
  `auto-fit`. A stat strip that is always 3 across becomes 2 or 4 across by
  width. That is a decision per surface, not a mechanical swap.
- Gaps among grids: 8px (48), 12px (40), 16px (20), 10px (13), 4px (13), 20px
  (11), none (90), two-value (14). The four main steps cover 121 rules.
- 20px (11 rules) is the one grid gap with a cluster of its own. No stack or
  cluster uses it.

Proposed: `Grid` takes `min` (the column minimum, a length) and the same `gap`
steps as Stack. Its default is `auto-fit`, no breakpoint, as the issue says.

## Section gap

I looked for a shared page wrapper and did not find one. No `.section` base
rule exists. The page roots I checked (`.player`, `.team-hub`) set no `gap`
between sections. Between-section space seems to come from `margin-top` on each
section block. Margins of 16px or more, across all partials:

| `margin-top` / `margin-bottom` | declarations |
| --- | ---: |
| `--space-4` (16px) | 44 + 14 |
| `--space-5` (20px) | 11 + 3 |
| `--space-6` (24px) | 9 + 3 |
| `--space-8` (32px) | 2 |

These count every margin of that size, not only margins between sections, so
read them as an upper bound. **My reading (inference):** pages mostly separate
sections by 16px, with a smaller group at 20-24px. I did not trace one page
end to end.

That gives two real options for `--space-section`:

- **16px.** Matches what most pages do today. No visible change. But it equals
  `loose`, so the token adds a name and no new step.
- **24px.** A distinct, larger step that sets sections apart from the content
  inside them. Every migrated page grows by 8px per section gap. The
  screenshot suite (`npm run visual`, #1177) shows the change.

## Where the code goes

Follow the #1113 pattern. This is a proposal, not a decision.

- `src/components/ui/layout/` (new bucket: `Stack.jsx`, `Cluster.jsx`,
  `Grid.jsx`). `ui/` already has `control/` and `frame/`; layout is a third
  kind.
- `src/styles/system/layout.css` for the rules, beside `card.css`.
- `--space-section` goes in `src/tokens/spacing.css`.
- Specimens on `/design-lab`, one per part (#1131 did this for Pill).
- One part per PR. Cascade order is the contract (#1113): a rule moved into
  `system/` changes which rule wins at equal specificity. A wrong slice must
  revert alone.

## Decisions for Gary

1. The Stack steps and their px values (table above).
2. `--space-section`: 16px or 24px.
3. Two-value gaps on Cluster: add a `rowGap` prop, or leave the 39 bespoke.
4. Grid scope: `auto-fit` only (28 rules), or also the 40 fixed-count grids,
   knowing those change behaviour.
5. Half-steps and 18/20/32px: leave the 37 stacks bespoke for now.
