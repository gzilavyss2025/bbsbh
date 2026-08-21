# Roster-card membership and position labels key on primary position, not current box position

A boxscore player's `position` field reflects his current/final position,
which silently drifts over the course of a game — verified against gamePk
823035 (2026-07-07 MIL@STL g2), where a starter's `box.position` read out his
*third* position of the night and collided with, erasing, another starter
from `defenseEntering`'s starting-lineup seed. Reading `box.position` for
roster classification would move or rename a bench catcher's roster row the
moment he mopped up a sealed blowout (his box position would read 'P'; subs
read 'PH'/'PR') — a spoiler through the card's shape alone, without ever
showing a number.

`box.allPositions[]` lists a player's positions in the order he actually
played them, so its first entry is his true starting spot; `selectLineup` and
`isPitcherByTrade` (`select.js`) use that, falling back to `box.position`
only for thin MiLB feeds that omit `allPositions`. Only the reveal-gated
strike-through may change a roster row with game events — never its position
label or list membership.

## Amendment (2026-08-20) — the strike-through follows the half on screen too

The rule above ends "only the reveal-gated strike-through may change a roster
row with game events". True, and it was under-specified: the strike-through
answered to the reveal mark ALONE, which is the right ceiling for a reader
moving forward and the wrong one for a reader moving back.

The innings viewer is a replay surface as much as a scoring one. Unseal a whole
game, page back to the top of the 1st, open EXTRAS, and every late substitute
was already crossed off there — Cal Raleigh struck through in the 1st because
he pinch-hit in the 8th (MIL@SEA, 2026-08-20). That is not a spoiler: the
reader owns the whole game already, which is exactly why the reveal mark had
nothing left to say. It is simply wrong about the moment the page is showing.
Every neighbouring card on that screen already reads as of the half —
`lineupEntering`, `defenseEntering`, the "Now Pitching" card — so the bench and
bullpen were the last surface still reporting the end of the game on a page
headed "Top 1st".

`enteredAsOf(player, revealedThrough, halfIdx)` in `select.js` now owns the
decision, and keeps the LOWER of two ceilings:

- **the reveal mark**, unchanged, so a substitution in a still-sealed half never
  shows on the card; and
- **the half on screen**, so the card reports the roster as that half stood.

Nothing moves in the live flow: at the frontier the half on screen IS the reveal
mark, the two ceilings agree, and a sub who enters in the half being scored
strikes through the moment he always did. Standing on the sealed NEXT half is
the case that proves the first ceiling is still load-bearing — `halfIdx` is
`revealedThrough + 1` there, and the min is what keeps the card quiet.

Availability is read as of the half's first pitch, deliberately, matching every
other entering-the-half card beside it: a player who enters mid-half reads as
used for that whole half rather than from his own plate appearance. Pinned by
`test/roster-availability.test.js`.
