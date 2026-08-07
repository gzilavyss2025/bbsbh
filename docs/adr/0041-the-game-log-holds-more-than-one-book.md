# ADR-0041: The Game Log holds more than one book

## Status

Accepted.

## Context

ADR-0036 gave the Game Log a single passport book: one cover, one spread of
pages, spanning a user's whole stamp collection continuously across seasons.
That was correct for the feature's first shape, but "one book, forever" was
never a spoiler-safety requirement or a storage constraint — it was simply
the smallest version that shipped. Some users want to keep separate keepsakes
apart from each other (a season's book distinct from a road-trip book, a
kid's book distinct from a parent's), and the cover itself — one fixed title,
one colour drawn from the user's favourite club — offered no way to tell two
books apart even if a user tried to keep more than one collection by hand
(they couldn't; there was only ever the one).

This ADR covers three additive changes shipped together: multiple named
books, a customisable cover (title, subtitle, and cover club) on each one,
and a tightened page margin. The margin change is unrelated in mechanism but
shipped in the same pass; it is noted at the end for completeness.

## Decision

### A book is a cover, not a collection

`src/lib/books.js` stores `{ id, state, title, subtitle, coverTeamId,
createdAt, updatedAt }` — a book is metadata about a shelf slot, never the
stamps filed in it. The stamps themselves stay exactly where ADR-0035 put
them, in `src/lib/stamps.js`'s per-gamePk records; each stamp's `placement`
(page, x, y, tilt) grew one more field, `bookId`, naming which book the stamp
is filed in. Two consequences follow from keeping these separate:

- A book can be renamed, re-coloured, or removed without touching a single
  stamp record.
- `src/lib/passportLayout.js` — capacity, margins, collision, auto-layout —
  needed **no changes for multi-book support at all** (the margin tightening
  below is unrelated). Every function there already took a `stamps` array as
  input rather than the whole collection; the caller now pre-filters that
  array to one book's stamps before calling in, and the module stays exactly
  as ignorant of "book" as it always was of "season." This is the same
  reason `stamps.js` stays ignorant of pages and `passportLayout.js` stays
  ignorant of scores — each module owns one axis of the record and trusts
  its caller to have already resolved every other one.

### Every pre-existing collection lands in one book, unconditionally

`src/hooks/useBooks.js` synthesises a book with id `DEFAULT_BOOK_ID`
(`'default'`) the first time it ever mounts and finds none — not "if the
user already has stamps," unconditionally, for every device including a
brand new one. Two things this buys:

- **There is no "zero books" state anywhere downstream.** No component has
  to render a shelf with nothing on it, or ask a first-time visitor to name
  a book before they can use the feature at all.
- **Every stamp minted before this feature shipped already resolves
  correctly.** `normalizePlacement` (`src/lib/stamps.js`) defaults a missing
  or invalid `bookId` to `DEFAULT_BOOK_ID`, so an old placement round-trips
  straight into the one book that is guaranteed to exist, with no migration
  script and no explicit backfill pass.

### The bare route branches on book count; every other route is frozen

`docs/game-log.md` already treats `/logbook`'s address as permanent — shared
links, bookmarks, and a cached Open Graph card all outlive any redirect this
app would plausibly maintain. Multiple books had to add real estate to that
address space without breaking anything already sent to someone.

- **`/logbook` and `/logbook/{season}` are unchanged, byte for byte, in
  `parseRoute`.** They always resolve to `DEFAULT_BOOK_ID`'s content — which
  is where every pre-existing stamp already lives — so a season link sent
  before this feature shipped keeps meaning exactly what it meant the day it
  was sent.
- **The one behaviour change lives in the bare route's RENDERER, not its
  parser.** `/logbook` with exactly one live book opens that book directly,
  identically to today, for as long as a user never creates a second one —
  which will be true of most users for a long time. Two or more live books
  is what surfaces the shelf. The route itself never encodes this; `route.js`
  hands back the same `{ name: 'logbook', season: null }` shape it always
  did, and `LogbookPage.jsx`'s resolver (`LogbookRoot`) is what looks at
  `books.length` to decide what to draw.
- **`/logbook/book/{bookId}[/{season}|/stats]` is new and purely additive**
  — the only way to deep-link or bookmark a specific non-default book. It
  did not replace or rename anything; it filled in address space the app
  never used before.

### The tray is book-agnostic; placing a stamp is what assigns its book

A freshly minted stamp has `placement: null` and therefore no `bookId` at
all — it does not belong to any book until it is placed. This was a
deliberate choice over pre-assigning a book at mint time: minting already
happens deep inside the box score's `SealBox` (ADR-0035), and asking "which
book?" there would be a second decision competing with the one the mint
strip is built to stay thin around (`src/CLAUDE.md`'s stamp-strip section).
Instead, the tray shows inside whichever book is currently open, and the
same tap that places a stamp on a page is the tap that decides its book —
one motion, matching the physical metaphor of pressing a loose stamp into a
specific book you already have open, rather than sorting it beforehand.

### The last book cannot be removed, and that policy lives in the UI, not the store

`src/lib/books.js`'s `removeBook` will happily tombstone the very last live
book if asked — the pure store has no opinion about product policy. The
refusal ("you cannot remove your only book") is enforced by the UI layer
that offers the affordance, the same split ADR-0035 already draws between
`stamps.js` (which enforces no permission at all) and the surfaces that
decide when its functions may be called. Keeping the refusal out of the pure
module means a future UI decision about *when* removal should be blocked
doesn't require touching code that is bundled, unit-tested, and reused
verbatim elsewhere.

### Sync gets a fourth channel, on the same footing as the third

`api/books.js` mirrors `api/spoiled-days.js`'s shape — one Redis hash per
user, states of `'on'`/`'off'`, last-write-wins per id on `updatedAt` — not
`api/stamps.js`'s shape, because a book carries no score and needs no
per-season sharding: a user holds at most `MAX_BOOKS` (20) of them, ever.
`BooksCloudSync.jsx` is the client half, registered as the `books` sync
channel in `src/lib/account/syncStatus.js` alongside `reveal`, `spoiledDays`,
`stamps`, and `prefs`. It removability-syncs the same way stamps do
(ADR-0035's amendment): a plain union merge would silently resurrect a book
a user just removed on another device, so a removal publishes as an
explicit `'off'` and the two sides reconcile on `updatedAt`.

### The cover's colour source generalises from "your favourite club" to "any club, or none"

`PassportCover.jsx` already resolved a cover's ink/foil pair through
`teamChipColors`, which was always safe for an arbitrary club id — the WCAG
contrast argument in that file's header (ADR-0036) never depended on the id
being the user's *favourite* club specifically. Letting a book's
`coverTeamId` name any club therefore needed no new colour logic: a book
with no override (`coverTeamId: null`) falls back to exactly today's
`useFavoriteTeam()` behaviour, so an un-customised book — which is every
book on a device that never touches this feature — is byte-for-byte
unchanged. `CoverColorPicker.jsx` is a thin wrapper around the existing,
single `ClubPicker.jsx` (`src/CLAUDE.md`: "the one club strip... do not grow
a second one"), adding only a live swatch preview and an explicit "match my
favourite team" option that resolves to `coverTeamId: null`.

Custom cover text (`title`/`subtitle`) follows the same "absent means use
the default" rule stamp records already use for `note` and everything else
user-authored in this app: an empty string is a real, valid value meaning
"nothing custom here," never something the store invents on the record's
behalf. The RENDERING component resolves an empty title to the literal word
"Game Log" and an empty subtitle to the resolved club's full name — the same
two defaults the fixed single-book cover always showed — so the fallback
chain a viewer sees is identical to before this feature existed.

### The margin tightening (unrelated mechanism, same PR)

`PAGE_MARGIN` (`src/lib/passportLayout.js`) moved from `0.06` to `0.025`, so
the 2×4 stamp grid reads closer to the page edges. This is pure geometry —
it changes no data shape and touches no other decision in this ADR — bundled
into the same PR because it landed in the same design pass. `PAGE_MARGIN`'s
own comment carries the updated arithmetic (cell size vs. stamp size, the
`MIN_SEPARATION` clearance check) for the new value.

## Consequences

- **A new file, `src/lib/books.js`, sits beside `src/lib/stamps.js` rather
  than folded into it.** They are bundled into different consumers
  (`stamps.js` into `api/stamps.js`; `books.js` would need its own bundling
  if `api/books.js` ever needed the pure layer server-side beyond the
  field-by-field validation `api/books.js` already does inline) and answer
  different questions — this mirrors the existing split between
  `passportLayout.js` (geometry) and `stamps.js` (the collection) rather
  than introducing a new kind of seam.
- **`LogbookPage.jsx` split into a route-facing shell (`LogbookPage.jsx`,
  now just the Clerk gate and the `LogbookRoot` book-resolver) and
  `LogbookCollection.jsx` (one open book's whole page — tray, book, season
  grid).** The split happened because the shelf pushed the original file
  past `check-file-size.mjs`'s ceiling, not because of an architectural
  disagreement with ADR-0036's original shape; `LogbookCollection.jsx` is
  still exactly the page ADR-0036 described, now parameterised by which
  book it's drawing.
- **A book's un-placed stamps are not lost when the book is removed.**
  Removing a book un-places every stamp filed in it (back to the tray)
  before tombstoning the cover — the keepsake outranks its shelf slot, the
  same priority `stamps.js`'s own placement-degrades-to-tray rule already
  states for an unreadable placement.
- **`docs/game-log.md`'s "one book" framing needed updating in the places
  that described the collection as a single object**, not merely a search-
  and-replace: the retrospective at `/logbook/stats` (bare) intentionally
  stays whole-collection-wide across every book, while the new
  `/logbook/book/{bookId}/stats` is the per-book view. The two are not the
  same feature wearing two names; `docs/game-log.md` says which is which.
- **Open thread, not resolved here:** a book's identity (title, subtitle,
  cover club) syncs the same way a stamp does, but nothing about *ordering*
  multiple books on the shelf syncs explicitly beyond each book's own
  `createdAt` — two devices that both create a book at nearly the same
  moment will show them in a consistent but not necessarily
  device-agreed-upon-in-advance order until the next sync round-trips. This
  is the same class of eventual consistency every other multi-record sync
  channel in this app already accepts, not a new gap.
