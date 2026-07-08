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
