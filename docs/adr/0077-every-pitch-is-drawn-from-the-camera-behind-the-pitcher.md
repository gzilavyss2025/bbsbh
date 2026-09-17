# Every pitch is drawn from the camera behind the pitcher

**Status:** Accepted
**Date:** 2026-09-17

## Context

The MLB feed reports a pitch's plate crossing as `pX`/`pZ`, in feet, measured
from behind the plate: positive `pX` is the catcher's right, which is the
first-base side. Every zone picture in this app took that straight to the
screen — `sx()` in `src/lib/zone/zoneGeometry.js` mapped the domain left to
right, so `+pX` drew on the right.

That is the umpire's view, and it is the one view of a pitch almost nobody
watches. A telecast puts its camera in centre field, behind the pitcher: the
third-base side is on the right of the frame, and a right-handed batter stands
on the right. The app drew the mirror image of that. Three surfaces did it:

- **the in-game strike zone** (`StrikeZone.jsx`), the numbered dots for one
  plate appearance, plus the batter's-box silhouette beside it;
- **the season Command Map** (`CommandMap.jsx`), the 5×5 density grid;
- **the Glove Target** (`GloveTarget.jsx`), the cloud of miss vectors.

This app is a second screen. A scorer has the game running beside it and is
asking a question about the pitch they just watched — did that slider run in on
him, or away. Answering it meant flipping the diagram in their head first, and
the diagram gave no sign that it needed flipping: an unlabelled mirror of a
familiar picture reads as the familiar picture.

## Decision

**Every pitch plot in the app is drawn from the broadcast camera behind the
pitcher.** `+pX` (first base) draws to the LEFT; a right-handed batter stands to
the RIGHT.

**The mirror is a VIEW, never a stored fact.** `normalizePitch` and
`commandCell` still bin in the feed's own frame, because the nightly precompute
writes those cells to disk (`public/data/pitch-command/*.json`) and a stored
coordinate meaning "whichever way we happened to draw it that month" is a
coordinate that rots — the next reader of the file has no way to know which way
round it is. So the flip lives in exactly two exported places, both in
`src/lib/zone/zoneGeometry.js` and both named for what they are:

- `sx(px)` negates `pX` on its way to SVG, for a single plotted pitch;
- `viewCol(col)` mirrors a BINNED column, for a card drawing a stored cell.

`GloveTarget` negates its dots' `x` for the same reason at the same point — a
miss offset has no strike zone to sit in, so it does not reach for this module
(see `docs/scripts/generators.md`), but it is the same one-line mirror.

**A direction in WORDS names the side of the field, not somebody's left or
right.** The Glove Target's caption used to say "misses to the catcher's
right"; under this view that phrase prints on the reader's left. It now says
"to the first-base side" / "to the third-base side", which is true from every
seat in the park and stays true whichever way a future plot is drawn.

## Consequences

- **The pin test now pins the mirror too.** `test/zone-geometry.test.js`
  compares the counted cell to the drawn one through `viewCol`, so a flip
  applied to one side and not the other fails the suite — which is the bug this
  change could most easily introduce later. A second test states the view
  itself: `sx(1) < sx(-1)`.
- **No data file changed, and none needs to.** Nightly regeneration writes the
  same bins it wrote yesterday. A shard from before this change and one from
  after are the same numbers.
- **The zone rect is drawn from `sx(EDGE)` to `sx(-EDGE)`**, in that order.
  Read the two the other way round and the rect has a negative width, which
  renders as nothing at all — the one sharp edge this leaves in
  `StrikeZone.jsx`, and it is commented there.
- **The batter's-box silhouette swapped sides.** An `R` batter's box is now the
  right-hand strip, an `L` batter's the left. The extra strip is added to the
  viewBox rather than carved out of it, so nothing about the plot's scale or
  the CSS widths moved.
- **The umpire zone map is untouched, on purpose.** `UmpireZoneMap.jsx` and the
  season aggregate behind it are BATTER-oriented: their columns run outside →
  inside, per batter hand, and `missEdge` in `api/umpireFavor.js` names an edge
  the same way. Inside is inside from any camera. A "mirror" there would have
  been a change of meaning, not of view.
- **This is a presentation decision, not a spoiler one.** Nothing about which
  pitches reach the DOM, or when, moved — `StrikeZone` is still reveal-only by
  construction (ADR-0001), and the two season cards are still spoiler-free
  aggregates on an open page (ADR-0034).

## Alternatives weighed

- **Flip the bins as well, and mirror the committed shards once.** It would
  make the pin test trivially true, at the price of a data file whose meaning
  is "the view we take today". Rejected: the feed's frame is the only frame the
  file can be read in without this repo beside it.
- **A per-reader toggle, umpire view or camera view.** A control on three cards
  and a preference to store, for a question that has one right answer for
  someone scoring off a telecast. If a reader ever asks for the umpire's view,
  the mirror is two exported functions and a toggle would be cheap to add.
- **Leave the plot and label the axes instead** ("3B" on one side, "1B" on the
  other). Honest, and it still asks the reader to do the flip; labels explain a
  picture that could simply have been right.
