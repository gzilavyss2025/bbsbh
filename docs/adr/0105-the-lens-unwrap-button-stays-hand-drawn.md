# The Lens Unwrap button stays hand-drawn

**Status:** Accepted
**Date:** 2026-10-07
**Issue:** #1467 (source: PR #1423, PR #1427; related #724)

## Context

`src/CLAUDE.md` says "one control, one door": a button that acts on the page is
`Button`. The Lens bar's **Unwrap** control is a hand-drawn `<button>`
(`.sc-lensbar__unwrap`). It cannot move to `Button` without a `seal` skin, and that
skin is scoped to the Game Log mint strip. Kraft is a guarded meaning: it promises
that a tap lifts a seal (ADR-0083, `scripts/check-seal-scope.mjs`).

## Decision

1. **Keep the hand-drawn button.** Gary decided this on 2026-10-06 (comment on #1467).
   `Button` gets no new seal skin and the seal-scope allowlist does not grow.
2. **This is the one recorded exception to "one control, one door".** It applies to
   `.sc-lensbar__unwrap` only. Any other hand-drawn control is still a bug.
3. **Why.** Unwrap lifts the same seal as the frame (ADR-0092). A second home for the
   kraft look would widen a guarded meaning for one caller. The exception costs one
   class and one comment. The skin would cost a guard change.
4. **No spoiler change.** The look of the control never depends on the sealed result
   (ADR-0046). The label comes from `useLensBar`, not from the feed.

## Consequences

- `LensBar.jsx` and `lens-bar.css` point at this ADR beside the button.
- If a second control must wear kraft outside the mint strip, revisit this ADR and
  give `Button` the skin then.
