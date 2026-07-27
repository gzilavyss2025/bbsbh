Status: fixed — option (1): scorecardPlays now keeps `kind: 'placed'` cards
and gives the runner a cell in his own slot row; AtBatBox renders it (AR
outcome, placedAt ghost path, prBase for a pinch runner). Regression tests
in test/scorecard-placed-runner.test.js. Not yet browser-verified (no free
reserved dev port this session).

# The Scorecard Lab grid's R column disagrees with its own scoreboard in extra innings

## What happened

`scorecardPlays` (`src/api/loadScorecard.js`) walks `computeHalfInningFeed` and
skips anything that isn't `kind === 'atbat'`, so the extra-innings automatic
runner's `placed` card never lands on the grid. His RUN therefore never reaches
a slot's `r` tally — while `perInning` and the bottom scoreboard on the SAME
sheet read the real linescore.

Measured directly:

| gamePk | side   | grid R total | scoreboard R |
| ------ | ------ | ------------ | ------------ |
| 824169 | top    | 2            | 4            |
| 823196 | bottom | 6            | 7            |
| 824406 | top    | 2            | 3            |

PR #401 already fixed the equivalent undercount on the innings view's own
running line (`onRunsSoFar` counts `placed` cards), and its PRD explicitly left
the printable sheet as a follow-up (its §6 open question 3). This ticket is that
follow-up, plus the observation that the mismatch is between two columns of one
sheet, not just a missing card.

## Options

1. **Give him a cell in his own slot row.** He has a real `battingOrder` (he's
   by rule the previous half's last batter), so `battingSlot` resolves. Most
   faithful to a paper sheet; needs `AtBatBox` to take `placedAt` the way
   `PlayDiamond` already does.
2. **Count only his run** into the slot/occupant `r`, no cell. Fixes the numeric
   disagreement with the least surface change, but leaves a run in the R column
   with nothing on the row explaining it.
3. **Leave it and label the sheet** as excluding automatic runners.

Recommend (1) — the diamond work is already done in `PlayDiamond`.

## Where

`src/api/loadScorecard.js` `scorecardPlays`; `src/components/AtBatBox.jsx`
(which also doesn't take `prBase`, so the pinch-runner mark is missing from the
printable sheet too).
