# Every zone chart is drawn from the catcher's side

**Status:** Accepted (Gary, 2026-10-28)
**Date:** 2026-10-28
**Issue:** #2687
**Supersedes** [ADR-0077](0077-every-pitch-is-drawn-from-the-camera-behind-the-pitcher.md). ADR-0093's
Hitter's view is now the house view.

## Context

ADR-0077 drew every pitch plot from the broadcast camera behind the pitcher: `sx()` in
`src/lib/zone/zoneGeometry.js` negated the feed's `pX`, and `viewCol()` mirrored a binned column. On
2026-10-28 Gary moved the Gameday strike-zone modal to the catcher's view, the way MLB's Gameday draws it.
Gameday's own batter art is drawn from behind the catcher. In the pitcher's view a right-handed hitter
showed up as a lefty. After that change, the modal and the other zone charts showed one pitch on opposite
sides of the plate.

## Decision

**Every zone chart is drawn from the catcher's side.** `+pX` (first base) draws to the RIGHT, and a
right-handed batter stands on the LEFT. `catcherX(px)` in `zoneGeometry.js` is the one projection. It
plots `pX` as the feed reports it. `sx` and `viewCol` are deleted. The stored 5×5 cells were always in
the feed's frame, and a card now draws them in that order. This covers the strike-zone modal, Gameday's
zone card, the player page's Plate, Command and Arsenal cards, the Glove Target, the Matchup Scout maps
(already the catcher's view since ADR-0118) and `lib/zone/regions.js`.

ADR-0077's rule on words still holds: **a direction is named by the side of the field** ("first-base
side"), never by somebody's left or right.

## Consequences

- No data file changes. The bins were always in the feed's frame.
- `test/zone-geometry.test.js` pins the view: `catcherX(1) > catcherX(-1)`. Each changed card has a test
  that would fail under the old mirror.
- `regions.js` keeps a `'pitcher'` view (`catcherX(-px)`) only for the Design Lab's Scout toggle.
- Not in scope: camera scenes that are not zone charts, such as the Scout's Pitcher's view stage and the
  pitcher card's `PitchScene`.
