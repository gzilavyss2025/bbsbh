# Sub-step stepping: pitch mode and event taps share one cursor inside an at-bat

**Status:** Accepted (2026-10-26). Gary settled decisions 8 and 9 the same day. The few answers still marked
*inference* are this ADR's reading of the feed, open to review.
**Date:** 2026-10-26
**Issue:** #2604, for #2570 (pitch-by-pitch mode) and #2571 (event taps). Part of #2566.
**Extends** ADR-0016 (the at-bat cursor is a staging layer, never a second spoiler
boundary) and ADR-0046 (no timing or look before a reveal may be a function of the
reveal). It replaces neither. Related: ADR-0001, ADR-0002, ADR-0043 and its 2026-08-12
amendment on pre-pitch changes.

## Context

Gameday (#2566) steps one plate appearance per tap (ADR-0016). Two decisions make a
step smaller than that:

- **Pitch mode (#2570).** A button turns on a mode in which each tap reveals one pitch.
  The result stays sealed until the last pitch's tap. The advance control reads the same
  on every tap, the last one included. The mode lasts for the game, resets for the next
  one, and is not a My Tally setting. It takes effect on the very next tap, even inside a
  sealed at-bat, and the toggle itself reveals nothing. (Gary, 2026-10-22 and 2026-10-23.)
- **Event taps (#2571).** A steal, a caught stealing, a pickoff, a balk, and every
  substitution (including one between halves or before the first pitch) get their own
  tap, while the at-bat's result stays sealed. Mound visits, injury delays, ABS
  challenges and reviews do not pause an at-bat. (Gary, 2026-10-22.)

Gary also decided, on 2026-10-26: an automatic call gets its own tap in pitch mode, but an
intentional walk is one tap; every substitution is its own tap, even in a run; the
pitch-mode flag survives a reload; and a tap while the stage is still animating finishes
the animation and does not advance (#2573).

Both features change what one tap reveals, so they need one rule, not two.

## What the feed says (checked 2026-10-26 against the live `/feed/live`)

- **The last pitch of a ball in play leaks the outcome.** gamePk 824225: every in-play
  last pitch carries `details.code` `X` "In play, out(s)" (31), `D` "In play, no out" (7)
  or `E` "In play, run(s)" (7, one of them with `isOut: true`, a sacrifice fly). Earlier
  pitches carry only `C`, `F`, `B`, `S` and `*B`.
- **An automatic call is not a pitch.** It is a `playEvents` entry with `type:
  'no_pitch'`, `isPitch: false`, `pitchNumber: 0`, and the count after it: `VP` "Automatic
  Ball - Pitcher Pitch Timer Violation" (gamePk 823035, top 6th, ab43), `AC` "Automatic
  Strike - Batter Pitch Timer Violation" (gamePk 818937, top 2nd, ab11). An intentional
  walk is four `VB` "Automatic Ball - Intentional" entries in a row (gamePk 815625, bottom
  10th, ab74).
- **The same-pitch fold.** gamePk 816025, bottom 2nd, ab14: Fabian strikes out while
  Vazquez steals 2nd and takes 3rd on the throwing error. The play has four pitches and no
  non-pitch event; `runners[]` carries the strikeout, the `stolen_base_2b` and the `error`
  legs, all with `playIndex` 3, the last pitch.
- **An event can end the half.** gamePk 823764, bottom 7th, ab51: `caught_stealing_2b`
  with `count.outs` 3, Luis Lara at the plate 1-2 after four pitches. Lara leads off the
  bottom of the 8th. `computeHalfInningFeed` already turns this into an interrupted
  at-bat card.
- **A half often opens with changes.** In all 13 games sampled here (MLB and MiLB), some
  half's first play carries a `pitching_substitution` before its first pitch; gamePk 823035, top
  8th, carries five changes there (two defensive switches, the pitching change, a third
  switch and a defensive substitution).

## Decision

1. **One shared cursor.** A revealed step becomes an ordered list of **sub-steps** in feed
   order: the pre-pitch changes that open a half (when this is the half's first step), then
   for the at-bat each pitch, each automatic call, and each baserunning event or
   substitution, then the **result**. Pitch mode walks every sub-step. At-bat mode walks
   only the stops: each event, then the result. A mound visit, a delay, a challenge or a
   review is never a stop; it shows with the sub-step it trails. The list is a pure
   function of one revealed card, written fresh for Gameday over `pitchDetails` and the
   card's notes.
2. **The last pitch is the result.** The tap that reveals the last pitch (ball four,
   strike three, the ball in play) is the result tap. Until then no sub-step shows the
   last pitch's `details.code`, `details.call.description`, `details.description`,
   `details.isOut`, `details.isInPlay`, its `hitData`, the scorebook code, the result
   sentence, the runners' moves, `basesAfter` or new outs.
3. **One label.** The advance control reads the same before an event, after an event,
   before the result, and on the last pitch. Never "Next event" against "Next at-bat", never
   "Finish at-bat". The words are a wireframe choice (#2568), within that rule.
4. **No tell in the count of taps.** No "pitch 3 of 6" and no "event 1 of 2". The sealed
   layout keeps one fixed height whatever the at-bat holds (ADR-0046).
5. **An event shows its own effect only.** A steal moves one runner; a caught stealing
   adds one out. The event's sub-step shows that, and never the play's end state.
6. **The same-pitch fold: event first, then the result.** When the feed folds a steal into
   the plate appearance's `runners[]` on the last pitch (816025), the steal is one sub-step
   and the result the next. Reason: a scorer pencils the runner's move, then the batter's
   mark; and showing the result first would reveal the steal with it. *Inference:* the
   feed's own `runners[]` order (the batter's leg first) is not the order a scorer writes.
7. **An event that ends the half.** The half commits on that event's sub-step; the at-bat
   is never finished; the checkpoint (#2572) follows; the batter leads off the next half
   with a fresh count (823764). The interrupted card's pitches are its sub-steps.
8. **Changes before a half's first pitch.** Order: the previous half's checkpoint, then
   one sub-step per change in feed order, then the first at-bat. The control looks and acts
   the same whether a half opens with five changes or none. The first tap into the half
   reveals whichever comes first. This replaces the staged "Now pitching" card, whose
   presence was a tell. **Every change is its own tap, even in a run** (Gary, 2026-10-26),
   so 823035's top 8th takes five taps before its first pitch.
9. **Automatic calls.** In pitch mode each one is its own sub-step (Gary, 2026-10-26), so
   the count on screen always matches the paper. Sub-steps are keyed by the event's own
   `index` in `playEvents`, never by `pitchNumber` (0 for every automatic call) and never by
   position in a pitch list (a pitch with no tracking can drop out of one; the old
   `replaySteps.js` header learned this). **An intentional walk is ONE sub-step, not four**
   (Gary, 2026-10-26): the four `VB` entries are one decision and one mark on paper.
10. **The half commit.** Unchanged from ADR-0016: the cursor never writes `revealedThrough`
    until the half's last sub-step is shown, and then it collapses into the normal
    `revealTo` commit. Not while the half is still being played (ADR-0055).
11. **A pitch's type, speed and location are not a score.** They are shown per pitch on its
    own tap. The call of an earlier pitch (ball, strike, foul) is the count, which the
    reader is meant to see. *Inference:* nothing about an earlier pitch tells how the
    at-bat ends; the last pitch is already covered by decision 2.
12. **Where the state lives.** The pitch-mode flag is `localStorage` `bbsbh:pitchmode:{gamePk}`
    (a flag, never a score), so a reload or another tab of the same game keeps it; a
    `storage` listener carries it across tabs the way `useRevealProgress.js` carries the
    reveal mark. The sub-step position extends ADR-0016's at-bat cursor, stored as
    `{halfIdx}:{count}`, to `{halfIdx}:{count}:{sub}` under the same key. A reload lands on
    the same sub-step. A toggle mid-at-bat keeps the position: turning pitch mode off skips
    to the next stop; turning it on makes the next tap reveal the next unseen pitch.
13. **One tap, one animation.** A tap reveals one sub-step and plays it once on the stage
    (#2566, "One tap"). A tap while that animation runs finishes it and does not advance
    (#2573). Never on a cold load, a return visit, a poll or a force-reveal.

All of this runs inside the `SealBox` reveal render function (ADR-0001, ADR-0002), up to the
reader's cursor.

## Not decided here (wireframe questions, #2568)

The control's words, the pitch button's place and look, how a sub-step looks on the stage,
and how a mid-at-bat event card looks. Each must keep decisions 3 and 4.

**Amended 2026-10-26 (Gary, the control's words):** the advance control reads "Next play ›"
in at-bat mode and "Next pitch ›" in pitch mode. Within a mode it never changes (decision 3).
The words change only when the reader flips the At-bat | Pitch switch, which reveals nothing (#2570).

## Consequences

- One cursor serves both modes, so a reader can switch mid-at-bat without a second model.
- Pitch mode makes an at-bat take several taps. A long one takes ten or more.
- The sub-step model needs a test that no result value is in the list before the result's
  sub-step, and a test that a 1-pitch and a 9-pitch at-bat give the same sealed height and
  label (#2570, #2571).

## What was not checked

A runner thrown out on a pickoff mid-at-bat in a live game (gamePk 824951 was named for a
pickoff caught stealing; not re-read here), a balk, and a disengagement violation (gamePk
824951 has one, an `action` event: *inference*, it is a baserunning event and gets a tap).
Pickoff ATTEMPTS that retire nobody: *inference*, they are not stops.
