# src/components/passport — the Logbook's passport book (ADR-0036)

`/logbook` is a passport book: a club-coloured cover, cream pages, and stamps
you place by tapping the page. Three rules, each with a reason:

- **Geometry lives in `src/lib/passportLayout.js`**, not in these components.
  Capacity, page aspect, margins, the deterministic per-game tilt, the
  collision nudge and the auto-layout are all pure and unit-tested
  (`test/passport-layout.test.js`). A component that types a coordinate has put
  it somewhere nothing can check. Two conversions in that module are easy to
  invert and one already was: a y-fraction converts to width-units by
  **dividing** by `PAGE_ASPECT`, while a stamp's width-fraction converts to a
  height-fraction by **multiplying**.
- **A placement is `{ bookId, page, x, y, tilt }` with x/y as FRACTIONS**,
  stored on the stamp record and synced (`src/lib/stamps.js`). Pixels would be
  a fact about one screen; the same book has to render on a phone page and a
  desktop spread, and on both of one user's devices. A book is separate
  metadata (`src/lib/books.js` + `hooks/useBooks.js`) never holding the
  collection itself — every device always has at least one (`DEFAULT_BOOK_ID`),
  so `/logbook` opens it directly for as long as it's the only one; two or more
  surface `LogbookShelf.jsx` instead. `passportLayout.js` needed no bookId
  awareness at all — every function there already took a `stamps` array, and
  the caller pre-filters it to one book first. ADR-0041.
- **Minting and placing are separate.** The mint stays in the box score's
  `SealBox` (ADR-0035); placing happens here via `?place={gamePk}`. An unplaced
  stamp waits in the book's tray, so abandoning the flow never loses a keepsake.
- **A placement is editable, and a move IS the placing flow.** Tapping a placed
  stamp opens its options bar (open the game, move it, back to the tray) instead
  of navigating; "Move it" re-enters placing mode on a stamp that already has a
  placement. `placeStamp` was always a move as much as a first placement, so the
  only things a move adds are `otherPlacementsOn`/`pageIsFullFor` in
  `passportLayout.js` — the stamp must not collide with, or be counted against,
  its OWN current spot. Do not build a second placement path.
- **One thing in this book moves on its own**: the stamp you just confirmed
  plays `passport-stamp-land` once — held above the paper, accelerating down
  (`--ease-press`, the system's only ease-IN, because a stamp is *pushed*),
  compressing 4% on impact, releasing to rest. Cleared by `animationend` so the
  duration lives in the CSS alone, skipped rather than slowed under reduced
  motion, and deliberately NOT fired by "place them all for me".
- **The page is RULED into eight boxes** (`pageSlots()`, 2 across × 4 down),
  drawn faintly so a blank page says where a stamp goes; it comes up while
  placing and settles back after. `PAGE_CAPACITY` is `PAGE_COLUMNS * PAGE_ROWS`
  and auto-layout fills those same boxes, so the guide, the tidy-up and "this
  page holds 8" cannot disagree. It is a **guide, not a snap** — the tap still
  decides (ADR-0036 rejected snapping and still does). The grid also absorbed
  the dashed margin guide that used to be drawn on the tap target.
- **A stamp is pressed in the winner's ink** — `lib/stampInk.js`, published as
  `--stamp-ink` so any rule that sets `color` outright still wins (the mint
  card's un-minted preview stays graphite). No winner, or a club with no colour
  on file, means no property and the book's own navy.

`PassportPage.jsx` is on the `GameStamp.jsx` allowlist in
`scripts/check-stamp-surfaces.mjs`. That list holds six names: `StampGameButton.jsx`,
`LogbookCollection.jsx`, `StampCollection.jsx`, `PassportPage.jsx`,
`StampPlacementEditor.jsx`, and `IdentityStampPreview.jsx`. `PassportPage.jsx` earned its
place because a page's entire input is the user's own collection. `/logbook/stats` renders
no stamp art and stays off it. Read ADR-0036 before adding a name; the multi-book split
(ADR-0041) renamed the `LogbookPage.jsx` entry to `LogbookCollection.jsx` rather than
adding one, and `StampCollection.jsx` joined it the same way (read that script).
`LogbookShelf.jsx`/`BookManagementSheet.jsx` draw no stamp art.
