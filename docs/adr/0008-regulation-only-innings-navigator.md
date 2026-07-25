# The innings navigator shows only regulation innings up front; extras unlock one at a time

Deriving the visible inning count directly from the feed's actual inning
count (`selectInningCount`) would itself be a spoiler — the navigator and
running line would hint a game went to extras before the user had revealed
their way there. `InningViewer` instead shows only `regulation` innings
(`selectRegulationInnings` — 9, or 7 for a shortened game) up front; each
inning past regulation unlocks one at a time via `unlocked`, and only once
the prior inning's bottom is at or below `revealedThrough`. `RollingLine`'s
boxscore holds only `regulation` columns, so once extras unlock it scrolls
that window forward (dropping inning 1 when inning 10 appears, etc.) while
R/H/E totals stay cumulative over every revealed inning.

**Amended by ADR-0026 (default path untouched).** Extras have one *consented*
bypass: under the spoilers-off pass `effectiveReveal` returns
`renderUnlocked = actualCount`, so every inning the game actually has is
navigable — agreeing to see a day plainly is agreeing to know it went to extras.
It is a RENDER value; the real `unlocked` is untouched, so the moment the pass no
longer covers that date the window is back to `regulation` + whatever the user
genuinely revealed. For a user who never consents, this ADR's rule is unchanged:
`unlockedInnings` still gates on the real mark, and `RollingLine` still holds only
`regulation` columns.
