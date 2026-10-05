# src/components/logbook — the Logbook stamp (ADR-0035)

## The strip

a thin strip across the HEAD of the revealed sheet (ADR-0035's third
amendment), and it stays ONE row — mount, a line of copy, one action — with
everything a minted stamp additionally offers behind its `Details` disclosure.
It is the first child of the box score's one section on every width; the box
score's phone order (`48-stamp-strip.css`) is CSS `order`, not a second render.

## The collection

The collection
(`screens/LogbookCollection.jsx`, `/logbook` + `/logbook/{season}` — a user
may hold more than one book, ADR-0041) and its store
(`hooks/useStamps.js` over the pure `lib/stamps.js`) are **local-first**: a
signed-out user has a real Logbook on that device, holding no scores at all —
the facts are resolved at render time by `api/logbook.js`. `StampsCloudSync`
mirrors the collection across a signed-in user's devices; its header records
why the old pre-mint reveal-mark push could never satisfy the retired gate.

## The minor-league ring

A **minor-league** game inverts the
ring band — same ink, same silhouette (`stampRingInverted`, ADR-0036's fourth).

## Bucket notes

The Logbook stamp (ADR-0035) — `check-stamp-surfaces.mjs` allowlists `GameStamp`/`StampGameButton` by path. `StampInButton` is the Stamp In page's plain mint control (ADR-0042): it may mint, never draw, so it sits on that guard's `FORBIDDEN_ART_FILES` instead. `StampSheet`/`ClubsSeen` draw the "every club"/"every ballpark" postage-stamp shelf (no score, so outside the guard); `StampDetailModal` is the bigger read a filled slot opens on tap — name plus your own first/count/most-recent history with it
