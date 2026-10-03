# The Matchup Scout mirrors to the catcher's view on request

**Status:** Accepted (Gary approved the design on 2026-10-02; an addendum to ADR-0077, scoped to one page)
**Date:** 2026-10-02
**Issue:** #1408

## Context

ADR-0077 draws every pitch from the camera behind the pitcher. It rejected a
per-reader toggle: "for a question that has one right answer for someone
scoring off a telecast". It also said that, if a reader asked for the other
view, "the mirror is two exported functions and a toggle would be cheap to
add".

The Matchup Scout (#1408) is that ask. Gary decided on 2026-10-02 that the
page gets a View control: **Pitcher's** (the default, ADR-0077's view) and
**Hitter's** (the catcher-style mirror). The Scout is not a second screen next
to a telecast. A reader on it compares a pitcher's locations with a hitter's
results, and a hitter's coach reads a zone from behind the plate.

## Decision

**1. One page, one control.** The View control exists on the Matchup Scout
only. Every other pitch plot keeps ADR-0077's view with no control.

**2. The mirror stays a view, never a stored fact.** The Scout draws through
the same two exports: `sx` for a point and `viewCol` for a binned column. The
Hitter's view reads `sx(-px)` and the stored column itself. No shard, no
counter and no stored cell changes with the control.

**3. The counted cell is the drawn cell, in both views.** A region's rect and
the batter's box come from the same projection a pitch takes, so the mirror
moves them together. A test checks a lattice of pitches in both views (Phase
1 moves `test/scout-design.test.js` with the code).

**4. Words name the side of the field.** Labels say "third-base side",
"first-base side", "inside" or "away", never "left" or "right". They stay true
in both views. The side labels under each map and the tapped region's name
come from the same projection (`sidesInOrder`, `regionLabel`), and a test
holds the words.

**5. The Now Pitching scene shows in the Hitter's view only.** Its camera is
behind the plate (`src/lib/pitcherCard/scene.js`), which is the Hitter's view.
In the Pitcher's view its arcs would break the other way from the maps.

**6. The choice persists in the URL and in `localStorage`**, not in My Tally,
whose set is closed at four fields (ADR-0039).

## Consequences

- ADR-0077's "Alternatives weighed" entry for a toggle stays true everywhere
  except this page. Add a one-line pointer to this ADR there when it is
  accepted.
- A future page that wants the same control needs its own decision. This ADR
  does not make the toggle a house pattern.
- This is a presentation decision. It changes nothing about which numbers
  reach the DOM, or when. The Scout is an open surface (ADR-0034).

## Alternatives weighed

- **No toggle; the Pitcher's view only.** Rejected by Gary's decision on
  #1408: the page serves the hitter's side too.
- **Mirror the stored cells for the Hitter's view.** Rejected for ADR-0077's
  reason: a stored coordinate that depends on a view rots.
- **A site-wide preference.** Rejected: one page asked for it, and a site-wide
  toggle would reopen ADR-0077's decision for the second-screen surfaces.
