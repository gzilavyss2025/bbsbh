# ADR-0046 — No timing before a reveal may be a function of the reveal

Status: accepted (2026-08-13)

## Context

The scoring loop is the app's whole point and its most repeated interaction:
tap, read the result, pencil it onto paper, glance at bases and outs, tap
again. Four to six times a half, six halves an hour, three hours a night.

Nothing in that loop was ever marked as finished. An at-bat replaced the
previous at-bat in the same frame it was asked for. A half committed and the
console band quietly grew a tally card. The last half of a game ended exactly
like the fourteenth. The reader is doing something with a beginning, a middle
and an end — a half closes, a game closes — and the interface gave them a flat
sequence of instantaneous swaps.

The fix is punctuation: a beat before the mark lands, a rule when the half
closes, a double rule when the book does. Every one of those is a **duration**,
and that is what makes them a spoiler-rule question rather than a styling one.

## The problem with timing

This app's spoiler rule is structural and it is about the DOM: a
score-revealing value never exists in the render tree until reveal (ADR-0001),
because `SealBox` takes a render function and only calls it once revealed
(ADR-0002). Both are checks on WHAT is rendered.

Neither says anything about WHEN. A hold that ran 180ms for a strikeout and
360ms for a grand slam would satisfy every one of them: nothing is fetched
early, nothing is computed early, no gated module is called outside a reveal
render function, and `spoiler-manifest.json` stays green. And a reader would
have the play before the mark landed, because they would learn the tell inside
one inning. A pause is a channel. It is the same leak as printing the run, just
spelled in time.

The same argument runs at every scale of this feature:

- **The at-bat's hold** would leak the play if it varied with the play.
- **The half's closing rule** would leak the third out if it started before the
  half committed. Its start says "that was the last one."
- **The game's double rule** would leak extra innings if it keyed on
  `selectIsFinal`. At the bottom of the 9th, a thicker rule answers "is there a
  10th?" — the one question the reader has not asked yet.

Each of those is a different mistake and they share one root, which is why they
get one ADR rather than three notes.

## Decision

> **No timing before a reveal may be a function of the reveal.**
>
> Every duration the reader can perceive ahead of a mark is a CONSTANT. Any
> value that varies with what is being revealed may only begin once the mark is
> already rendered and legible.

Three things follow, one per beat.

### 1. The hold is a constant, and lives where a constant can be checked

`src/components/inning/focus/beats.js` holds every timing in the loop as a
literal number. `useDenotationBeat.js` reads one of them and takes no argument
off the entry — not the code, not the codeKind, not the RBI count, not the
pitch count. It is the same 180ms for a walk, a strikeout and a grand slam.

That file **imports nothing**, and `test/scoring-beats.test.js` asserts it. The
assertion is the enforcement: a module that cannot reach a feed is a module
whose durations cannot be derived from one, so the cheapest way to break this
rule — one import of `derive.js` and one ternary — fails the suite rather than
passing review. It is the same move `spoiler-manifest.json` makes for the DOM
half of the rule, one axis over.

**The boundary is the ink, not the play.** Weighting a big play is not
forbidden; weighting it *early* is. Once the denotation has printed, the reader
knows what happened, so anything keyed off it after that point leaks nothing.
Any such effect must therefore start from the ink-set's END. Do not blur that
line by starting a "bigger" animation at the hold and letting it run longer.

### 2. The rule starts at the commit, and nowhere before it

