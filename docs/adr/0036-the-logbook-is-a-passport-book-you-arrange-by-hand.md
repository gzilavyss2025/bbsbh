# ADR-0036 — The Logbook is a passport book you arrange by hand

Status: accepted (2026-08-04)

## Context

ADR-0035 established the Logbook: a stamp is a score-bearing keepsake, mintable
only for a game its owner already finished revealing, and that gate is enforced
server-side on every mint. What it did not settle is what the collection *looks*
like. The first implementation was a responsive grid — correct, and inert. A
grid is a list of things you own; it is not a thing you keep.

The redesign makes the Logbook a **passport book**: cream pages under a
club-coloured cover, and you choose where each stamp lands by tapping the page.
That single interaction is the whole point. A grid arranges itself; a passport
is arranged, and the arrangement is the artifact — which page a game went on,
whether it sits beside the game before it, how crooked it came out.

Three things had to be decided to build it.

## Decision

### 1. A placement is a page and two fractions, and it syncs

A stamp record gains `placement: { page, x, y, tilt } | null`.

**x and y are FRACTIONS of the page box** (0..1, marking the stamp's centre),
never pixels. A pixel is a fact about the screen it was placed on; the book has
to read correctly on a 390px phone page and a two-page desktop spread, and — the
harder case — it has to mean the same thing on both of a user's devices. Tilt is
degrees, stored rather than derived, so a future change to the tilt function
cannot silently rotate a book somebody already arranged.

**It syncs, through the existing channel.** Placement rides the same per-gamePk
last-write-wins merge on `updatedAt` that a note edit does; there is no second
sync path and no separate key. The book is part of the collection, not a view
preference over it.

What that adds to the per-user record is a page number and two fractions.
Nothing score-bearing — so the record stays on exactly the footing ADR-0035
established, and a hostile client that forges one has moved a picture, not
minted a score. **The reveal gate is untouched by any of this**: placement is
where a stamp sits, never whether you may have it.

**`null` means minted-but-not-placed.** An unplaced stamp waits in the book's
tray. This is what makes it safe to split minting from placing (§3): not
finishing the placement step can never cost you the keepsake.

### 2. Geometry lives in one pure module

`src/lib/passportLayout.js` owns every number the book draws with — page
capacity, aspect, margins, the tilt range, the collision separation, the
deterministic per-game tilt, the nudge-off-a-collision search, and the
auto-layout used by "place them all for me". It is pure and unit-tested
(`test/passport-layout.test.js`); the components under
`src/components/passport/` import from it rather than restating a number.

This is the same lesson `src/api/logbookStats.js` was written for and
`FirstScorebookPage.jsx` is the counter-example to: a number tuned by eye inside
JSX is a number nothing can check. Two of these in particular would be invisible
bugs — the vertical clamp must use the stamp's height *as a fraction of the
page*, not its width (the page is not square), and the tilt must be a hash of
the gamePk rather than its low digits, or a whole homestand tilts the same way.

`src/lib/stamps.js` deliberately does **not** import that module. It is bundled
into the serverless function, so it restates only the *bounds* it must validate
(`MAX_PLACEMENT_PAGE`, `MAX_PLACEMENT_TILT`) — the same reasoning that keeps
`halfIndexOf` restated there rather than imported from the selector layer.

### 3. Minting and placing are two steps

Tapping "Stamp this game" in the box score mints, as before, inside the
`SealBox` reveal render function where ADR-0035's client-side safety argument
lives. It then offers **"Place it in your book →"**, which opens
`/logbook?place={gamePk}`.

The alternative — opening the passport page inline under the box score — was
rejected for a specific reason: it would render a page of *other games'* stamps
inside a game screen. Every one of those is a game the user revealed, so it
would not be a spoiler; it would be a large new surface area on the one screen
whose containment argument is load-bearing, for no gain over a two-step flow
that also survives being abandoned halfway.

`?place=` is a **query, not a route name**. It is a transient mode of the book —
you leave it by placing the stamp or cancelling — not an address worth sharing,
and a stale link to it degrades to the plain book.

## Consequences

- **`scripts/check-stamp-surfaces.mjs`'s allowlist gains exactly one name**,
  `components/passport/PassportPage.jsx`. That guard is ADR-0035's containment
  argument in executable form, so widening it is a spoiler-rule decision. It is
  justified here on the same grounds as `LogbookPage.jsx`: a passport page's
  entire input is this user's own collection (`useStamps`), never a schedule,
  never a slate, never a game list of any other provenance. **The stats page
  (`/logbook/stats`) is deliberately NOT on the list** — it renders no stamp
  art, so it never needed to be, and it stays off.
- **Four projections build a stamp record field by field**, and every one of
  them silently drops a field it does not name: `addStamp`, the mint entry in
  `api/stamps.js`, `seasonRows` (the sync payload), and `StampsCloudSync`'s
  remote merge. A fifth field added later must update all four. Two shared
  rules: editing a note must not knock a stamp off its page, and reviving a
  tombstone starts unplaced.
- **The sync diff must compare placements structurally.** `StampsCloudSync`
  diffs records to decide what to publish; comparing placement by reference
  would republish the whole collection on every merge. `samePlacement` is that
  comparison, and it is why placements are rounded on normalize — a float that
  drifts by an epsilon through JSON would read as a change forever.
- **A book that predates this feature is not made to re-place forty keepsakes.**
  Everything arrives unplaced, in the tray, with one control that auto-lays-out
  the lot. Auto-layout is deliberately not a grid — it lays out on a two-column
  rhythm and then breaks the alignment with each stamp's own deterministic
  wobble, so an auto-filled page still reads as stamped rather than printed.
- **The cover is the user's favourite club, through existing machinery.**
  `useFavoriteTeam` (localStorage `bbsbh:favoriteTeam`, defaulting to the pinned
  Brewers) and the ADR-0031 precomputed mono knockouts. No new preference, no
  new art pipeline, and a club with no mono mark degrades rather than showing a
  broken image.
- **Page count is a local view preference, not synced.** How many blank pages
  you have added past your last stamp is not part of the collection; the book
  shows enough pages for every placement it holds, at least one, and at least
  whatever this device has added.
- **Reduced motion is honoured** — the page-turn is skipped, not slowed.

## Addendum (2026-08-05) — a placement can be changed

An arrangement you cannot correct is not an arrangement, so a placed stamp can
be picked up and put somewhere else. Three notes, because each is a place the
obvious implementation goes wrong:

- **A move is the placing flow, not a second one.** `placeStamp` was already a
  move as much as a first placement (§1), so what a move adds is only what the
  user can see: the old spot fades while you choose, and the stamp is left out
  of both the collision search and the page-capacity check on the page it is
  leaving (`otherPlacementsOn` / `pageIsFullFor`, in the geometry module per §2,
  not in JSX). Without the first, every small correction is shoved a stamp-width
  away by the very stamp being corrected; without the second, a full page
  refuses to take back a keepsake already sitting on it.
- **Tapping a stamp in the book opens its options rather than its game.** All
  three things you can do with a placed keepsake — open it, move it, send it
  back to the tray — hang off one bar, in the slot the placing bar already
  occupies. The cost is one extra tap to reach a game from the book; the grid
  below still opens one directly. The grid's `p.{n}` control, which used to
  silently un-place, now turns the book to that page and opens the same bar.
- **A confirmed stamp presses onto the page** (`passport-stamp-land`): held
  above the paper off its own angle, accelerating down — `--ease-press`, the
  only ease-IN in the system, because a stamp is *pushed* rather than arriving —
  compressing 4% on impact, releasing to rest, over `--dur-slow`. transform and
  opacity only, so `GameStamp`'s turbulence filter never re-rasterises
  mid-flight. Skipped rather than slowed under reduced motion, and deliberately
  not fired by "place them all for me": a pageful at once is a flurry, not a
  stamping.

**A bug this uncovered, in the seam rather than in the book.** Placing a stamp
persisted the placement and left the book looking untouched until a reload.
`useStamps`'s `commit` writes inside its state updater — which React runs at
render time — but dispatches its same-tab echo synchronously, so the listener's
eager `readStamps()` ran BEFORE the write and queued the pre-change collection
behind the change. Reading from inside the updater orders the two correctly. It
predates this addendum and affected every mutation made on `/logbook`. No unit
test could have caught it, because the store and the geometry were each already
right; `e2e/logbook-passport.spec.js` now pins that a placement repaints the
book it was made in.

## Addendum (2026-08-05) — the page is ruled, and the ink is the winner's

Two changes to what a page looks like. Neither touches the reveal gate, the
store, or the sync payload: a placement is still `{ page, x, y, tilt }` and a
stamp still only exists for a game its owner already revealed.

### The page shows its eight boxes

A blank cream page gives no answer to "where does this go, and how many fit?",
so the paper is now **ruled into eight faint boxes, two across and four down**,
and a stamp goes in one. Three things about that:

- **It is a guide, not a snap.** The tap is still the instruction, still nudged
  only off a genuine collision. The alternative below — snapping to slots — is
  still rejected for the reason it always was; drawing the boxes gets the
  legibility a grid would have bought without giving up the arrangement.
- **Capacity is derived from the grid, not typed beside it.** `PAGE_CAPACITY`
  is `PAGE_COLUMNS * PAGE_ROWS`, and `pageSlots()` in `passportLayout.js` is the
  one statement of where the boxes are — the guide the user sees, the boxes
  "place them all for me" fills, and the number a full page reports are one
  piece of geometry. §2's rule, applied to a number that is now on screen.
- **Two by four, because the stamp has to FIT ITS BOX** — a guide that promises
  a box the art overflows is worse than no guide. At `STAMP_WIDTH` 0.3 on a
  0.704-aspect page, a 2x4 cell is 0.44 x 0.22 against a 0.3 x 0.211 stamp;
  3x3 is narrower than the stamp, and 2x5 is both shorter than it and inside
  `MIN_SEPARATION` down the page. The arithmetic is in the constant's header
  and pinned by `test/passport-layout.test.js`.

Capacity therefore drops from nine to eight. **Nothing is un-placed by that** —
a page of an older book that already holds nine keeps all nine; `pageIsFull`
simply answers true for it until one is moved off. Auto-layout now fills the
boxes rather than a rhythm of its own, wobbling each stamp inside its own box
(`clampToSlot`) so a filled page still reads as stamped rather than printed.
The separate dashed margin guide drawn while placing was absorbed: the grid's
outer edge IS that margin, and two dashed rules on one line was one too many.

### A stamp is pressed in the winner's ink

Every stamp was navy. They are now drawn in **the winning club's darkest brand
colour** — `src/lib/stampInk.js`, the one module in `src/lib/` that colours
something from game state.

That is a deliberate, contained exception to the rule at the end of
`src/lib/CLAUDE.md` ("theming's only inputs are `teamId` and `treatment`"), and
it is safe for the same structural reason the rest of the stamp is: its only
caller is the art, and the art may only render where `check-stamp-surfaces.mjs`
allows — surfaces where every game shown is one this user already finished
revealing. The ink says who won a game whose score is printed in numerals two
lines below it. **Do not import that module anywhere else.**

- **Darkest, not primary.** The mark is one colour at hairline weights on cream
  paper, so the colour has to work as ink — which a club's gold, sky blue or
  powder blue does not. Every club owns something dark, and the darkest thing it
  owns is both unmistakably its own and legible. "Darkest" is a luminance
  question; reading it off the hex digits gets yellow badly wrong, so it goes
  through `relativeLuminance` (now exported from `lib/contrast.js`).
- **With a floor under it.** Ink that misses 4.5:1 against the page's paper is
  walked toward black by scaling all three channels — which keeps the hue —
  until it reads. Exactly one club in either league needs it today (Rocket
  City's `#3378c2`, at 4.22); it exists for the affiliate whose researched pair
  is a pastel, not for the 30.
- **No winner means no ink.** A tie, a suspended game, facts that never
  resolved, a club with no colour on file: `null`, and the stamp keeps the
  book's default navy. It is published as `--stamp-ink` rather than a `color`,
  so a surface with its own opinion still wins — which is how the mint card's
  un-minted preview stays graphite.

## Alternatives considered

- **Snap placement to a fixed grid of ten slots.** Rejected: only a slot index
  would need storing, and it could never overlap — but it is a grid with extra
  steps, and the arrangement stops being the artifact. (Still rejected after the
  2026-08-05 addendum: the page now DRAWS its boxes, but a tap still lands where
  it was aimed.)
- **Ink the stamp in the winner's primary brand colour.** Rejected: it is the
  more obvious reading of "the winner's colours" and it produces gold, orange
  and powder-blue stamps that don't read as ink at hairline weights on cream.
  Darkest-with-a-floor keeps the club and keeps the metaphor.
- **Keep placement local-only.** Rejected: it is cheap (a number and two
  fractions on a record that already syncs), and a book that looks different on
  your laptop is not your book.
- **Store pixels and scale on read.** Rejected: it needs the page size that was
  in effect at placement time, which is a second thing to store and to keep
  honest across a phone, a spread, and a future print stylesheet.
- **Reuse the innings page-turn (ADR-0024) wholesale.** Its transition is
  entangled with reveal semantics — an inert preview of possibly-sealed content,
  a `presentationOnly` flag that exists to stop a preview ratcheting
  `revealedThrough`. A book has no seal and nothing to ratchet, so borrowing that
  machinery would mean carrying its constraints for none of its reasons.
