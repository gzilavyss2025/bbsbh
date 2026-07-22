Status: needs-triage

# Build a true full-screen page-curl — PR #316 only turns the play-by-play card

## Summary

PR #316 ("Page-turn transition for forward inning navigation") added a curl/wipe
transition (`src/components/page-turn/`) for forward half-inning navigation. It
works, but it's scoped to a single content block — the play-by-play card plus
the stat/WPA row beneath it (`InningPage.jsx`'s render, wrapped by
`InningPageTurn.jsx`'s `.turnscene`). The header, team matchup/logos, date, the
RHE score table, the TOP/BOTTOM inning label, and the Back/Next nav bar all stay
completely static — none of them are part of the animation.

That's a real gap from what "page turn" evokes: a physical book-style curl of
the *entire visible screen*, corner to corner (top-right toward bottom-left),
the way iOS Newsstand/Flipboard-style UIs do it. Confirmed directly with Gary
during UAT of PR #316 — he sketched the expected motion on a screenshot: a curl
starting near the hamburger menu (top-right) and sweeping down through the
score table to the bottom-left, i.e. everything on screen turning as one page.
What's built today only moves the boxed play-by-play card partway down the
screen.

Decision made 2026-07-22: keep the current scoped version as-is (it's correct
and now actually animates — see bugs below), and build the full-screen version
as separate, later work rather than trying to grow PR #316's implementation
into it.

## What already exists (prior art / reusable pieces)

- `src/components/page-turn/pageTurnState.js` — pure state machine (idle →
  preparing → turning → idle), unit tested (`test/page-turn-state.test.js`).
  The eligibility/animate-or-snap logic is content-agnostic and should carry
  over largely as-is.
- `src/components/page-turn/PageCurlOverlay.jsx` — decorative SVG curl
  (curved edge, highlight, self-shadow, contact shadow), driven by WAAPI. The
  geometry would need rework for a full-viewport scale but the layering
  approach (aria-hidden, pointer-events: none, transform/opacity-only
  keyframes, no path morphing) is the right pattern to keep.
- ADR-0024 (`docs/adr/0024-inning-page-turn-preview-is-presentation-only.md`)
  — the spoiler-safety argument (SealBox's own gate, not a second reveal
  boundary; `presentationOnly` only mutes callbacks). A full-screen version
  has a *much bigger* surface of real content mounted in an inert preview —
  re-verify this reasoning still holds once the preview includes the score
  table / RHE grid / lineup references, not just one SealBox.

## Two real bugs found and fixed in the current (scoped) implementation —
## worth knowing before extending this code, since a full-screen rewrite would
## likely inherit the same traps if built from scratch

1. **ResizeObserver's guaranteed initial callback silently killed the
   animation.** `InningPageTurn`'s `onCommit` prop is `InningViewer`'s `goTo`,
   a fresh closure every render → `snapToTarget`'s identity churns every
   render → the `ResizeObserver` effect (keyed on `[snapToTarget]`) tears down
   and re-subscribes on every render a turn causes. `ResizeObserver` fires an
   initial callback right after `.observe()` even with no real resize — so
   the very re-render that flips status to `'turning'` re-subscribed the
   observer, whose immediate callback read `'turning'` and snapped the turn
   before it ever animated. Measured: the curl was mounting for ~20ms instead
   of ~360ms — a same-frame flash, not a transition. Fixed by ignoring each
   observer's guaranteed first callback (see `isInitialCallback` in
   `InningPageTurn.jsx`). **A full-screen rewrite will have the exact same
   `onCommit`-instability problem if it reuses this pattern — either
   memoize the commit callback at the source, or keep the "ignore first
   callback" guard.**
2. **A keyboard-activated Back mid-turn re-committed to the abandoned forward
   target.** CSS already blocks a mouse/touch tap on Back during a turn
   (`[aria-disabled='true'] { pointer-events: none }` in `index.css`) — but
   that CSS can't stop keyboard activation (Tab to the button, press Enter),
   since only the real `disabled` attribute blocks that, and the button never
   gets it (only `aria-disabled`). The external-nav-interrupt effect was
   reusing `snapToTarget`, which unconditionally re-committed onto the
   in-flight turn's original destination — clobbering wherever the
   interrupting nav had just gone. Fixed by splitting "external nav happened,
   just cancel" from "we're aborting on our own, so commit" (see `cancelTurn`
   vs `snapToTarget` in `InningPageTurn.jsx`). Confirmed via a red→green e2e
   test using keyboard activation specifically (`page.keyboard.press('Enter')`
   after `.focus()`) — a plain Playwright `.click()` doesn't reach this path
   at all, since it respects `pointer-events: none` same as a real mouse.

## Testing gotcha worth carrying forward

`npm run e2e` boots real (non-headless-quirked) Chromium via the existing
`playwright.config.js` / `webServer` setup, and animation timing there is
trustworthy once bug #1 above is fixed — a `MutationObserver` + `performance.now()`
probe confirmed the preview mounts for the correct real-world duration. The
PR author's own test-plan note ("could not get a full e2e run in the sandboxed
session... environment limitation") was about data-fetch flakiness in *that*
sandbox, not an inherent inability to test WAAPI timing — don't assume
animation-timing e2e tests are unreliable in general; they're testable, just
watch for effect-identity churn like bug #1 breaking them silently.

## What a full-screen version needs to solve (why this isn't a small extension of PR #316)

- **What's actually "the page."** Today's `.turnscene` wraps one component's
  output. A full-screen curl needs to decide what surface curls: the whole
  route view? Everything below the fixed header? Does the header/team-matchup
  bar move with it or stay pinned like a book's spine?
- **The floating nav bar's z-index guarantee.** `index.css` currently keeps
  `.turnscene` explicitly *below* `.pagenav`'s `z-index: 20` "so the floating
  bar must never be covered by an in-flight turn" — a full-screen curl
  fundamentally wants to cover everything, including nav. Needs a deliberate
  call: does nav hide/freeze for the turn's duration, or does it float above
  the curl the whole time (breaking the illusion of a full page turning)?
- **Where the header/score-table live in the component tree.** They're likely
  owned by a layout above `InningViewer` (check `GameView.jsx`), not by
  `InningViewer` itself — wrapping them in the same turn means either lifting
  the turn mechanism up a layer or passing a lot more through `renderPage`.
- **Spoiler-safety surface area grows a lot.** The inert preview would now
  contain the RHE score grid, RollingLine, and lineup/defense reference cards
  — all real, possibly-sealed content — not just one `SealBox`. ADR-0024's
  argument (SealBox's own gate is sufficient, no second reveal boundary
  needed) should still hold, but it deserves re-verification given the much
  larger surface, and probably a dedicated e2e spoiler-invariant test the way
  `e2e/innings-page-turn.spec.js` already has one scoped to the current card.
- **Height/geometry cap.** `MAX_SCENE_HEIGHT_PX` (3000px) exists because a
  tall scene "makes a full-height rotate/clip animation look wrong and costs
  more to composite." A true full-screen curl is naturally viewport-height,
  not content-height, which may simplify this — but the phone-first layout is
  scrollable, so "full screen" still needs a firm definition of what's
  visible/curling vs. what's off-screen.
- **Backward navigation.** Currently backward never animates (deliberate,
  simpler). Decide up front whether the full-screen version mirrors the curl
  in reverse for Back, or keeps that asymmetry.

Recommend a `/grilling` pass on this before implementation — there are several
non-obvious design forks above (nav-during-turn, what counts as "the page,"
backward-curl-or-not) that should be decided deliberately rather than emerge
ad hoc.

## Comments
