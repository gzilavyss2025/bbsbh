# Stamped cards stack in a Stack, never on sibling margins

**Status:** Accepted (Gary, 2026-11-09).
**Date:** 2026-11-09

## Context

A named stamped card (`Card frame="stamped" label=…`) hangs its name tab 14px
(`--space-3h`) above its own top edge (`styles/system/stamped/stamped.css`). To clear
the tab, `.card--named` takes `margin-top: var(--space-3h)` (`styles/system/card.css`):
exactly the tab's height, with no spare air. The air above the tab has to come from
whatever spaces the cards apart.

The Pressure Moments page (`/pressure-moments`) spaced its three cards with a sibling
`margin-block-end: var(--space-3)` (12px). Vertical margins between block siblings
**collapse**: the 12px and the next card's 14px became one 14px gap, not 26px. The tab
filled all of it, and the card above's 4px hard shadow (`--shadow-stamped`) ran into the
tab too. The cards read as touching. Gary caught it from a screenshot (#3015).

A `Stack` is a flex column. Margins inside a flex container do not collapse, so the
Stack's gap is added to the tab's 14px clearance and the cards always have air. That is
why the pages built on `Stack` never showed this.

The rendered check for this bug class, `e2e/tab-clearance.spec.js`, already existed,
but it visits a hand-picked list of routes and `/pressure-moments` was not on it.
`scripts/layout/check-card-fill.mjs` catches a different cause (percent heights).

## Decision

1. **Stamped cards that sit one after another stack in a `Stack`**
   (`components/ui/layout/Stack.jsx`), `gap="loose"` or wider. A page never spaces
   stamped cards with its own `margin` between siblings in normal flow.
2. **A page whose layout a Stack cannot express** (a grid of cards) uses `gap` on its own
   grid or flex container, never sibling margins, for the same reason: no collapse.
3. **A page that adds stamped cards adds its route to `e2e/tab-clearance.spec.js`.**
   `/pressure-moments` is added with this ADR.

## Consequences

- The Pressure Moments page now stacks its cards in `<Stack gap="loose">` and its
  stylesheet sets no margin on them.
- Other pages may still space stamped cards on sibling margins; they were not swept with
  this ADR. Running the tab-clearance geometry (`e2e/lib/tabClearance.js`) over every
  route in `src/lib/reportPages.js` would find them. A route list derived from
  `reportPages.js` instead of a hand-picked one would keep new report pages covered.
