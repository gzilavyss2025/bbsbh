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

**Amended (a steal belongs to the batter at the plate; a reliever's first batter repeats his card).**
Two corrections, both from scoring along in focus mode, where the page is one at-bat.

- *A baserunning event during a plate appearance leads THAT at-bat.* A steal is not an
  announcement made once the earlier batter was retired: the runner goes while the next batter
  is up. The feed still nests it before that batter's first pitch, which read as "trailing the
  previous at-bat", so "Next at-bat" put a steal on the page of a batter who had nothing to do
  with it. Such a note is now always `midAtBat`. And `focusWindows` had never honoured that flag:
  it closed every window at the next at-bat, so even a between-pitches note trailed the PREVIOUS
  page. A window now closes at the first `midAtBat` note in the run before the next at-bat,
  which is the split `nextStepBoundary` already made between taps. Counts of windows are still
  counts of at-bats, so the stability rule above is unchanged.
- *The change card stays where it is, and is repeated.* A pitching change made between plate
  appearances still trails the at-bat before it — that is what tells the scorer who comes in.
  Windowed, the page holding his first batter opens with the same card ("Pitching for…",
  `windowReliefPitcherId`), because that page otherwise never names him. Not repeated while
  stacked (change then batter is already adjacent), nor for a change between pitches (it leads
  its own window), nor for the half-opening change (the persistent "Now pitching" card's).
  Nothing new is revealed: the change is under the cap.
- *Every trailing notice repeats, marked (2026-10-08, #1756 and its follow-up).* A pinch
  hitter, a defensive change, a pinch runner, a mound visit, an ejection or a delay trails the
  previous at-bat the same way, so the next batter's page opened with no word of it either.
  `windowLeadIn(entries, wins, i)` now returns every managers' notice that trailed the previous
  at-bat inside window i-1, in feed order, pitching change included, and a windowed `PlayByPlay`
  draws them first. A standalone play between batters (a pickoff or a balk with no pitch) is a
  scored play, not a notice, and is not repeated: a second copy invites logging the out twice. It replaces the `reliefPitcherId` stamp and `windowReliefPitcherId`. Read off the
  window bounds, it splits where the windows split: a `midAtBat` note, and every note after
  it, is already in window i, so it is not repeated (a second walk in `computeHalfInningFeed`
  had reset at that note, which repeated the notes after it and dropped the ones before). Each
  repeat carries an "Earlier" tag, because a scorer can log a second mound visit from an
  unmarked copy. The pitching change repeats as the short "Pitching" card (the plain note if
  the arm does not resolve), not the full card and departing line again. Spoiler footing is
  unchanged: window i exists only when its at-bat is under the cap, so window i-1 is wholly
  under it, and every repeat is under the cap. That is the whole promise. A repeat was usually
  drawn a tap ago, but not always: a note that reached the feed after that tap, or a window
  that "Rest of half" skipped, was never drawn. Stacked halves and window 0 repeat nothing.

The steal, caught-stealing and pickoff cards also say which pitch of the at-bat they came on
("Pitch 3"; a pickoff, a throw between pitches, says "After pitch 3"). The count is the pitches
before the event in the play's own `playEvents`, or the whole play's for an event the feed
folded into `runners[]`. That order is inferred from a three-day MLB sample (2026-09-25..27:
49 of 49 events after at least one pitch), not documented by MLB.
