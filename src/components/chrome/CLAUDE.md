# src/components/chrome — the site frame and site search (ADR-0037)

`SiteSearchModal` (`components/chrome/SiteSearch.jsx`) is a full-screen, top-anchored
surface (`.searchoverlay`), **not** the shared `.scrim`/`.sheet` bottom sheet
every other dialog here uses. Not a style choice: a docked sheet is positioned
against the layout viewport, which an on-screen keyboard does not shrink, so the
field and every result sat behind the keyboard the moment the field auto-focused.
Read ADR-0037 before consolidating it back. Three things there are load-bearing —
`useVisualViewport` sizing the overlay to the visible rectangle (no CSS unit
reports where a keyboard starts; `100dvh` tracks browser chrome, not the
keyboard), the document scroll lock, and a result row cancelling its own
`pointerdown` so the keyboard can't retract mid-tap and reflow a different row
under the finger. It is deliberately **not** portalled: the ALL-CAPS invariant is
a `#root *` rule, and a portal to `<body>` lands outside it. `--fs-field` (16px)
is the iOS auto-zoom floor, not a taste call. The recents shelf is pure and
shape-gated in `lib/recentSearches.js` (identity fields only, never a score) with
`hooks/useRecentSearches.js` over it; `e2e/site-search.spec.js` is the guard.

## Bucket notes

`BackBtn` sits here rather than in `ui/` because it's page furniture that knows about route history, not a context-free primitive. `FooterParts` holds the two blocks both footers end with (the grouped directory, the legal blurb) — the page LIST is passed in as a prop, so each footer keeps its own `lib/reportPages.js` import and `check-report-pages.mjs` keeps guarding both
