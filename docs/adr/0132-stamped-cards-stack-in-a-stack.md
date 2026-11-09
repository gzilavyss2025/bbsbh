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
3. **The rendered check covers every menu page.** `e2e/tab-clearance.spec.js` builds its
   route list from the site menu (`src/lib/reportPages.js`), plus home, team and player, so a
   new report page is checked with no extra step (#3016). A stamped-card page that is not in the
   menu adds its route to the spec by hand.

## Consequences

- The Pressure Moments page now stacks its cards in `<Stack gap="loose">` and its
  stylesheet sets no margin on them: 18px of air above each tab, where it was 0.
- A sweep of all 49 menu pages, plus home, team and player, at 390 and 1280 wide, with the
  tab-clearance geometry (`e2e/lib/tabClearance.js`) found one other page with the same
  cause: `/infield`, fixed the same way in #3016. The sweep covers what rendered in the
  container; a card that needs live data that did not load would not have been checked.