Focus mode's closing rule (`HalfClose.jsx`) is mounted on `postHalf` — the
`useFocusMode` flag that means the half finished under the reader's eyes. That
is the commit itself, not a prediction of it. Nothing in the sequence consults
the half's contents to decide whether or when to run; it reads them only to
print them, inside a `SealBox` render function, on the same reveal-only footing
as `HalfTally` (ADR-0001, ADR-0006 for why E is the fielding side's).

The sequence is ~700ms — the hairline draws left to right over 420ms, then R,
H, E and LOB ink in 90ms apart — and the bar's forward action is held for
exactly that long. Any tap or key ends it early, so the hold can never cost
more than one tap. It is `aria-disabled`, not `disabled`, because a truly
disabled button emits no pointer events in most browsers and a thumb landing on
it would then neither advance nor cut the sequence short.

### 3. The double rule keys on the reader's mark, never on the feed's status

`bookIsClosed(revealedThrough, finalHalfIndex)` — the reader has revealed every
half that was actually played. `selectFinalHalfIndex` is null until the game
ends, so the predicate can only go true after the reader has themselves caught
up to the end. A game headed for extras draws the ordinary single rule at the
bottom of the 9th, identically to one that ended there, because at that moment
17 has not reached 19 and the two are indistinguishable from inside the app.

`selectIsFinal` would have been the obvious thing to reach for and is exactly
wrong: *the game is over* and *the reader has finished it* are different facts,
and only the second is theirs to know.

At that moment the bar's last action is named as an act rather than a
destination — **"Close the book ›"** instead of "Box score ›". Same handler,
same destination; it lands where the Game Log's stamp strip is the first row at
the head of the revealed sheet (ADR-0035's third amendment), so the offer to
keep the game is the first thing there. It stays behind the box score's own
seal: this button reveals nothing, and that `SealBox` must not gain an
`onReveal` (see `BoxScore.jsx`).

## Reduced motion

All three are **skipped, not slowed**. `styles/01-base.css`'s blanket kill
collapses CSS durations, which is enough for an animation whose only cost is a
duration — and is not enough here twice over: the denotation hold is a
`setTimeout` no stylesheet can reach, and the tally figures' stagger is an
`animation-delay`, which that rule does not touch. So `motionIsReduced()` is
read at each gesture (extracted from `SealBox`, which already had it privately
for the same reason), and under it the hold is zero, the rule and its four
figures are simply there, and the forward action is live at once.

## Consequences

- Two files came out from under ADR-0038's size ceilings on the way in, both
  moved verbatim: `PlayByPlay.jsx`'s notification-card family to
  `EventCards.jsx`, and `InningViewer.jsx`'s floating bar to
  `InningActionBar.jsx`. Neither move changes a class, so
  `e2e/reveal-hit-area.spec.js`'s geometry assertions still measure what they
  measured.
- The closing rule's R/H/E/LOB and the console band's `HalfTally` now show the
  same four figures at the same moment, in two places. That is deliberate and
  it is the one thing here worth a second look on real hardware: the rule is
  the line a scorer draws under a row, the band's card is the half's pitch
  analysis. If it reads as a repetition rather than as two different questions,
  the answer is to drop the four cells from `HalfTally` and leave it the
  analysis card — not to remove the rule, which is the punctuation.
- **The beat's two knobs shipped too small to see, and the arithmetic is worth
  keeping.** The ink-set went out at 40ms / 1.03 — about two and a half frames
  at 60Hz, moving a 21px mark by 0.64px. It was measurably running and visually
  absent, which is the worst of both. It is 220ms / 1.25 now. A duration this
  file argues must never vary with the play still has to be long enough to
  perceive, or the rule is protecting a beat nobody gets.
- **Scaling a mark centred with `transform: translate(-50%, -50%)` drags it.**
  Individual transform properties apply translate → rotate → scale → transform,
  so a `transform` offset sits INSIDE the scale and gets multiplied by it: at
  1.25 the centred out chain started ~4px off the diamond and slid into place.
  `.pbp__code--center` centres with the individual `translate` property instead,
  which resolves against the unscaled layout box. Invisible at 3%; the whole
  difference between a press and a nudge at 25%.
- `beats.js`'s no-import assertion is a real constraint on future work, not
  boilerplate. Anything that genuinely needs feed data to decide a duration has
  to argue past this ADR first, and the honest version of that argument is
  almost always "and it runs after the mark is up."

## Amendment (2026-08-13): the rule is gone; the tally is what inks in

The repetition flagged above in Consequences was real on real hardware, and it
resolved the other way from the fallback that paragraph named. Dropping R/H/E/LOB
from `HalfTally` would have kept a rule punctuating a card the reader's eye
wasn't on yet — the console band, not the stage, is where a scorer's eye lands
once a half ends, because it's where the numbers that answer "what do I write
down" already live (ADR-0043). A hairline drawn a beat earlier, under a card
about to be replaced by the trail's next cell, was punctuating the wrong
sentence.

**`HalfClose.jsx`/`HalfCloseRule.jsx` are deleted.** In their place, `HalfTally`
itself inks in: its eight cells — not just the four the rule drew — arrive one
at a time, 90ms apart (`TALLY_STAGGER_MS`, unchanged), the moment the card
mounts on `postHalf`. No hairline; the card's own appearance (replacing
`DueUpConsole` in the console band, ADR-0043) is already the boundary marker a
drawn rule existed to add. `CLOSE_SEQUENCE_MS` drops its `RULE_DRAW_MS` term —
there is no draw to lead with — and now covers eight cells instead of four:
`(TALLY_CELL_COUNT - 1) * TALLY_STAGGER_MS`, 630ms.

Sections 1 and 3 above (the hold, the book-closing predicate) are unchanged —
this amends section 2 alone, and every argument in it still applies to the
replacement: the ink-in is mounted on `postHalf`, the commit itself, and reads
nothing from the half before printing it (`HalfTally`'s reveal-only footing,
unchanged from before this amendment). `bookIsClosed` still decides the bar's
"Close the book" vs "Box score" label; only the **drawn** double rule that used
to ride alongside it is gone, and the label alone carries that signal now — it
already did, independently, before this amendment (Decision 3 above).

`Stat` (`StatBox.jsx`) gained an optional `style` prop so `HalfTally` can set
each cell's `--tally-i`; `StatBox`'s own cells pass nothing and are unaffected.
The reduced-motion argument in "Reduced motion" above is unchanged in kind: the
ink-in's `animation-delay` still needs its own kill (`--tally-step` in place of
`--close-step`), for the same reason a blanket duration-collapse doesn't touch
a delay.
