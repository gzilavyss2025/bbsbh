# Express Lane holds the play until you say you watched it

**Status:** Accepted
**Date:** 2026-09-14

## Context

Express Lane is the film-gated scoring surface: a clip of the play at the top,
the scorer's own boxes beneath it, and one button at the foot that moves both.
Its thesis is a single sentence, stated in `rail.js`'s header and again on the
page — *a scorer who can read "grounds out, second baseman to first" has no
reason to wait for the picture.* The **film gate** is what enforces it. The
cursor may not pass a clip that has not arrived, so the picture always comes
first.

Or it did in theory. The gate stops the **cursor**; it never stopped the
**notation** travelling with it. One tap on "Next play" moved the cursor, and
in the same frame:

- the outcome box filled in — `SO`, the strikeout's `K`, the out number, the
  strike ladder;
- the men on base took whatever bases the play sent them to, and the man it
  erased was rubbed out;
- a new chip joined the foot strip carrying the play's code;
- and on the last out of a half, the running line overhead printed the half's
  run total.

The video was still buffering its first frame. A scorer watching a live-action
replay of a pitch already knew it was a strikeout, because his own scorecard had
told him half a second earlier. The gate was intact, the clip downloaded, and
the picture was decoration.

This is the same failure the surface was built to prevent, one layer in. It
does not need a new principle — only the existing one carried the last step.

## Decision

**A play with film arrives HELD.** Advancing onto it starts the clip and writes
nothing. One more tap — or one press of the space bar — writes it.

`src/lib/expresslane/hold.js` holds the three pure rules;
`hooks/useExpressLane.js` owns the state; `ExpressLanePage.jsx` and
`ScoringDeck.jsx` draw the two faces. Pinned by
`test/express-lane-hold.test.js`.

### Only a row with a picture holds

`holdsForFilm(gate)` is true for exactly one of the film gate's reasons:
`'ready'`. Every other reason is a row with an empty pane above it —
`'paperwork'` (a mound visit, a substitution), `'no-film'` (MiLB, pre-2016, or
one of the playIds MLB mints by formula for an intentional walk), `'evicted'`
(the bytes reclaimed behind the cursor), `'consented'` (the scorer chose to
score it blind). `'waiting'` and `'stalled'` block the cursor and never land
one. A hold with nothing behind it is a second tap to read a play that could
not have been watched, so those rows land written, exactly as before.

### The hold is a CAP, not a cover

Nothing is drawn and then hidden. `unwrittenRow(row)` hands `expressDeck` the
same row with `isTerminal: false`, and `railStepCap` already reads that as *the
plate appearance this row sits inside has not been earned yet* — the rule that
stopped a cursor resting on a mound visit from drawing the finished box around
it. The deck it returns is capped one card short, so the box, the chip and the
runners' diamonds do not exist in the DOM, which is what ADR-0001 requires.

This also gets the hard case right for free. A play writes back onto the cards
**above** it: a force out puts `outAt: 2` and the `FC 6-4` chain onto the box of
the man who singled two plate appearances earlier. Slicing the written deck
would carry that write-back into the held state and rub the runner out while the
scorer was still watching the throw. Capping short of the play never computes
it. Over the captured game (gamePk 823035) the held deck equals the deck one
play earlier, card for card, at every plate appearance.

### The reveal mark moves on the reveal, not on the landing

The mark used to advance inside `advance()`. It advances in `commitReveal()`
now, and the difference is the whole of the hold's honesty: the mark is what
drives the running line overhead, the innings viewer, and every other device
through `reveal.js`. Left where it was, the last out of a half printed that
half's run total while the scorer was still watching the out that ended it.
**Held in one band and open in another is not held.**

Two consequences follow, and both are the right direction. A scorer who watches
the film and leaves without revealing leaves the mark where it was, so the play
comes back held rather than silently counted as read. And `atHalfEnd` reads
false while a play is held, because the foot offering "Next half-inning" over a
covered box says the out being watched was the third one.

### The play's own sentence is shown with it

The feed's play-by-play line — "TJ Rumfield flies out to left fielder Riley
Greene." — is now drawn under the box, through `playStory(row)`. It is what
settles a play the picture leaves ambiguous: which bag was covered, which runner
the throw went after, who the relay went through. It narrates the outcome, so it
is gated by the same flag and never rendered early.

### One button, and the space bar is that button

The foot is one `<button>` element with three faces — "Show the play", "Next
half-inning", "Next play" — rather than three branches of JSX. A thumb finds the
same target every time, focus survives the reveal, and the keyboard handler has
one node to press instead of a guess about which state the surface is in. The
key yields to any focused control, the video above all, so space keeps meaning
play/pause when the player has it.

### The hold is not an option

It is the surface's behaviour, not a fourth choice on the entry chooser. The
chooser already asks two questions (how much of each at-bat, when the film
arrives), and neither changes what the scorer may see. This one does, and a
switch that turns the thesis off is the design eroding back into what it
replaced.

## Consequences

- **`?nofilm` cannot walk it.** The dev switch strips every playId, so the gate
  reads the whole game as paperwork and nothing holds — which is correct, and
  is why the full-game walk stays fast. Verifying the hold needs real film, so
  it is verified on a handful of plays against a live game, never in a loop
  (`sporty-clips.mlb.com` refuses a client after roughly 25 requests).
- **Scoring a play is two taps, not one.** That is the cost of the feature and
  the point of it. The second tap is the one that says "I watched it".
- **A future row kind must answer `holdsForFilm`.** Anything new that reaches
  the deck with a clip on the screen holds; anything that reaches it with an
  empty pane does not. The gate's `reason` is the single place that answers it,
  so a new reason is a decision to make there and nowhere else.
