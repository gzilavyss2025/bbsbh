# Layout census: Stack, Cluster and Grid (#1180)

> **Frozen 2026-10-09. See ADR-0108** (`docs/adr/0108-the-layout-migration-is-frozen-new-layout-uses-the-parts.md`).
> The migration of old rules stopped. New layout uses the parts. An old rule moves only when a
> PR already edits it. `scripts/layout/check-layout-ratchet.mjs` is the ratchet. This file is
> history: do not add slices or log entries. Decision 5 (snap) is reversed, and the "one
> section gap" goal of decision 2 is dropped.

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
- `src/styles/system/stack.css` for the rules, one file per part (`cluster.css`, `grid.css` follow). It loads ahead of `section-head.css`: `test/card-cascade.test.js` pins the head, the card and 06 as adjacent imports.
- `--space-section` goes in `src/tokens/layout.css`, not `spacing.css`: it is an alias, and `spacing.css` holds the primitive steps only.
- Specimens on `/design-lab`, one per part (#1131 did this for Pill).
- *(Historical: dropped with the freeze, ADR-0108.)* One part per PR. Cascade order is the contract (#1113): a rule moved into
  `system/` changes which rule wins at equal specificity. A wrong slice must
  revert alone.

## Decisions (signed off by Gary, 2026-10-01)

1. **Stack steps: 4, 8, 12, 16px only.** `tight`, `snug`, `base`, `loose`. No
   24px step and no half-steps.
2. **`--space-section` is 16px.** It is an alias of the 16px step, read by a
   page's outer `Stack`. Pages look the same; a later change to the section gap
   is still one edit. *(2026-10-09: the token stays; "one section gap" is no longer a goal, ADR-0108.)*
3. **Cluster gets a `rowGap` prop.** `gap` is the column gap. The 39 two-value
   rows migrate with no visible change.
4. **Grid covers `auto-fit` only.** The 28 rules that already use it. The other
   259 stay authored by hand.
5. **Reversed 2026-10-09 (ADR-0108): no snapping; off-step gaps stay hand-written.** ~~The 37 odd-gap stacks snap to the nearest step, ties round up.~~

   | from | to | rules |
   | ---: | ---: | ---: |
   | 6px | 8px | 22 |
   | 10px | 12px | 5 |
   | 14px | 16px | 1 |
   | 18px | 16px | 4 |
   | 20px | 16px | 4 |

   Items 18px and 20px have no step above, so they go down to 16px. That is a
   judgment call from me, not a point Gary signed off on.
   **The one 32px stack does not snap.** A 32px to 16px move is 16px, not a
   rounding. It stays bespoke. Tell me if you want it moved.

   Every snap is a visible change. Run `npm run visual` on each migration
   slice and list the changed pages in the PR body.

## Next

Build one part per PR, in this order: `Stack`, `Cluster`, `Grid`. Each PR adds
the component, its rules in `src/styles/system/<part>.css`, a `/design-lab`
specimen and a test. **`Stack`, `Cluster` and `Grid` are built** (this branch). `Cluster` also takes `align` (`start`, `center`, `baseline`), which was not in the sign-off: the census of 147 wrapping rows found 69 with no alignment, 41 `center`, 31 `baseline` and 5 `flex-start`, so a Cluster without it could not host half of them. Migrating the existing rules followed in sliced PRs until the freeze (ADR-0108).

`Grid` takes `min` (a length, default `9rem`), `gap` (the Stack's four steps)
and `fit`. Two facts from the 28 grids shaped it: 17 use `auto-fill` and 11 use
`auto-fit`, so it needs both (`fit` is the switch, filling is the default); and
three of them cannot move at all, because their tracks are `minmax(0, 1fr)`,
`minmax(58px, max-content)` or a fixed `64px`, none of which is "at least
`min`, equal share". So the real target is 25 rules. It has no row gap: only 2
of the 28 set two values. Left out of the sign-off, so say if you want it:
`rowGap`, as on `Cluster`.

## Migration log

Moving a rule onto a part is a CSS edit plus a JSX edit, so each slice is one
family and ships green. The tools, all in `.scratch/design-system/layout/`:

- `stack-candidates.mjs` lists the rules that can move. A candidate sets
  `display: flex`, `flex-direction: column` and a gap on the 4, 8, 12 or 16px
  step, behind a selector that is ONE class. It is SAFE when no other rule for
  the class sets display, flex or gap, and every JSX site is a static
  `className` on a plain element. **Measured on `main` before S1: about 120 candidates and 79 safe; after S3 the corrected finder counts 113 and 68 (see the note on the finder below).** The
  other 24 of the 144 rules are not candidates because of their shape: a
  grouped or compound selector, a rule inside `@media`, or a rule that does not
  set `display: flex` itself. I did not sort the 24 by which. They are edited
  by hand.
- `jsx-to-layout.py` swaps `<div className="x">` for `<Stack gap=… className="x">`
  and the matching closing tag, and refuses an element with any other prop.
- `geom.mjs` and `diffgeom.mjs` dump and compare every element's rect and
  layout style at 390 and 760px. A migration that must move nothing must give
  zero differences. This stands in for `npm run visual`, which runs only when
  Gary asks.

| slice | rules | JSX sites | result |
| --- | ---: | ---: | --- |
| S1: awards history and postseason history | 4 | 6 | geometry identical on `/awards` and `/postseason-history`, 4 pages, 0 differences |
| S2: `12-sealbox.css` (the scoring surfaces) | 7 | 9 | real surfaces identical on 4 anchor-game routes and states, and a synthetic check identical on all 7 (see below) |
| S3: all-star rosters | 3 | 3 | geometry identical on `/all-star-rosters`, 4,822 elements at 390 and 760px, 0 differences |
| S4: manager page and ballpark ranks (`39-manager-page.css`) | 3 | 4 | geometry identical on `/manager/bruce-bochy-111136` and `/team/158`; synthetic identical |
| S5: book cover picker (`60-book-cover-picker.css`) | 3 | 5 | geometry identical on `/logbook/new`, 261 and 370 elements |
| S6: identity lab workbench (`17-identity-lab-workbench.css`) | 7 | 7 | geometry identical on `/identity-lab`, 1,029 elements |
| S7: book management (`58-logbook-shelf.css`) | 3 | 6 | `/logbook/new` identical (the two field labels); synthetic identical for all three |

S1 moved `.awardhistory__years` (loose, 3 sites), `.awardhistory__leaguecol`,
`.awardhistory__leagueyears` and `.pshistory__season` (base). `.awardhistory__leaguecol`
keeps its `min-width: 0` in its own rule; the other three rules were deleted.
The By Year view of `/awards` (the third `__years` site) was checked for
computed style only (flex, column, 16px), because its click state is not in the
baseline run. 75 safe candidates remain.

S2 moved `.abs__detail` (an `ol`), `.upnext__col`, `.halfcast__row`,
`.pitcherhandoff` (2 sites), `.dueup__col`, `.entering__teams` and
`.entering__list` (an `ol`). `.pitcherhandoff` was deleted outright. The other
six keep the declarations that are theirs: `align-items`, `text-align`,
`min-width` and padding. `.abs__detail` and `.entering__list` lost their
`list-style` and `margin` to `Stack`'s list reset, and keep their own padding,
which wins on order because `stack.css` loads first. These are scoring
surfaces, but `Stack` renders nothing and reads no data, so no value reaches
the DOM earlier or later than before. `check-seal-scope` and the spoiler
manifest guard still pass.

How S2 was checked. The anchor game (823035) comes from `e2e/fixtures/mock-api.js`
with the reveal mark preset (`geom.mjs` takes `MOCK=1`, `LS=…`, `STEPS=…`).
- **Real surfaces.** `dueup__col`, `pitcherhandoff` and `entering__*` render on
  `top6`, `top7` and `bottom3`, and `entering__*` also on the Lineups tab. Each
  route at 390 and 760px has zero differences (up to 4,732 elements per page).
  Two runs of the same unchanged page also diff to zero, so the capture is
  stable.
- **Not reached.** `abs__detail`, `upnext__col` and `halfcast__row` did not
  render in any state I found in the anchor game (no ABS challenge in the
  fixture, no Statcast cards, and the due-up card only shows in a state I did
  not reach). `synth.mjs` covers all seven instead: it builds each class on a
  test element with the same children, once with the old markup and once with
  the Stack classes, and compares rects and computed styles. 28 elements, zero
  differences. **That proves the CSS is equivalent, not that the real page
  draws it.** The three classes are plain `div` and `ol` hosts like the four
  that were reached, so I rate the risk low.

`StatBox.jsx` sat at the 600-line cap, so the new import line pushed it to 601.
I re-wrapped one comment (same words, 6 lines to 5) rather than widen the
budget in `scripts/check-file-size.mjs`. A real fix is to split the file.

68 safe candidates remain (corrected count, see S3).

S3 moved `.allstarrosters__list`, `.allstarrosters__body` and
`.allstarrosters__leagues` (`AllStarRostersPage.jsx`). Each keeps its own
`margin-top`, `flex` or `min-width`. The page was captured with the mock relay
(`MOCK=1`); all three classes render, 1, 10 and 10 times. The expanded "more
seasons" state uses the same classes and was not captured separately.

**A bug in the finder, found while picking S3.** `stack-candidates.mjs` and
`census2.mjs` used postcss `rule.each(...)` with a callback that returns
`false` for a non-matching node. postcss stops iterating when a callback
returns `false`, so the scan of a rule ended at its first non-layout
declaration or its first comment. Two effects: the `keeps` column was empty
for any rule that opens with `display`, and a rule that opens with another
property could hide its layout declarations from the "no other layout rule"
test, so a rule could be called safe when it was not. Both scripts now use
`walkDecls`. The corrected finder counts 113 candidates and 68 safe after S3.
`census.mjs` was never affected (it uses an `if` block and returns nothing),
so the census tables above stand. The "5 of them space children with a sibling
margin" figure came from `census2.mjs`, which WAS affected, and is
unverified. S1 and S2 are not at risk: each was checked by geometry, and a
scan of the CSS now finds no remaining layout rule that names any of the 11
migrated classes.

## Slices S4 to S7

Gary asked for all four families in one go; each is its own commit so a wrong
slice reverts alone.

- **S4** moved `.mgrpage__awards` and `.mgrpage__timeline` (two `ul`s that only
  repeated the list reset, so both rules are deleted), and `.bpsheet__ranks` in
  two files (`BallparkModal.jsx`, `BallparkCard.jsx`; it keeps its
  `margin-top`). Real: `/manager/bruce-bochy-111136` draws both lists and
  `/team/158` draws the rank sheet in the card. The modal copy of
  `.bpsheet__ranks` is a click state I did not open; the synthetic check covers
  its CSS.
- **S5** moved `.coverpick` (2 sites), `.coverpick__half` (2, keeps
  `min-width`) and `.coverpick__steps`. `/logbook/new` draws the steps at 390px
  and the two halves at 760px.
- **S6** moved seven rules on the dev-only identity lab. All seven render.
  `.idlab__workbench` keeps its animation, `.idlab__field` keeps its sticky
  position. `.idlab__barunit` carries event handlers, so I converted that one
  by hand. The page diffs to zero twice, so the animation does not make the
  capture noisy at rest. Sticky behaviour at scroll was not exercised: the
  edit does not touch `position`.
- **S7** moved `.bookmgmt`, `.bookmgmt__field` (4 `label` sites) and
  `.bookmgmt__confirm`. `shelf__newtile` was **left alone**: it is a `button`
  with an aspect-ratio and a font, a tile and not a stack.

**`label` joined `Stack`'s elements.** A field is a caption stacked over an
input, and 4 sites were `label`s. This is an addition to the part, in
`lib/design/stackClass.js` and `Stack.jsx`; the test already derives its list
from the helper. The finder now checks sites against the same element list, so
a `button` or `span` host is no longer called safe (the first version accepted
any lowercase tag). After S7 the finder counts 97 candidates and 44 safe.

**A bad synthetic baseline, caught.** The first S7 synthetic run compared
`block` against `flex` and reported differences. The cause: `58-logbook-shelf.css`
is imported by the logbook components, so it is not loaded on `/design-lab`,
and the "old" run had no CSS at all. `synth.mjs` now takes `ROUTE`, and the run
that counts used `/logbook/new`, where the old rule gave `flex/column/16px`.
Any synthetic check for a lazily imported stylesheet needs a route that loads
it.

Converter changes: it now keeps static string props (`role="group"`) and
extra static classes. It still refuses an element with a handler or a spread.


## Slices S8 to S13

Six more families, one commit each. 20 rules on 31 JSX sites. The finder counts
**50 safe candidates on `main` before S8** (the log above said about 44; I did not
trace the gap, and the script was not changed) and **30 after S13**. 84 candidates in
all. No odd-gap stack, `Cluster` or `Grid` was touched. No open PR edits any file
here (#1448 touches `App.jsx`, `Headshot.jsx` and `PitcherNotice.jsx` only).

| slice | rules | JSX sites | result |
| --- | ---: | ---: | --- |
| S8: Matchup Scout (`scout/scout.css`) | 6 | 9 | `/scout` and `/design-lab` identical; synthetic identical for all |
| S9: site search (`08-site-shell.css`) | 3 | 3 | search overlay (recent shelf) and past-matchup finder identical on `/` with the mock |
| S10: animation and between-innings labs (`46-consent-modal.css`) | 3 | 10 | both lab routes identical, 5,028 and 290 elements |
| S11: Game Log (`48-logbook.css`, `49-passport-book.css`) | 4 | 4 | 4 states identical with one seeded stamp, up to 817 elements |
| S12: salaries (`70-contracts-grid.css`, `71-salaries-league.css`) | 2 | 2 | `/salaries` and `/team/158/contracts` identical |
| S13: trade deadline (`47-trade-deadline.css`) | 2 | 3 | `/trade-deadline` and `/trade-deadline/2025` identical; `.trade__stack` synthetic only |

**What could not be checked.** The headless browser cannot load live MLB data in
the cloud container: the proxy re-signs TLS and Chromium rejects the certificate. I
did not work around that. So no route that needs a live `statsapi` response was
captured. Consequences:
- S8: the real pair view (`/scout/{pitcher}/{hitter}`) never drew. `.scout__hitfact`
  has no real capture; `.scout__pair`, `.scout__side` and `.scout__key` are covered
  by their `/design-lab` specimen (Matchup and ScoutLab sites), not by the real page.
  `synth.mjs` (on `/scout`) is identical for all seven hosts.
- S13: `.trade__stack` (the trade card) did not render on any offline route.
  `synth.mjs` proves the CSS, not the page.
- S9: a search with typed results (a Players or Teams group) was not reached; only the
  Recent group was.
- No spoiler-scope surface was touched (the Game Log stamp art sits behind its own
  gate; `Stack` only wraps it).

**Hard sites.** Converted by hand: `.searchoverlay__results` (id and `aria-busy` on
several lines; its CSS rule also holds a comment), `.animlab__frame` (a `style`
prop), `.passportbook` (a key handler).

**Capture noise, and the tool changes that remove it.** Unchanged code gave
different geometry in four places. `geom.mjs` now has `FREEZE=1` (animations off:
`/animation-lab` differed on 246 elements between two runs), `BLOCKIMG=1` (every
image request aborted, then wait for images to settle: a header logo raced its
fallback on `/team/158/contracts`) and a `{"clickText":"…"}` step. Two noise sources
are NOT removed: the `Loader` specimen on `/design-lab` moves 2.4px between runs
(S8), and five off-screen team-switcher logo elements on `/team/158/contracts@390`
still differed between two unchanged runs (S12). Both AFTER runs of S12 matched the
BEFORE run exactly. `/trade-deadline/2025@760` gave 3665 elements once (S13); two
more runs gave 3666, the BEFORE count. A clean BEFORE/AFTER pair needs the same
flags on both runs. For S12, BEFORE was captured from the stashed, unmigrated
code. Three helpers were added: `add-import.py`, `strip-css.py` and `whois.mjs`
(names the element behind a diff path).

**Left for Gary** (not decided here): keep or drop `Cluster`'s `align` prop; add a
`rowGap` to `Grid`; use `Stack gap="section"` on a page. Not done: the 37 odd-gap
stacks, the 32px stack, Cluster and Grid migrations. Left unmigrated because they
are safe but did not fit a one-or-two-partial family this round: scoring-surface
rules (`.starter__info`, `.pbp`, `.consolebar__tallygroup`, `.trailstrip`,
`.refpanel__body`, `.pcard__sec` and others), the admin contract pages, standings,
wild card and the workload partials.

## Decisions on the open questions (Gary, 2026-10-05)

1. **`Cluster` keeps its `align` prop.**
2. **`Grid` gets no `rowGap`.** The 2 grids that need two gap values stay hand-written.
3. **`Stack gap="section"` gets a pilot on `/salaries`.** One page, its own slice, geometry checked. Run on 2026-10-05: `/salaries` **stopped, not migrated** (see "Section gap pilot"). Gary then chose the team hub; its Roster tab is **migrated**, the other tabs are not (see "Section gap pilot, second run").

## Section gap pilot (`/salaries`, 2026-10-05)

**Result: stopped before any code change. The page does not space its sections at
16px today. It spaces them at 0px.** A `Stack gap="section"` around them adds
space. It cannot replace a margin, because there is none to remove.

The top-level children of `.screen` on `/salaries` (`SalariesPage.jsx`), measured
with computed styles at 390 and 760px:

| child | margin-top | margin-bottom | between sections? |
| --- | ---: | ---: | --- |
| `.sitebar`, `.topbar` | 0 | 0 | no: the page header |
| `.vsteam__tray` (club rail) | 8px | 8px | no: its own control margin |
| `.card.payboard` (Highest paid players) | 0 | 0 | section |
| `.payowed` (Most committed) | 0 | 0 | section |
| `.payclubs` (Club payrolls) | 0 | 0 | section |
| `.posspend` (Spend by position) | 0 | 0 | section |
| `.paysource` (source line) | 16px | 0 | no: a note under the last section |
| `.sitefooter` | 32px | 0 | no: the page footer |

The four sections touch edge to edge: each top is the previous bottom (at 390px,
856, 1239 and 2379). The CSS agrees: `71-salaries-league.css` sets no margin on
`.payowed`, `.payclubs` or `.posspend`, and `system/card.css` says a card owns no
margin. The 16px above `.paysource` is a note margin, and it stays.

**The trial.** I wrapped the four sections in one `Stack gap="section"`, with no
margin to remove. BEFORE was captured twice with `FREEZE=1 BLOCKIMG=1` and
`?nointro`; the two runs are identical (890 elements at 390 and 760px), so the
capture is stable. AFTER gave 891 elements (the wrapper) and a page 48px taller at
both widths: 4855 to 4903px at 390, 3522 to 3570px at 760. That is 3 gaps of
16px. Zero differences is not met, so I reverted the edit. This branch holds no
code change.

**What this means for the plan.**
- The "Section gap" census above was wrong for this page. It counted margins of 16px
  or more across all partials and read them as an upper bound for "pages separate
  sections by 16px". On `/salaries` the true figure is 0px. **Inference, not
  checked:** other pages built from flush cards and bands (the club ledger, the
  Contracts tab) may do the same. I traced one page only.
- `gap="section"` is 16px, and `Stack` has no 0px step. So this page cannot adopt it
  with no visible change. The sections would also stop touching, which changes the
  look of a page built as one ledger.

**Options for Gary** (not decided here):
1. Accept the change: +16px between each pair of sections on `/salaries`, +48px in
   all. Then run `npm run visual` on the page and list the route in the PR.
2. Pick a page that does space its sections with a `margin-top` of 16px, and pilot
   there. Finding one needs a trace; the census does not name pages.
3. Leave `gap="section"` unused for now. The token and the prop stay.

**Not checked in this run.** I did not look at any other page (the second run below did). I did not run `npm run visual` or
`npm run e2e`. I did not judge by eye whether 16px between the sections looks right, because
the pilot stopped first.

**Other pages that reuse these blocks (step 5).** `SourceLine` is also used by the
team Contracts tab (`ContractsTab.jsx`). The other three blocks and `.payowed` are
used on `/salaries` only. No file was changed, so nothing else moves.

## Section gap pilot, second run: the team hub (2026-10-05)

Gary chose "pilot on another page", and then "migrate the whole hub". **Result: the
Roster tab is migrated with zero differences. The other tabs are not, because a
Stack would change them.** The shared hub margin rule stays.

**The trace.** I measured the top-level children of `.screen` on about 40 routes at
390px (computed margins and gaps; live data for the hub). Sections spaced by 16px:
only the team hub, through one rule, `.team-hub :where(.card):not(:where(.card
.card))` in `09-team-info.css`, whose comment says the space is the parent's "until
#1180 gives the parent a Stack". Every other page I traced spaces its sections
at some other step, so `gap="section"` (16px) would change it:

| page | gap between sections |
| --- | ---: |
| `/salaries` | 0px |
| `/attendance`, `/pace-of-play`, `/farm-system-rankings`, `/bullpen-availability`, `/doubleheaders`, `/run-differential` | 32px |
| `/nine-keys` | 24px |
| `/all-star-legacy` | 20px |
| `/design-lab` | 40px |
| `/first-scorebook` | 58px |
| `/rehab`, `/milestones`, `/awards` | one section, nothing to space |

**What changed.** `RosterTab.jsx` wraps its four cards in one `Stack gap="section"`
(the as-of banner stays outside, after it). `09-team-info.css` gets one rule,
`.team-hub .stack > .card { margin-top: 0 }`. Three classes beat the namespace
rules `.roster-super` and `.tstats`, which each set their own 16px. I first deleted
those two margins instead, and `/all-star-rosters` (which draws `.roster-super`)
moved 320px and `/design-lab` 16px, so I reverted that. Nothing else in the hub
reads the new rule yet.

**Checked.** BEFORE was captured twice with `geom.mjs` (`FREEZE=1 BLOCKIMG=1
PROXY=1`, `?nointro`, 390 and 760px) and the two runs match. After the edit:

| route | result |
| --- | --- |
| `/team/158/roster`, `/team/556/roster`, `/team/111/roster`, `/team/147/roster` | 0 differences at 390 and 760px |
| `/team/158/roster?d=2026-07-15` (dated, with the banner) | 0 differences |
| `/team/158`, `/games`, `/numbers`, `/contracts`, `/minors`, `/leaders`; `/team/556`, `/numbers`, `/minors` | unchanged |
| `/all-star-rosters`, `/design-lab` | unchanged |

"0 differences" counts every element's rect and layout style, with two known
exceptions that are not layout. (1) The wrapper itself is one new element. (2)
Chrome reports `min-width` as `0px` on a block and `auto` on a flex item, so each
of the 3 or 4 cards in the Stack reads `0px` before and `auto` after. The rects
are equal. Off-screen club-switcher logos also flip between `img` and `span`
between two unchanged runs (known from S12); I did not count them.

**Why the other tabs are not migrated.**
- **Numbers.** A trial gave +20px at 390 and 760px. The `.tledg` block (team
  leaders) is 18px from its neighbour today, not 16: its head has an 18px top
  margin that collapses out through the block. In a Stack it does not collapse,
  so the gap is 16 + 4 + 18.
- **Minors, on a minor-league club.** A trial gave +16px on `/team/556/minors`
  for the same reason: the Affiliation history section opens with an 18px head
  margin. The Brewers' Minors tab has no such section and matched, so the tab
  passes on MLB clubs and fails on minor-league ones.
- **Overview and Games.** I did not run a trial. Their cards sit between doors and
  a transactions card with other spacing (`.thub__door` 8px above and 16px below,
  `.txcard` 14px both ways, one card 8px above and 14px below, `.tledg` 18px). One
  Stack would add 16px to each of those gaps.
- **Contracts.** One section and some hints with 14px margins. No gap to move.

These trials were reverted. A way forward, not decided here: give the 18px head
margin its own place (the SectionHead's leak, `system/section-head.css`), and
group each card with its door, so a tab becomes a few Stacks. Then the shared rule
can go.

**Tool change.** `geom.mjs` takes `PROXY=1`: the browser goes through `HTTPS_PROXY`
with `localhost` bypassed, and waits 3s for live data. The container had no CA in
the browser trust store (NSS), so I installed `libnss3-tools` and added
`/root/.ccr/agent-proxy-ca.crt` with `certutil`. Certificate checks stay on. This
is per container: a new session needs the same two steps. A live page can change
between runs, so capture BEFORE twice first.

**Not checked.** The "Season" roster toggle (a click state) and a Roster tab at a
width other than 390 and 760px. Four clubs only; a club whose injured list is
empty, or one with no bullpen card, was not singled out. I did not run `npm run
visual` or `npm run e2e`.

## Grid slice G1 (2026-10-07)

First `Grid` migration: 8 of the 25 movable `auto-fit`/`auto-fill` rules, 9 JSX
sites. Each is a one-class rule with a single static site and a gap on the 8 or
12px step, so nothing snaps. The rule keeps only what `Grid` does not own
(padding, margin-top, `align-content`).

| rule | `min` | mode | gap |
| --- | --- | --- | --- |
| `.offday__grid` (ul) | 120 | fill | snug |
| `.hzntile__stats` | 64 | fit | snug |
| `.rehabgrid` | 150 | fill | base |
| `.trrank__tilegrid` | 250 | fit | base |
| `.trec__counts` | 8.5rem | fill | snug |
| `.iddrawer__fields` (2 sites) | 150 | fit | snug |
| `.logogrid` (ul) | 140 | fill | base |
| `.colorlab__wpapreviewfields` | 90 | fill | snug |

**Checked:** `/logos` and `/rehab` (mock API, `FREEZE=1 BLOCKIMG=1`): geometry
identical at 390 and 760px, 178 and 421 elements. The other six hosts need live
data or the dev-only identity lab, so they were not drawn. `npm run lint` and
`npm test` pass. `npm run visual` was not run (Gary asks for it).

**Left (17 rules):** ones with a responsive override or `@media` twin
(`.sitefooter__actions`, `.sitemenusheet__scroll`, `.allstarlegacy__*`,
`.gamelist`), a gap off the steps (`.logbook__grid` 20px, `.scout__*` 6px,
`.patternlab__grid`, `.ninekeys__keys`), scoring-adjacent surfaces
(`.marginnotes__grid`, `.gamephotos__grid`), and the `/design-lab` grids.

## Cluster slice C1

First `Cluster` migration. 8 one-class wrapping-row rules on 12 JSX sites, all on
the 4, 8 or 12px step, so nothing snaps. Base: `origin/main` at f150612ab.

| rule | gap | sites | kept in the rule |
| --- | --- | ---: | --- |
| `.cwb__tabs` (`74-contract-workbench.css`) | snug | 1 | nothing (rule deleted) |
| `.standings-jumps` (`30-standings.css`) | tight | 3 | nothing; `--scroll` still sets its own `flex-wrap` |
| `.coverpick__colors` (`60-book-cover-picker.css`) | base | 1 | nothing |
| `.bpadmin__row` (`61-ballpark-admin.css`) | snug | 1 | nothing |
| `.lookupdeck__filters` (`74a-contract-lookup.css`) | base | 1 | nothing |
| `.idlab__barsrow` (`17-identity-lab-workbench.css`) | base | 1 | nothing |
| `.idlab__wpaartrow` (same file) | snug | 1 | nothing |
| `.bookmgmt__actions` (`58-logbook-shelf.css`) | base | 3 | `align-items: center` |

**Method.** `cluster-candidates.mjs` is `stack-candidates.mjs` for wrapping rows
(one class, `display: flex`, `flex-wrap: wrap`, one gap, no other layout rule for
the class, static JSX sites on a Cluster element). It finds 57 safe rows (it still
lists 16px rows, which have no Cluster step). I took the 8 with the least left in
the rule. `test/cluster-migration.test.js` was written first and failed on both
the rules and the sites. It pins: no layout left on a migrated class, every site is
a `<Cluster>` with the old step, and no migrated partial loads ahead of
`system/cluster.css` in `index.css`.

**Cascade.** All eight partials are lazy (a component imports them), so they load
after `system/cluster.css`. `.standings-jumps--scroll` and `.bookmgmt__actions`
keep one class each, so they still win on order. `.newbook__actions` (margin,
padding, border) shares an element with `.bookmgmt__actions` and touches no layout.

**Left out.** Rules in `15-team-color-lab.css`, `62-identity-admin.css`,
`65-team-records.css`, `66-situational-records.css` and `06b-offday-cards.css`
(Grid G1 edits them), scoring surfaces (`10-lineup.css`, `scorecard/*`,
`.trailstrip__cells`, `.pbp__replaypicks`), rules with a 16px gap, rules with
declarations beside the layout (a later slice), and any site with a dynamic
`className`.

**Checked.** `geom.mjs` BEFORE (`main`) and AFTER, 390 and 760px, `MOCK=1 FREEZE=1
BLOCKIMG=1`: `/logbook/new` (the `bookmgmt__actions` site) and `/standings` (2 and 1
`standings-jumps` sites) identical, 269 to 1,036 elements. `/identity-lab` (both
`idlab__*` rows) has equal page heights, but the element count moves between runs
of UNCHANGED code (1,066 to 1,076 at 390px): a nav logo `img` races its fallback
`span`. `synth.mjs` (new `CLUSTER=1` switch) on a route that loads each sheet:
`cwb__tabs`, `lookupdeck__filters` on `/admin/contracts`, `coverpick__colors`,
`bookmgmt__actions` on `/logbook/new`, the `idlab__*` pair on `/identity-lab` and
`standings-jumps` on `/standings`, all identical at both widths.

**Not seen.** `.bpadmin__row`: `61-ballpark-admin.css` loads only for an admin, so
neither a real page nor a synthetic baseline was possible. Its rule and the old one
are the same three declarations. The real pages for `cwb__tabs` and
`lookupdeck__filters` (Clerk-admin gated), the book management sheet, the
`--scroll` date strip on `/standings` (not drawn by the mock) were not drawn.
`npm run visual` and `npm run e2e` were not run.
## Stack slice S14 (2026-10-07)

Nine one-class `flex-direction: column` rules on one gap step moved onto
`Stack`: 9 rules, 9 JSX sites in 5 files. The finder counts **38 safe
candidates on `main` before S14 and 29 after**. The log above said about 44; that
figure is stale (S8 to S13 and the other work since have used it up).

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.fhist__span` | tight | li | flex, width, padding, frame |
| `.fhist__parks` | base | ul | margin, padding, list-style |
| `.fhist__parkline` | tight | li | nothing (deleted) |
| `.scout__game` | snug | div | nothing (deleted) |
| `.scout__pa` | snug | article | padding, frame |
| `.introsheet__step2` | loose | div | nothing (deleted) |
| `.introsheet__confirm` | base | div | nothing (deleted) |
| `.psrace__leagues` | loose | div | nothing (deleted) |
| `.staffgrid` | snug | div | nothing (deleted) |

**Cascade.** `system/stack.css` loads before 06, so every partial here loads after
it. None of the nine rules keeps a `display`, `flex-direction` or `gap`, so none
can win or lose against `.stack`. `.fhist__parks` is a `ul`: `.stack--list` sets
`margin: 0; padding: 0; list-style: none`, and the rule keeps its own margin and
padding and loads later, so it still wins on order.

**Test first.** `test/stack.test.js` (section 6) names each rule, its gap and its
JSX site. It failed on `main` and passes now.

**Left out on purpose.** Scoring surfaces (`.starter__info`, `.teammate__mid`, `.pbp`,
`.trailstrip`, `.refpanel__body`, `.moundcard__verdict`, `.gamehud__outs`,
`.psseries__potgMain`). Files another open PR edits: `14-strike-zone.css`,
`15-team-color-lab.css`, `31-wild-card.css` (Grid G1, #1630), and
`30-standings.css` and the contract partials `74-contract-workbench.css` and
`74a-contract-lookup.css` (Cluster C1). `.scout__pm`
(a dialog with a key handler, so the converter refuses it), `.xl-entry` and
`.xl-entry__head` (Express Lane, a pitch-by-pitch viewer; I did not judge them).

**Checked.** Capture was `geom.mjs` with `FREEZE=1 BLOCKIMG=1`, `?nointro`, 390 and
760px, taken twice before and once after. The two BEFORE runs match, and AFTER
matches BEFORE: 0 differences on `/scout`, `/postseason-race`,
`/bullpen-availability`, `/team/158` and `/team/158/minors` (240 to 1,216 elements).
`synth.mjs` on the old and new markup is identical for all nine classes (on
`/scout`, `/postseason-race`, `/bullpen-availability` and `/team/158`). A first BEFORE
taken from a `git archive` copy (no `.git`) differed on every route, even `/`: the
build info reads git. BEFORE now comes from `git checkout origin/main` of the ten
files, in the same checkout.

**Not seen.** The headless browser cannot reach live `statsapi` from the cloud
container, so no route drew real data. The routes above show their empty or
loading state, so the nine classes rarely drew: `.fhist__*` (the franchise history
card needs a club with ballpark data), `.scout__game` and `.scout__pa` (past
meetings), `.introsheet__*` (the account step, needs Clerk), `.psrace__leagues`
(the standings are empty) and `.staffgrid` (bullpen rows). The synthetic check
proves the CSS, not the page. I did not run `npm run visual` or `npm run e2e`.
The raw-value lint prints "went DOWN" for hex, radius and motion. That is not
from this slice (it deletes no raw value); I did not change those budgets.

**Open question.** `layout.md` is also edited by Grid G1 (#1630) and the Cluster
branch, so the three PRs will conflict on this file. Each only appends a section.

## Cluster slice C2 (2026-10-07)

Three one-class wrapping-row rules in `78-offseason.css` moved onto `Cluster`: 3 rules,
3 JSX sites in 3 files. Base: `origin/main` at 1041d9d4. The finder lists 49 safe rows
on `main`; this partial has the most that fit the 5-file cap (the larger families
need 6 or more files, or hold a 16px gap, or sit on a surface another PR edits).

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.pgame__actions` (`PickedGame.jsx`) | base | div | `margin-top` |
| `.seasonnote__leagues` (`YoungestRegulars.jsx`) | snug | div (`role`, `aria-label` pass through) | `margin-top` |
| `.srecord__doors` (`SeasonRecord.jsx`) | base | div | `margin-top` |

**Test first.** The three rules joined `MIGRATED` in `test/cluster-migration.test.js`
(with a `keeps: ['margin-top']` entry each). It failed on the rules and the sites, and
passes now. **Cascade.** `78-offseason.css` loads after `system/cluster.css` in
`index.css`, and the rules keep no layout, so none can win against `.cluster`.

**Left in their namespace.** `.idlab__monoinkrow` (16px gap, no step), `.idlab__*` with
sites in 6 files, `.rpt-controls` (19 sites), and everything in the C1 "Left out" list.

**Checked.** `geom.mjs` (`FREEZE=1 BLOCKIMG=1`, `?nointro`, 390 and 760px) on `/12152025`:
AFTER matches the first BEFORE, 0 differences (675 and 676 elements). The second
BEFORE differs from the first by the known logo `img`/`span` race, 5 elements at 390px,
so the AFTER-vs-second-BEFORE diff shows the same 5. `synth.mjs` with `CLUSTER=1` on
the three classes: identical at both widths. Only `srecord__doors` drew for real.

**Not seen.** `.pgame__actions` and `.seasonnote__leagues` did not draw (no live
`statsapi` from the container, and `PickedGame` opens only in December); the synthetic
check proves the CSS, not the page. `npm run visual` and `npm run e2e` were not run.

## Cluster slice C3 (2026-10-07)

Two identity-lab rules in `17-identity-lab-workbench.css` moved onto `Cluster`: 2 rules,
3 JSX sites in 2 files. Base: `origin/main` at 1041d9d4. Picked because it had the most
safe rows left that fit the 5-file cap without a 16px gap, a `<p>` host or an open PR's file.

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.idlab__recolorpalette` (`LogoRecolorEditor.jsx`) | snug, `align="center"` | div | `margin-top` |
| `.idlab__monoinkparts` (`LogoRecolorEditor.jsx`, `ShapeInkPicker.jsx`) | snug, `as="ul"` | ul | `margin` (`.cluster--list` resets the rest) |

**Test first.** Both joined `MIGRATED` in `test/cluster-migration.test.js`; it failed on the
rules and the sites, and passes now. **Cascade.** The partial loads after `system/cluster.css`.
No gap was off-step, so nothing snapped.

**Left in their namespace.**
- `.idlab__umpire` (`HeaderPreview.jsx`): a safe row, but removing its 7 lines takes the
  partial to 1200 lines, which trips the `check-file-size` ratchet. Tightening that budget is a
  6th file. Next slice: migrate it and tighten `BUDGETS` to 1200 in the same commit.
- `.idlab__monoinksource` (tight, 2 sites in 2 more files), `.idlab__monoinkrow` (16px, no step).
- `.cwb__candline` and `.cwb__rowactions`: they sit on `<p>`, and `Cluster` has no `p`. Changing
  the element is a design choice; I did not make it.
- `.cwb__progress`, `.cwb__qsub`, `.cwb__chips`: admin-gated, and 3 files, so they did not fit
  beside the idlab rows.

**Checked.** `geom.mjs` (`FREEZE=1 BLOCKIMG=1`, `?nointro`) on `/identity-lab`, 390 and 760px:
both classes draw for real (1 and 2 elements). BEFORE (`HEAD`) vs AFTER: 1103 elements each,
0 differences, same page heights, after dropping the nav logo `img`/`span` element, which flips
between runs of UNCHANGED code (two BEFORE runs differ in element count too).

**Not seen.** The `HeaderPreview` umpire row (not migrated). Interactive states of the
recolor editor beyond first draw. `npm run visual` and `npm run e2e` were not run.

## Cluster slice C4 (2026-10-07)

One identity-lab rule in `17-identity-lab-workbench.css` moved onto `Cluster`: `.idlab__umpire`,
1 JSX site (`HeaderPreview.jsx`, `UmpireCall`). Base: `origin/main` at b24dff28.

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.idlab__umpire` | snug (`--space-2`), `align="baseline"` | div | nothing, so the whole rule is gone |

**Test first.** It joined `MIGRATED` in `test/cluster-migration.test.js`; the test failed on the rule
and the site, and passes now. The rule keeps nothing, so it has no `keeps:` entry. **Cascade.** The partial
loads after `system/cluster.css`. The gap was on-step, so nothing snapped. **Budget.** The partial is now
1200 lines; `BUDGETS` in `scripts/check-file-size.mjs` went from 1300 to 1200 in the same commit.

**Checked.** `geom.mjs` (`FREEZE=1 BLOCKIMG=1`, `?nointro`) on `/identity-lab`, 390 and 760px: the class
draws for real (2 elements at each width). BEFORE (`HEAD`) vs AFTER, after dropping the nav logo
`img`/`span` element (it flips between runs of unchanged code): 0 differences (1109 elements at 390px,
1103 at 760px), same page heights. Element counts also vary a little between runs of unchanged code, so
I compared only runs with equal counts: 2 BEFORE runs against 4 AFTER runs.

**Not seen.** The Safe/Out colour states of the chip beyond the first draw. `npm run visual` and
`npm run e2e` were not run.

## Cluster slice C5 (2026-10-08)

Two Game Log chip rows moved onto `Cluster`: 2 rules, 2 JSX sites in 2 files. Base: `origin/main` at
ab98c96. No open PR touched these files. The finder lists 44 safe rows; the larger families need more than
the 5-file cap, hold a 16px gap, or sit on a surface another issue owns.

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.logbook__seasons` (`StampCollection.jsx`) | snug, `as="nav"` | nav (`aria-label` passes through) | `margin-bottom` |
| `.logbookstats__levels` (`LogbookStatsPage.jsx`) | snug | div (`aria-label` passes through) | `margin-bottom` |

**Test first.** Both joined `MIGRATED` in `test/cluster-migration.test.js` with `keeps: ['margin-bottom']`; it
failed on the rules and the sites, and passes now. **Cascade.** Both partials are lazy, so they load after
`system/cluster.css`. The descendant rules (`.logbook__seasons small`, `.logbookstats__levels .pill`) stay.

**Checked.** `geom.mjs` (`MOCK=1 FREEZE=1 BLOCKIMG=1`, `?nointro`, 390 and 760px) on `/logbook/stats` and
`/logbook`: BEFORE (stash) vs AFTER identical, 234 and 236 elements, same page heights. `synth.mjs` with
`CLUSTER=1`: `logbook__seasons` on `/logbook` and `logbookstats__levels` on `/logbook/stats` identical at both
widths. Each class only has its sheet on the route named; the other route shows a block in OLD, which is not a
regression.

**Not seen.** With the mock there are no stamps, so neither row drew for real (the season nav needs two or
more seasons; the level bar needs stamps). The synthetic check proves the CSS, not the page. `npm run visual`
and `npm run e2e` were not run.

**Left.** `.stampsheet__levels` (`StampSheet.jsx`, 6th file), `.idlab__mastheadmode` (2 more files),
`.team-hub__namerow` (2 sites in 2 files), `.idlab__eraactions` (`EraRow.jsx`, #1747).

## Cluster slice C6 (2026-10-08)

Four wrapping rows, one per file, moved onto `Cluster`: 4 rules, 4 JSX sites in 4 files. Base:
`origin/main` at 1574055. The one open PR (#1751) edits a skill file only. The finder lists 42 safe rows.

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.stampsheet__levels` (`StampSheet.jsx`) | snug | div (`role`, `aria-label` already there; pass through) | nothing, so the rule is gone (`.pill` descendant stays) |
| `.mytally__choices` (`DeviceSection.jsx`) | snug | div (`role`, `aria-label` pass through) | `margin-top` |
| `.consent__actions` (`ConsentModal.jsx`) | snug | div | `margin-top` |
| `.staffgrid__summary` (`StaffGrid.jsx`) | snug, `align="center"` | div | nothing, so the rule is gone |

**Test first.** All four joined `MIGRATED` in `test/cluster-migration.test.js`; it failed on the rules and the
sites, and passes now. **Cascade.** `46`, `54` and `76` load after `system/cluster.css` in `index.css`, and
`48c` is lazy. No gap was off-step, so nothing snapped.

**Left.** `.txntl__head` (`05-masthead-nav.css` loads ahead of `cluster.css`, so the order guard would fail),
`.cmdmap__chips` (4 sites in 3 files, plus a `--types` modifier), `.animlab__frozen` (16 sites, a lab),
`.team-hub__namerow` (2 files), the `.cwb__*` rows (admin), `15-team-color-lab.css` (Grid G1).

**Checked.** `geom.mjs` (`MOCK=1 FREEZE=1 BLOCKIMG=1`, `?nointro`, 390 and 760px), BEFORE (stash) vs AFTER:
`/profile`, `/bullpen-availability`, `/logbook/stats`, `/milestones` all identical (393, 1116, 234 and 3810
elements, same page heights). `.mytally__choices` (`/profile`) and `.staffgrid__summary`
(`/bullpen-availability`) drew for real, 1 element each at both widths.

**Not seen.** `.stampsheet__levels` and `.consent__actions` did not draw under the mock (no stamps; the consent
modal opens from a tap on a sealed score). The CSS change is the same four declarations for each.
`npm run visual` and `npm run e2e` were not run.

## Grid slice G2 (2026-10-08)

Second `Grid` migration: 2 rules, 2 JSX sites. Only two of the 17 rules G1 left
pass the filter (one class, no responsive twin, gap on the 8 or 12px step, not
scoring-adjacent), so the slice is small. Nothing snaps.

| rule | `min` | mode | gap |
| --- | --- | --- | --- |
| `.idlab__erafields` (keeps `min-width: 0`) | 7rem | fit | snug |
| `.gamesgrid__grid` (rule deleted, class dropped) | 100 | fill | snug |

**Test:** `test/grid-migration.test.js` pins both (rule holds no layout, site is a
`<Grid>` with the old `min`, mode and gap). It failed first, then passed.

**Checked:** `/team/158/games` (mock API, `FREEZE=1 BLOCKIMG=1`, 390 and 760px):
5,315 and 5,313 elements, geometry identical. The only differences are three
team-logo `<img>`/`<span>` fallbacks that also differ between two runs of the same
code (the logo race `BLOCKIMG` is meant to hide); their rects match.
`.idlab__erafields` is in the dev-only identity lab and was not drawn.
`npm run lint`, `npm test` and `npm run build` pass. `npm run visual` was not run.

**Left (15 rules):** a two-value or off-step gap (`.cwb__sheet`, `.navdir`,
`.scout__facts`, `.scout__pitches`, `.logbook__grid`, `.patternlab__grid`), no gap
(`.ninekeys__keys`), a responsive override or `@media` twin (`.allstarlegacy__*`,
`.gamelist`, `.sitefooter__actions`, `.stamppane__grid`), a non-`minmax(px, 1fr)`
column (`.photorail--strip`), scoring-adjacent (`.marginnotes__grid`,
`.gamephotos__grid`), and the `/design-lab` grids.

## Stack slice S15 (2026-10-08)

Three one-class `flex-direction: column` rules moved onto `Stack`: 3 rules, 4 JSX sites in 4 files.
Base: `origin/main` at 528c1b1. The finder counted 29 safe candidates after S14.

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.trrank__detail` (`SituationalBoard.jsx`, `PostseasonRecordsPage.jsx`) | loose | main | nothing (deleted) |
| `.standings-ctrl` (`StandingsPage.jsx`) | snug | div | `margin-bottom` |
| `.coachtree__node` (`CoachingTree.jsx`) | tight | li | padding, size (the shared border rule stays) |

**Cascade.** None of the three rules keeps a `display`, `flex-direction` or `gap`, so none can win or
lose against `.stack`.

**Test first.** `test/stack.test.js` (section 7) names each rule, its gap and its JSX site. It failed on
`main` and passes now.

**Left on purpose.** Scoring surfaces and Express Lane, as listed in the brief. `.scout__sheet` (a dialog),
`.printsheet-screen__intro` (keeps `align-items`), and `.projection__list`, `.stampstrip__note` and
`.pcard__sec` (not judged). Files #1754 edits: `StampSheet.jsx`, `ConsentModal.jsx`, `StaffGrid.jsx`,
`DeviceSection.jsx`.

**Checked.** `geom.mjs` (`MOCK=1 FREEZE=1 BLOCKIMG=1`, `?nointro`, 390 and 760px), BEFORE (stash) vs AFTER:
0 differences on `/standings`, `/situational-records`, `/situational-records?metric=trr_1`,
`/postseason-records`, `/postseason-records?view=team` and `/manager/craig-counsell-453356`.
`.standings-ctrl` and `.trrank__detail` drew for real, 1 element each at both widths.

**Not seen.** `.coachtree__node` and the `PostseasonRecordsPage` site of `.trrank__detail` did not draw under
the mock. `npm run visual` and `npm run e2e` were not run.

## Stack slice S16 (2026-10-08)

Three one-class `flex-direction: column` rules moved onto `Stack`: 3 rules, 7 JSX sites in 5 files, and a
stricter slice test. Base: `origin/main` at 24f9ec3. The finder counted 26 safe candidates.

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.colorlab__row` (`UniformNamesPage.jsx`) | snug | section (with `id`) | nothing (deleted) |
| `.colorlab__logodrop` (`LogoDropZone.jsx`) | snug | div | `flex`, `align-items`, `max-width` |
| `.lookupdeck__field` (`LookupDeck.jsx`, 5 sites, 4 with `--compact`) | tight | div | nothing (deleted) |

**Cascade.** None of the three rules keeps a `display`, `flex-direction` or `gap`, so none can win or lose
against `.stack`. `.lookupdeck__field--compact` sets only `flex` and `min-width`.

**Test first.** `test/stack.test.js` section 7 now covers S15 and S16 the way `cluster-migration.test.js`
does: it reads rules after `{` and `,` (inside `@media` or a grouped selector), counts every JSX site of
the class and asserts each is a `<Stack>` with the old step, and reads the opening tag, so prop order does
not matter. It still passed on S15 (checked before S16 went in) and S16 failed on `main`. The tuples lost
their sheet and file columns: the scan covers every stylesheet and source file.

**Outer `<main>` stack (brief rule 3).** None picked. No chosen rule sits on a page's outer `<main>`.
`.trrank__detail` (S15) did and is `loose`; `--space-section` is `var(--space-4)`, the same 16px step.

**Left on purpose.** Scoring surfaces and Express Lane, as listed in the brief. `.cwb` (loose, a `div`, fits
a later slice), `.szmodal__body` (a modal), `.logotile` (`14-strike-zone.css`, six kept lines, not judged),
`.patternlab__card`, `.horizoncard__list` (`31-wild-card.css`, Grid G1), `.dlab__tables`,
`.consolebar__tallygroup` (also written inside `@media`), `.pcard__sec` (6 sites in 4 files; over the
5-file cap), `.projection__list`, `.stampstrip__note`, `.printsheet-screen__intro` (keeps `align-items`),
`.scout__pm`, `.scout__sheet`. Open PR #1756 edits no file of this slice.

**Checked.** `geom.mjs` (`MOCK=1 FREEZE=1 BLOCKIMG=1`, `?nointro`, 390 and 760px), BEFORE from
`git checkout origin/main` of the five files in the same checkout: `/uniform-names` 0 differences (798
elements; 30 `.colorlab__row` drew). `synth.mjs` old vs new: 0 differences for `colorlab__logodrop` (on
`/uniform-names`) and `lookupdeck__field` (on `/admin/contracts`).

**Not seen.** `/identity-lab` draws `.colorlab__logodrop` three times, but two BEFORE runs of that route
differ in element count (1077, 1071, 1065), so it gives no geometry diff. `LookupDeck` is behind the Clerk
admin gate, so it never drew for real; the synthetic check does not build the `--compact` combination.

## Cluster slice C7 (2026-10-08)

Four wrapping rows in five files moved onto `Cluster`: 4 rules, 5 JSX sites. Base: `origin/main` at 24f9ec3.
The one open PR (#1756) edits play-by-play files only. The finder lists 38 safe rows.

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.pshistory__seasonhead` (`PostseasonHistoryPage.jsx`) | base, `align="center"` | div | nothing, so the rule is gone |
| `.psseries__potgWho` (`SeriesParts.jsx`) | snug, `align="baseline"` | div | nothing, so the rule is gone |
| `.erasesheet__actions` (`EraseDataDialog.jsx`) | snug | div | `margin-top` |
| `.team-hub__namerow` (`TeamHubShell.jsx`, `TeamLeadersPage.jsx`) | snug, `align="baseline"` | div | nothing, so the rule is gone |

**Test first.** All four joined `MIGRATED` in `test/cluster-migration.test.js`; it failed on the rules and the
sites, and passes now. **Cascade.** `28a`, `33` and `55` load after `system/cluster.css` in `index.css`; `35` is
lazy. No gap was off-step, so nothing snapped. No site sits inside a SealBox reveal.

**Left.** `.allstargame__main` (keeps `justify-content`), `.umpage__teamgrid` and `.coachtree__row` (lists with
3 or 4 kept declarations), `.trrank__chips` (Grid G1 file), `.cmdmap__chips`, `.rpt-controls` (19 sites),
`.animlab__frozen` (16 sites, a lab), `.cwb__*` (admin).

**Checked.** `geom.mjs` (`MOCK=1 FREEZE=1 BLOCKIMG=1`, `?nointro`, 390 and 760px), BEFORE (stash) vs AFTER:
`/postseason-history` (1 and 6 `pshistory__seasonhead`), `/team/158` and `/team/158/leaders` (1 `team-hub__namerow`
each) and `/profile` identical, same page heights. The first `/team/158` AFTER had 4 fewer elements than BEFORE
with equal heights (the known logo race); two more AFTER runs matched BEFORE exactly. `synth.mjs` (`CLUSTER=1`):
`erasesheet__actions` identical at both widths.

**Not seen.** `.psseries__potgWho` (the series page needs a live series; `synth.mjs` has no `align` switch, so
the baseline row was not checked synthetically) and `.erasesheet__actions` for real (the dialog opens from a tap).
`npm run visual` and `npm run e2e` were not run.

## Cluster slice C8 (2026-10-08)

Two wrapping rows moved onto `Cluster`: 2 rules, 6 JSX sites in 4 files. Base: `origin/main` at 72284f8.
Open PRs touching these files: none (#1783 edits other rules in `26`, `43`, `29`, `39`).

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.trrank__chips` (`SituationalBoard.jsx`, `SituationalRecordsPage.jsx` x2, `PostseasonRecordsPage.jsx` x2) | tight | div (`role`, `aria-label` pass through) | the `+ .trrank__chips` sibling `margin-top` rule |
| `.pbp__replaypicks` (`AtBatReplay.jsx`) | tight | div | the `.btn` descendant rule |

**Test first.** Both joined `MIGRATED` in `test/cluster-migration.test.js` with no `file` (no own rule is left);
it failed on `main` (3 of 4 tests) and passes now. **Cascade.** `card.css` loads after `system/cluster.css`;
`66` is lazy. No gap was off-step, so nothing snapped. No site sits inside a SealBox reveal.

**Left.** `.trailstrip__cells` (`AtBatTrail.jsx`: a site with `onKeyDown`, on the innings-viewer trail, a scoring
surface, so by hand later). The rest of the finder's list keeps three or more declarations, or is a lab or admin
row (`.dlab__*`, `.idlab__*`, `.cwb__*`, `.animlab__frozen`, `.rpt-controls` with 19 sites).

**Checked.** `geom.mjs` (`MOCK=1 FREEZE=1 BLOCKIMG=1`, `?nointro`, 390 and 760px), BEFORE (stash) vs AFTER:
`/situational-records`, `/situational-records?metric=trr_1`, `/postseason-records` and
`/postseason-records?view=team` all identical (1922, 608, 1376 and 1376 elements, same page heights).

**Not seen.** The geometry dump keeps no class names, so I did not confirm that any `.trrank__chips` row
drew under the mock. `.pbp__replaypicks` (a phone replay sheet behind a tap) was not loaded.
`npm run visual` and `npm run e2e` were not run.

## Cluster slice C9 (2026-10-08)

Named C9, not C8: PR #1787 took "C8" while this work ran, so this branch is stacked on it. Three wrapping rows
in five files moved onto `Cluster`: 3 rules, 3 JSX sites. The finder (after #1787's rules are gone) lists 34
safe rows.

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.colorlab__swatchrow` (`JerseyBench.jsx`) | base | div | nothing, so the rule is gone |
| `.colorlab__weardates-list` (`WearDates.jsx`) | tight | div | nothing, so the rule is gone |
| `.iddrawer__logo` (`IdentityLogoField.jsx`) | base, `align="start"` | div | nothing, so the rule is gone |

**Test first.** All three joined `MIGRATED` in `test/cluster-migration.test.js`; it failed on the rules and the
sites, then passed. The checker already reads `align` (it is in `props`), so no change to the helper was
needed. **Cascade.** `15`, `62` and `17a` are lazy (the identity lab and the identity drawer import them).
**Budget.** `15-team-color-lab.css` is 674 lines now; its budget went from 700 to 680.

**Left.** `.txntl__head` (`05-masthead-nav.css` loads before `system/cluster.css`, so the test's cascade check
would fail), `.idlab__eraactions` (keeps `grid-column`), `.starter__body` and `.abhero__meta` (scoring
surfaces), `.dlab__*`, `.cwb__*`, `.animlab__frozen`, `.rpt-controls` (as in C7).

**Checked.** `synth.mjs` (`CLUSTER=1`, on `/identity-lab`) old vs new: `colorlab__swatchrow` and
`colorlab__weardates-list` identical at 390 and 760px. `geom.mjs` on `/identity-lab` drew both classes, but its
element count differs between two BEFORE runs (1062 and 1070 at 760px; 1071 and 1077 at 390px) with equal page
heights, so it gives no geometry diff.

**Not seen.** `.iddrawer__logo` (the team identity drawer is behind the admin gate; `synth.mjs` has no `align`
switch). `npm run visual` and `npm run e2e` were not run.

## Cluster slice C10 (2026-10-08)

Four wrapping rows in seven files moved onto `Cluster`: 4 rules, 8 JSX sites. No open PR or layout.md used "C10"
(open PRs #1798, #1799, #1800, #1802 touch no stylesheet these rows live in; #1799 edits `home.css` only). The
finder listed 30 safe rows. No gap was off the three steps, so nothing was snapped.

| rule | gap | align | element | rule keeps |
| --- | --- | --- | --- | --- |
| `.cmdmap__chips` (`CommandMap`, `GloveTarget`, `PlayerAnalyticsTab`; 4 sites) | snug | stretch | div | `margin-block-end` |
| `.seriesedges__pen` (`PenEdge.jsx`) | snug | `center` | div | `margin-bottom` |
| `.idlab__monoinksource` (`MonoInkEditor`, `IdentityMonoField`; 2 sites) | tight | `center` | div | `margin` |
| `.daystrip-key` (`DayStrip.jsx`) | base | stretch | `ul` | nothing, so the rule is gone (`.cluster--list` is the reset) |

**Test first.** All four joined `MIGRATED` in `test/cluster-migration.test.js`; it failed on the rules and the
sites, then passed. **Cascade.** `26d`, `primer-main` and `17` are lazy (components import them); `76` loads after
`system/cluster.css` in `index.css`. **Budget.** `17-identity-lab-workbench.css` is 1196 lines now; its budget went
from 1200 to 1196.

**Left.** `.txntl__head` (loads before the cluster), `.starter__body`, `.abhero__meta` (scoring surfaces), `.dlab__*`,
`.cwb__*`, `.animlab__frozen`, `.rpt-controls` (as in C7/C9). Also `.spray__key` (the spray chart sits near a
reveal-only module; skipped to be safe), `.allstargame__main` (space-between), `.arsenal__head` and `.simlike__meta`
(keep `justify-content`), `.admincopy__savebar`, `.asof-banner`, `.scout__scenebar` (keep many declarations).

**Checked.** `synth.mjs` (`CLUSTER=1`, `/design-lab`) old vs new: `daystrip-key` identical at 390 and 760px.
`geom.mjs` on `/identity-lab` (`FREEZE=1 BLOCKIMG=1`): identical at 760px (1105 elements, height 4552); at 390px
the element count differs (1104 vs 1111) with equal page height 5634, the same noise C9 recorded. `npm run lint` and
`npm test` pass.

**Not seen.** `.cmdmap__chips` (`/design-lab` does not load `26d`, and the real routes need live statsapi),
`.seriesedges__pen` (the home primer is not wired until #1799 merges), and the `align="center"` of the identity-lab
row at 390px (the geom count noise; `synth.mjs` has no `align` switch). `npm run visual` and `npm run e2e` were not run.

## Cluster slice C11 (2026-10-08)

Written beside C10 and stacked with it (C10's rows were not on origin when I edited; no row clashed, only
`MIGRATED` and this file merged). Four wrapping rows moved onto `Cluster`: 4 rules, 4 JSX sites in 8 files.

| rule | gap | align | element | rule keeps |
| --- | --- | --- | --- | --- |
| `.umpage__teamgrid` (`UmpirePage.jsx`) | base | stretch | ul | nothing: `as="ul"` adds `.cluster--list`, which owns list-style, margin and padding, so the rule is gone |
| `.allstargame__main` (`AllStarGameResult.jsx`) | base | center | div | `justify-content: space-between` |
| `.simlike__meta` (`SimilarPlayerGrid.jsx`) | tight | baseline | span | `justify-content`, `min-width`, `font-size`, `line-height` |
| `.arsenal__head` (`PitchArsenalMix.jsx`) | snug | center | div | `justify-content: space-between`, `margin-bottom`, the wrap comment (reworded: Cluster does the wrap) |

**Test first.** Rows added to `MIGRATED`; the test failed on rules and sites before the move. The brief said the
`ul` rule keeps list-style, margin and padding. It does not need to: the list modifier does the same job, so I
deleted the rule whole. **Cascade.** `37` and `51` are lazy; `69` and `38` load after `system/cluster.css`.
**Budget.** None of the four partials has a budget entry (all well under the 700-line cap), so nothing to lower.

**Left.** Nothing from my four. Not taken: `.txntl__head`, `.starter__body`, `.abhero__meta`, `.animlab__frozen`,
`.rpt-controls`, `.dlab__*`, `.cwb__*`, any row on a `<p>` (as told).

**Checked.** `geom.mjs` (`PROXY=1 BLOCKIMG=1 FREEZE=1`, live statsapi), BEFORE vs AFTER, 390 and 760px, diff 0 on
`/umpire/x-427013` (885 elements, 1 `umpage__teamgrid`), `/all-star-rosters` (4840 elements, 10 `allstargame__main`)
and `/player/tarik-skubal-669373/analytics` (689 elements, 3 `simlike__meta`).

**Not seen.** `.arsenal__head`: it renders only in the starter's pitch mix on the lineup page (`TeamInfo.jsx`,
a scoring surface needing a live game with arsenal data). No geometry diff for it; its rule change is
declaration-for-declaration the same as the Cluster modifiers. `npm run visual` and `npm run e2e` were not run.

## Stack slice S17 (2026-10-08)

Two one-class `flex-direction: column` rules moved onto `Stack`: 2 rules, 2 JSX sites in 4 files. The slice
has two rules, not three: the finder lists 23 safe rows, and the rest are scoring surfaces
(`.starter__info`, `.teammate__mid`, `.trailstrip`, `.gamehud__outs`, `.pbp`, `.moundcard__verdict`,
`.refpanel__body`), Express Lane (`.xl-entry*`), or keep a non-`flex` declaration.

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.cwb` (`ContractIdentityReviewPage.jsx`) | loose | div | nothing (deleted) |
| `.scout__sheet` (`FilterSheet.jsx`, beside `.sheet`) | loose | div (`role="dialog"`) | nothing (deleted) |

**Cascade.** Neither rule kept a `display`, `flex-direction` or `gap`. `.sheet` (`14-strike-zone.css`) sets no
`display`, so `.stack` is not fought.

**Test first.** Both joined a new `S17` table in `test/stack.test.js`; it failed on the rules and the sites,
then passed.

**Left.** `.psseries__potgMain` (keeps `min-width`; Stack may keep only `flex`). The other finder rows are the
ones S16 left, or keep more than `flex`.

**Checked.** `synth.mjs` old vs new: 0 differences for `cwb` (on `/admin/contracts`) and `scout__sheet` (on
`/scout`) at 390 and 760px. The synthetic host carries only the one class, so it does not include `.sheet`.

**Not seen.** `.cwb` for real (Clerk admin gate) and the Scout filter sheet (opens from a tap).

## Cluster slice C12 (2026-10-09)

Three wrapping rows on the Design Lab chrome moved onto `Cluster`: 3 rules, 7 JSX sites in 3 files. Base: `origin/main` at 5a59a43.
Open PRs #1815 and #1816 touch none of these files. The finder lists 22 safe rows; the rest of the Design Lab
(`/design-lab`) rows were the best fit for one family, one stylesheet (`designlab/lab.css`).

| rule | gap | align | element | rule keeps |
| --- | --- | --- | --- | --- |
| `.dlab__jump` (`index.jsx`) | snug | stretch | nav | `position`, `top`, `z-index`, padding, background, border |
| `.dlab__entryhead` (`Entry.jsx`) | snug | baseline | div | `justify-content: space-between` |
| `.dlab__measure` (`tokens.jsx`, 5 sites) | snug | center | div | nothing, so the rule is gone |

**Test first.** Three rows added to `MIGRATED`; the test failed on rules and sites, then passed. **Cascade.** `lab.css`
is lazy (`/design-lab` imports it), so it loads after `system/cluster.css`. No gap was off-step, so nothing snapped.

**Left.** `.dlab__*` rules that keep more than the layout, `.cwb__*` (admin), `.idlab__*` (the monoinkrow gap is 16px,
which has no step), `.animlab__frozen`, `.rpt-controls`, scoring surfaces, `.txntl__head` (loads before the cluster).

**Checked.** `geom.mjs` (`MOCK=1 FREEZE=1 BLOCKIMG=1`, `?nointro`), BEFORE twice (stash) vs AFTER, 390 and 760px:
`/design-lab` identical, 5,539 elements, heights 68,556 and 47,411. The two BEFORE runs match.

**Not seen.** The sticky behaviour of `.dlab__jump` at scroll (the edit does not touch `position`).
`npm run visual` and `npm run e2e` were not run.

## Stack slice S18 (2026-10-09)

Two one-class `flex-direction: column` rules moved onto `Stack`: 2 rules, 2 JSX sites in 1 file. Base:
`origin/main` at c43e104. Re-measured: 356 column rules (312 in scope), 328 grids; the finder lists 23 safe rows
(the S17 list). The family is the design lab's boxes-inside-cards page (`designlab/nested.css`), which no earlier
slice touched. Open PRs #1815, #1816 and #1820 (their stack) touch none of the files.

| rule | gap | element | rule keeps |
| --- | --- | --- | --- |
| `.nested__case` (`NestedBoxes.jsx`) | snug | section | nothing (deleted) |
| `.nested__pair` (`NestedBoxes.jsx`) | loose | div | nothing (deleted) |

**Cascade.** Neither rule kept a `display`, `flex-direction` or `gap`. The class stays on the Stack as its namespace.

**Test first.** `S18` in `test/stack.test.js`; it failed on both checks, then passed.

**Left.** `.nested__side` (6px, off the steps, keeps `min-width`), `.nested` (32px, the one bespoke step). The other
finder rows are the ones S16 and S17 left, scoring surfaces or Express Lane.

**Checked.** `geom.mjs` (`MOCK=1 FREEZE=1 BLOCKIMG=1`, `?nointro`, 390 and 760px) on `/design-lab`, BEFORE twice
then AFTER: identical, 5,539 elements, heights 68,556 and 47,411; 4 `nested__case` and 4 `nested__pair` drew.

**Not seen.** `npm run visual` and `npm run e2e` were not run.
