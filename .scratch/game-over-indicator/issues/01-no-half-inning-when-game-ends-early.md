Status: needs-triage

# Innings navigator gives no "game over" signal when a half-inning never happens

## Summary

When the home team wins in the bottom of the 9th (or bottom of the last
regulation inning), that half-inning is never played — there's no bottom-9th
data to reveal. The innings viewer / RollingLine navigator currently has no
visible way to communicate "the game ended here, there is no more to reveal."
From the user's seat this reads like missing data (as if the play-by-play
had been lost), when actually the game is legitimately over.

Reported while reviewing the "improve codebase architecture" refactor work
(see conversation from 2026-07-09) — confirmed **unrelated** to that
refactor (candidates 1+6, 2, 5, and the in-flight 4/3). Nothing in that work
touches game-completion/walk-off logic; this gap predates it.

## Where this likely lives

- `src/screens/InningViewer.jsx` — half-inning navigation (`goTo`, `curIdx`,
  `maxIdx`) and the `RollingLine` run-cell navigator (see CONTEXT.md's
  RollingLine definition).
- `docs/adr/0008-regulation-only-innings-navigator.md` — governs how
  regulation vs. extra innings are unlocked one at a time; a short (walk-off)
  game is the mirror-image case (fewer halves exist than regulation) and
  isn't covered there.
- The MLB Stats API feed likely already exposes enough to detect this (game
  `status` reaching Final short of 9 completed halves, or simply the absence
  of a bottom-9th `allPlays` entry) — needs verification against a real
  short-game `gamePk` before implementing (see `docs/test-games.md`, or find
  a fresh walk-off gamePk).

## What "fixed" looks like

- The RollingLine navigator (or wherever the user would expect a bottom-9th
  cell) shows some spoiler-safe "game over, no bottom 9th" state instead of
  either nothing or an indefinitely "sealed" cell that can never be revealed.
- Must stay spoiler-safe: knowing the game *ended* in the bottom of the 9th
  doesn't by itself reveal the score, but this needs a deliberate design
  pass (see CONTEXT.md's spoiler rule) rather than an ad hoc fix — worth a
  `/grilling` pass before implementation.

## Comments
