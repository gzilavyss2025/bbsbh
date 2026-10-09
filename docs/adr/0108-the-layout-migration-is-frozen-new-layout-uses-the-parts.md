# The layout migration is frozen: new layout uses the parts

**Status:** Accepted
**Date:** 2026-10-09
**Issue:** #1180 (parent), #1655 (Cluster slice), #1179 (layer and width guards); roadmap #1198

## Context

#1180 built three layout parts in `src/components/ui/layout/`: `Stack` (a column), `Cluster`
(a wrapping row) and `Grid` (as many columns as fit a minimum width). The parts are in use,
at about 165 JSX sites.

The census in `.scratch/design-system/layout.md` counted the hand-written layout rules on
`main` before the parts were built (#1180): 367 column rules, 291 grid rules and 160 wrap
rules.

Moving the old rules onto the parts stopped paying back:

- About 114 rules moved in 8 days (slices S1 to S18, C1 to C12, G1 to G2). Source: the
  advisor review of 2026-10-09 (the numbers are its measurement, not re-measured here).
- In the same 8 days, hand-written grids rose from 301 to 328. New features added them.
  Source: the comment in `scripts/layout/check-layout-ratchet.mjs`.
- About 750 rules in scope remained. The finders listed almost no safe rows left.
- The success test is a zero geometry diff. A correct move looks like no change. So the
  migration gives the user nothing they can see.

## Decision

1. **The migration of old layout rules is frozen.**
2. **New layout uses `Stack`, `Cluster` or `Grid`.** Or the rule takes a
   `layout-exempt: <reason>` comment on the line before it.
3. **An old rule moves onto a part only when a PR already edits that rule.**
4. **`scripts/layout/check-layout-ratchet.mjs` is the ratchet.** It counts hand-written
   column, wrap and grid rules per CSS file under `src/styles/` (`system/` is skipped). It
   fails when a count grows. It also fails when a count drops and the budget is not lowered
   in the same PR. The budget is `scripts/layout/layout-ratchet-budget.json`. Run it with
   `--write` to lower it.
5. **Companion decisions, same day:**
   - A layer scale of five z-index tokens: `--z-raised`, `--z-sticky`, `--z-overlay`,
     `--z-modal`, `--z-toast`. `scripts/layout/check-z-index.mjs` rejects a raw number above 3.
   - One wide screen step: 740px. `scripts/layout/check-media-widths.mjs` stops new `@media`
     widths. The other 26 widths are grandfathered. There is no breakpoint sweep.
6. **Left in their own namespace on purpose:** off-step gaps (6, 10, 18 and 20px),
   two-value grids, fixed-count and named-area grids, every scoring surface, and lab and admin
   pages. The scoring surfaces are the scorecard and the box score (#1180, "Not in scope").

## Known limits

- The guards read CSS only. JavaScript media queries are not checked. For example,
  `src/hooks/useMediaQuery.js` uses `(min-width: 1000px)`.
- The z-index guard reads bare integers only. A `calc()` value is not read, so it passes at any
  size. Source: the pattern in `check-z-index.mjs`. (Inferred from the pattern; not tested.)

## Alternatives considered

**Keep migrating.** At the best pace seen, the advisor estimated about 45 more days. That
estimate is an inference. The average pace of 114 rules in 8 days (about 14 a day) gives
about 53 days for 750 rules. New features also add rules, so the count does not fall on its
own.

**Snap the odd gaps to the steps.** Each snap is a visible change. No user gains from it
(#1655 sets the same rule: snap each rule on purpose, or leave it in its own namespace).

## Consequences

- A reviewer checks each new layout rule for a hand-written column, wrap or grid.
- The ratchet budget only goes down. A PR that removes a rule must lower the budget.
- Off-step and two-value layouts keep their own rules. They stay hand-written.
- The team-page rule in #1198 ("no team page work until #1179 and #1180 close") ended on
  2026-10-09. Both issues closed that day.
