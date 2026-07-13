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
`nextStepBoundary` — bundling a leading event note with the plate appearance
it precedes, so one tap reads as "reveal the next batter" not "reveal the
next note") or, once every entry has been shown, `onStepComplete`. That
always collapses into a normal full `revealTo` commit — whether by tapping
through every card or because "Whole {half}" was tapped directly at any
point mid-step — so `revealedThrough`, and everything gated on it, is never
left stuck behind what's actually on screen.

This keeps ADR-0002's "no reveal-the-whole-game bypass, strictly
per-half-inning" and ADR-0001's reveal-only isolation intact: at-bat stepping
changes how a user walks through the one existing half-inning-granular
`SealBox`, not how much the app is willing to commit as revealed at once.
