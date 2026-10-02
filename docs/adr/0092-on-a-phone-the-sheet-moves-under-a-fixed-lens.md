# On a phone, the sheet moves under a fixed lens

**Status:** Accepted
**Date:** 2026-10-02

## Context

The live scorecard (`/{date}/{matchup}/scorecard`, ADR-0047) is a whole #22
sheet. On a phone it opens at full size on one corner of the sheet, and the
reader pans to find the next sealed box. Gary scores by hand on paper, with the
phone next to the TV and one thumb free. After each at-bat he must find the
box again, tap it, and copy it. Issue #724 ("Lens and Ruler") keeps the next
sealed box in one place on the screen instead. This ADR records the first
slice of that design: the still lens. The bar, the cards and the motion follow
in later slices and add to this record only where they change a decision here.

## Decision

**1. On a phone, the scorecard opens in lens mode.** The pane shows the real
sheet, zoomed so the rail and two inning columns fill the width. A fixed navy
frame sits at 54% of the pane's height, over the second inning column. A fixed
ruler runs under the frame's row, from the pane's left edge to the frame. After
each tap and each turn, the pane scrolls so the next sealed box (or the turn's
flip cell) is under the frame. The frame does not move, so the tap target does
not move. A fixed bottom bar holds [Sheet], which shows today's whole sheet,
with the frontier outlined in navy and a floating "Back to the box".

**2. The pane scrolls. The sheet is never transformed.** `ScorecardSheet`
draws the table with CSS `zoom`, because `zoom` scales layout and keeps the
sheet's three sticky edges (the rail, the inning header and the foot row)
working. A `transform` would break all three. So the lens sets the pane's
`scrollTop` and `scrollLeft`. In this slice the scroll is instant.

**3. Positions are measured, not computed.** An inning where the order bats
around widens into extra columns. The rail stacks a line for each substitute,
which can make a row taller. A half that ends on a caught stealing puts the
flip cell under the "CS →" box, not on the next batter's own box. So "column =
inning" and "row = slot" are both wrong in real games. The seal cell and the
flip cell carry `data-frontier`, and `useLens` measures that cell, the rail
and the header with `getBoundingClientRect()`. The pure arithmetic
(`lensOffset`, `lensFrame`, `lensZoom` in `src/lib/scorecard/geometry.js`) is
unit-tested with fixed rects. `offsetTop` is not used, because browsers
disagree on whether it is zoomed.

**4. The lens has a compact rail, and the zoom follows from it.** The full
rail is 172px (name plus Pos), which leaves room for only one inning column at
a readable size. In lens mode the rail is about 100px: the slot number and the
surname, with the position and the uniform number on a second line, and the
Pos column folds away. The zoom is then `paneWidth / (rail + 2 × cell)`, capped
at the sheet's own maximum: about 1.4 on a 390px phone.

**5. The pane is bounded, and spacers give it headroom.** Scroll cannot go
negative, so row 1 and inning 1 could never reach a frame in the lower half of
the pane. A spacer row above slot 1, a spacer row below slot 9, and a blank pad
column before inning 1 let every box reach the frame. The pane is the height of
the window above the bar, so the pane, not the page, is the scroller.

**6. Lens mode is off under a force-reveal.** Under Scores Unlocked (ADR-0026)
or a stamp (ADR-0048), `effectiveReveal` gives `commitReveals` false and the
frontier is null: the sheet is inked to the end, and there is nothing for the
frame to hold. `lensOn` asks for that answer and does not derive it again. The
lens is also off wider than a phone (`PHONE_LENS_QUERY`, today
`(max-width: 480px)`): there the −/+ zoom control stays the answer. A sideways
phone gets the lens later by widening that one query.

**7. Nothing is stored.** The phone always opens in the lens (Gary,
2026-10-02). [Sheet] leaves the lens for this visit only, in React state. The
lens adds no cursor and no reveal path: the seal under the frame is the real
button (the frame is `pointer-events: none`), and a tap goes through the same
`onFrontierTap` as before (ADR-0016). No new value goes to `localStorage` or
to the reveal sync (ADR-0022).

## Consequences

- **Spoiler safety (ADR-0046).** Before a tap, the frame, the ruler, the
  spacers and the scroll depend only on where the frontier is, which the reader
  can already see. After a tap, the scroll target can depend on the result,
  because the reader asked for it.
