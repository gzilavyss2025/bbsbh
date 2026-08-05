# Site search is a keyboard-aware full-screen surface, not a bottom sheet

Every other dialog in this app is the same shape: a `.scrim` backdrop with a
`.sheet` docked to the bottom of the screen — GameFinderModal, SiteMenuModal,
HighlightSheet, BallparkModal. Site search used to be one too. It shouldn't be,
and the reason is mechanical rather than aesthetic, so it needs writing down
before someone folds it back in for consistency.

## The bug

`.scrim` is `position: fixed; inset: 0` and `.sheet` docks to its bottom edge.
Fixed positioning resolves against the **layout viewport**, and an on-screen
keyboard does not shrink the layout viewport — it covers it. So the instant the
search field took focus, which is the entire purpose of the surface and happens
automatically on open, the keyboard slid up over the bottom ~40% of the screen
and the sheet was underneath it: the field, the hint, and every result mounted,
focused, and invisible. You typed blind into a box you could not see.

This is not a `max-height` that needs raising. A bottom-docked surface is
anchored to the one edge the keyboard always takes. Every mobile search that
works — Safari, the App Store, Maps, Spotlight — puts the field at the **top**
and grows results downward, so the keyboard can only ever cover the tail of a
scrollable list.

## The decision

`SiteSearchModal` is a full-screen surface with the field pinned to the top
(`.searchoverlay` in `index.css`). Three mechanisms carry it; none is decoration.

- **`useVisualViewport` sizes the overlay to the visible rectangle.**
  `window.visualViewport` is the only API that reports where the keyboard
  starts. No CSS unit does — `100dvh` tracks *retractable browser chrome* (the
  URL bar), not the keyboard, and is the near-miss most likely to be reached
  for. The hook writes `height` and a `translateY(offsetTop)` inline; the
  `offsetTop` half matters when the browser has scrolled the page to reveal a
  focused field, which would otherwise slide the overlay off its own viewport.
  It returns `null` where `visualViewport` is unsupported, and the CSS falls
  back to `100dvh` — a desktop browser, where there is no keyboard to work
  around anyway.

- **The document is scroll-locked while the surface is open**, via plain
  `overflow: hidden` on `<html>`/`<body>` rather than the position-fixed-body
  trick, because that one leaves the page's scroll offset alone and closing the
  search puts you back exactly where you were. `overscroll-behavior: contain` on
  the results list is the other half: a flick past the end of the list stops
  there instead of chaining into the page behind.

- **A result row cancels its own `pointerdown`.** Without that, the press blurs
  the input, the keyboard retracts, the layout grows by ~300px, and the release
  lands on whatever row slid up under the finger. That is the worst class of
  mobile bug, because it opens the *wrong* player and reads to the user as their
  own mis-tap. The clear button cancels its press for the same reason — clearing
  the box should leave you typing, not dismiss the keyboard.

Everything else about the app's dialog contract is kept: Escape closes, a
backdrop tap closes (on the wide layout, which has a backdrop), focus moves to
the field on open and back to the trigger on close.

## Three things that follow from it

- **It is not rendered through `ModalPortal`.** Both hosts (`SiteHeader`, the
  slate topbar) are already in the root stacking context, so it doesn't need
  one — and the ALL-CAPS invariant is a `#root *` rule, so a portal to `<body>`
  would land the whole surface outside it and silently break the app's casing,
  the same way Clerk's portals do (see the note in `index.css`).

- **`--fs-field: 16px` exists for this.** Mobile Safari zooms the page in on a
  focused field whose text is under 16px, which throws the layout off centre and
  leaves the user pinch-zooming back out. The app's body size is 15px, so a
  field cannot simply consume `--fs-body`; 16px is a floor, not a taste call,
  and the token says so.

- **The wide layout is a different shape, deliberately.** Above 560px there is
  no keyboard eating the viewport, so a full-bleed surface would read as a page
  takeover. The same panel floats near the top over a dimmed page — a
  command-palette shape — with the backdrop tap the phone layout has no room
  for.

## What else changed while the surface was being rebuilt

Two of these are what make the screen useful rather than merely visible, and one
is the reason a new pure module exists:

- **Clubs answer the live query; people answer the debounced one.** The club
  directory is fetched once per session and filtered in memory, so there is no
  request to spare and waiting 180ms to filter an array already in hand just
  makes the screen feel slower than the thumb driving it. Clubs also sort first
  when the query starts a *word* of a club's name ("brew", "iron") — per word,
  not per name, because clubs are stored city-first and nobody types the city.

- **Results persist through the next request** instead of blanking to a spinner.
  Typing a name is a series of near-identical queries; a list that empties and
  refills on every keystroke reads as the app losing its place. A scanning
  hairline under the field says "still working" without moving the list.

- **A recents shelf** (`src/lib/recentSearches.js`, `useRecentSearches`) so the
  screen has something on it before you type. It is pure, unit-tested, and
  shape-gated on the way in *and* out: an entry is a kind, an id, a name and the
  subtitle already shown on that row — the identity-only fields `api/search.js`
  is limited to. It cannot hold a score, a date, or a game, which is what makes
  it safe to persist next to a spoiler-sealed app. Anything else in the stored
  value is dropped rather than rendered.

`e2e/site-search.spec.js` is the runtime guard. Playwright cannot raise a real
keyboard, so it asserts the two properties that would actually have caught the
original bug: the field is anchored in the top quarter of the surface, and the
overlay follows the visible viewport when it shrinks.
