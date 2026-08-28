# Scored-by-inning situational records — working notes (issue #939)

## What shipped

- `scripts/lib/team-records.mjs` — `inningsScoredMask(innings, isHome)` and
  `scoredInExtras(innings, isHome, scheduledInnings)`.
- `scripts/gen-team-records.mjs` — two new keys on the shipped row: `ib` (the
  mask) and `ix` (scored past the scheduled length).
- `src/api/teamRecords.js` — a new `Scoring by inning` group (19 rows), the
  `month` lever, `lastOccurrence`, `monthsPlayed`, `ordinal`, `shortDate`.
- `src/screens/team/modules/records/InningScoringGrid.jsx` — the card's compact
  grid for that group.
- `/situational-records` — a `?month=` chip row and a `Last` column on the
  boards whose rows carry one.

## Two calls the issue left open or got wrong

**Extras are read off `ix`, not off bit 9.** The issue proposed
`p(g) => g.ib >> 9 !== 0`. That is wrong below MLB: a MiLB doubleheader game is
scheduled for seven innings, so its eighth inning is extra baseball and no fixed
bit position can say so. `scoredInExtras` compares against the game's own
`scheduledInnings`, the same field the existing `x` flag is derived from.

**The 19 rows are their own group, not more rows inside `Scoring`.** Both render
surfaces key their headings, their jump nav and their "more in this group" list
off a group title. A `Scoring` group of twenty-three would have swamped all
three. Its own title also earns the card a different renderer: a ten-line grid
instead of nineteen flat rows.

## Hand check against a real game

gamePk 823581, 2026-08-27, Brewers at Mets, 8-2. Brewers scored in innings
1, 2, 5, 6 and 8 — bits 0, 1, 4, 5, 7 — so `ib` must be 179. The shipped row
reads 179, and the card's grid names Aug 27 as the last time for the top of the
1st, 2nd, 5th, 6th and 8th, and an earlier date for every other inning.

## File size

The Brewers' `158.json` grew 25,819 -> 26,983 bytes (+1,164, +4.5%). The whole
2026 directory grew 3,661,252 -> 3,825,013 bytes, the same 4.5%.