- In the lens, `side` follows the frontier. Entering the lens turns to the
  frontier's page, the flip turns it after that, and the Top/Bottom control is
  in the whole-sheet view only. Two controls that both change `side` would
  confuse the frame.
- Entering the lens brings the pane's top to the top of the window, so the
  app's chrome above the scorecard scrolls up out of view. The reader can still
  scroll back up to it.
- The Player/Pos header corner now stays over the inning numbers when the sheet
  pans. It lost on z-index to the header row before, which the lens made
  plain.

## Amended by the bar (#724, slice L4)

The bottom bar now has its three rows. The rules below add to the decisions
above and change none of them.

- **One state at a time** (`barState` in `src/lib/scorecard/bar.js`): `loading`,
  `handoff`, `edge` or `sealed`. A turn that is due beats the live edge: the
  reader turns first. `loading` is only the wait for a first feed. A poll or a
  Refresh keeps what is on screen, so the bar never flickers to a disabled
  button each minute.
- **Line A and the situation read only open boxes.** The words, the runner
  moves and the situation come from the clamped view (`words.js`,
  `situation.js`). The one name that is not on an open box is the frontier
  batter's, which the grid now carries (`grid.frontier.batter`). Who comes up
  is a pre-pitch fact, as the lineup is (ADR-0003). A test taps through the
  captured game and, at each step, swaps the result of the sealed at-bat. The
  bar must not change (ADR-0046).
- **A half's end stops on "Turn to Bottom N".** No auto-turn: that tap is the
  moment to rule off the inning on paper. The half totals show only here,
  after the half has committed (ADR-0006: E is the other club's fielding).
- **The live edge shows no seal.** When the cursor meets the end of a half that
  is still being played (ADR-0055) and the next at-bat is still in progress
  (`grid.frontier.live`), the lens draws a dashed pencil "At bat" box in place
  of the seal and a "Waiting for the play" pill with Refresh. In the lens the
  in-progress at-bat is not opened. The seal returns, with no motion, on the
  poll that finishes it. A FINISHED at-bat at the feed's end (the third out
  before the next half starts) is a seal like any other: holding it back would
  make the wait's length tell how it ended. The whole-sheet view and the
  desktop sheet keep today's seal.
- **One tap lock.** The seal, Unwrap and Turn share a 700 ms window after every
  reveal and every turn (`tapLocked`). It is a constant and never reads the
  result (ADR-0046). While the cell editor is open, none of the three acts.
- **The turn chip is navy.** `.sc-ab__fliptext` was kraft. The turn lifts no
  seal (ADR-0083), so it is navy on every width. Unwrap is the one kraft
  control in the bar, and the seal-scope guard lists it.

## Amended by the pitcher cards (#724, slice L5)

One card docks under the frame at a time: the new-pitcher notice, or at a
leadoff the Entering card. The bar's row 2 gets "Pitching · Name ›", and the
notice and that button open the pitcher card in a bottom sheet.

- **When a pitching change shows.** `frontierArmChange`
  (`src/lib/scorecard/arm.js`) follows ADR-0016's "What one step contains". A
  change before a half's first pitch shows at that half's leadoff
  (`selectPrePitchChanges`). A change between two plate appearances trails the
  step that retires the batter before the new arm, so the notice shows right
  after that tap and before his first batter opens. A change between pitches
  (`midAtBat`) leads the next step: it shows only with the next tap, which also
  opens the at-bat he finished, so it gets no notice. At a leadoff with no
  change the arm is his club's starter in inning 1, else the arm who threw his
  club's last play. Never the half's own first play: its pitcher is the one
  who FINISHED that at-bat.
- **It is caller-gated.** It reads the feed, so the page passes the real
  `revealedThrough` (ADR-0003, ADR-0010). It answers null for any half but
  `revealedThrough + 1`, and in that half it reads only the entries the step
  cursor has opened. A test walks the captured game and checks, at each step,
  that the arm it names has already entered by the gate.
- **The label is the innings viewer's.** "Now pitching" only while the arm is
  fresh: his entry is in view and his first batter is still sealed, or, at a
  leadoff, `selectIsFreshPitcher` says so. Else "Pitching". `relief` is
  `HalfInning.jsx`'s rule. The notice's flag reads only data that ends the day
  before the game (ADR-0088).
- **While the sheet is open, the seal, Unwrap and Turn do nothing**, as while
  the cell editor is open. The sheet is not portalled, so it keeps `#root`'s
  all-caps rule.
