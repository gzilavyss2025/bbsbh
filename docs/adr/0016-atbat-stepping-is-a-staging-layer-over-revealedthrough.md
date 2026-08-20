# At-bat stepping is a staging layer in front of revealedThrough, not a second spoiler boundary

A sealed half's floating-bar button splits into two side-by-side choices:
"Next at-bat" (reveal just the next plate appearance) or the whole half at
once, so a user can either read a half's plate appearances one at a time or
take the original one-tap reveal — no separate mode preference, the choice is
made fresh each tap.

The temptation would be to make the at-bat cursor (`atBatCountFor`, tracked
in `useRevealProgress`) a second persisted spoiler boundary alongside
`revealedThrough` — but every other gate in the app (`StatBox`,
`PitchersSection`, `RollingLine`, extras-unlock via `unlocked`, the entering
lineup/defense refs) already reads `revealedThrough` exclusively, and those
are whole-half aggregates that can't be partially revealed without leaking
plays the user hasn't stepped to yet (a Statcast "hardest hit" card, a
pitcher's line, a run total).

Instead the at-bat cursor is purely a transient staging cursor for
`PlayByPlay`'s own card list, keyed on whichever half is currently being
shown (not assumed to be "the reveal frontier" — `RollingLine` and direct
links both let a user jump straight to any unlocked half, sealed or not, so
the cursor tracks by half-index and reads back 0 for any half other than the
one it belongs to). Each render inside the seal reports back either the cap
the next "Next at-bat" tap should use (`PlayByPlay`'s `onStepInfo`, via
`nextStepBoundary`) or, once every entry has been shown, `onStepComplete`. That
always collapses into a normal full `revealTo` commit — whether by tapping
through every card or because "Whole {half}" was tapped directly at any
point mid-step — so `revealedThrough`, and everything gated on it, is never
left stuck behind what's actually on screen.

## What one step contains

A step is **one plate appearance plus the announcements that follow it** —
`nextStepBoundary` walks to the next `atbat` card and then keeps going over
the `event` notes trailing it. Not the other way round, and that ordering is
the whole point.

statsapi nests a stoppage at the head of the plate appearance that *follows*
it: in a three-day sweep of the MLB slate, 655 of 678 substitution and
mound-visit `playEvents` sat before their own play's first pitch, and none
trailed after its last. So the notes sitting between two at-bat cards are the
announcements made once the *earlier* batter was retired. Ending a step just
before them stranded a pitching change with the new pitcher's first batter:
one tap produced the change and what it produced, together — the reverse of
how a scorer works, which is finish the batter, pencil the change, then see
who comes up.

The exception is a stoppage that landed **between pitches** of the following
plate appearance (a mound visit during an at-bat — the other 23). That one
genuinely interrupted the at-bat it sits in, so `computeHalfInningFeed` marks
it `midAtBat` and it leads the next step instead of closing the previous one.

Two consequences worth keeping in mind when touching this:

- A step routinely ends **mid-play** — after a play's leading notes, before
  its own at-bat card. `computeHalfInningFeed`'s per-play `visible` gate is
  therefore false exactly when those notes ARE on screen, so any annotation
  that belongs to a *note* rather than to the play's outcome has to key on the
  note's own index instead. The pinch-runner pencil-in on the origin card is
  the live case: without that, "Peraza runs for Schanuel" appears a full tap
  before Schanuel's name is struck through.
- Notes at the head of a half have no earlier at-bat to attach to, so they
  still bundle *forward* into the first step, exactly as every note used to.

This keeps ADR-0002's "no reveal-the-whole-game bypass, strictly
per-half-inning" and ADR-0001's reveal-only isolation intact: at-bat stepping
changes how a user walks through the one existing half-inning-granular
`SealBox`, not how much the app is willing to commit as revealed at once.

**Amended by ADR-0026 (staging cursor is inert while unlocked).** The at-bat
cursor stages a *sealed* half. Under the Scores Unlocked pass every half renders
revealed (`renderRevealedThrough`), so `currentSealed` is false and the split
"Next at-bat / Whole {half}" bar never appears — there is nothing to step
through. The cursor itself is untouched: it keys on the real half being shown
and resumes exactly where it was when the pass is turned off or expires, because
the pass never wrote to `revealedThrough` or the at-bat mark.

**Amended by ADR-0055 (the commit waits for the third out).** "Every entry
shown" and "the half is over" are the same sentence only for a half that has
already finished. On the half the game is being PLAYED in, the entry list is the
half so far, so `onStepComplete` fired as soon as a reader caught up to the live
edge and committed the whole half on the strength of a few batters — after which
every plate appearance that landed arrived already revealed. `stepCommitReady`
now takes a third condition, "the half is not in progress"; a live half reports
`atHalfEdge` instead, and the floating bar drops "Rest of half" for it. See
ADR-0055, which also adds the lineup page's "Catch up to live" button.
