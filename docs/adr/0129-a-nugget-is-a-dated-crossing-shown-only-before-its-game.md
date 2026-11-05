# A nugget is a dated crossing, shown only before its game

**Status:** Accepted for v1 (#2809, Gary's triage 2026-11-05). The `plainMax` values are not yet approved.
**Date:** 2026-11-05

## Context

Issue #2809 pairs a season count with a number a general reader already knows: "One of 11
pitchers with a shutout, fewer than the 12 people who have walked on the moon." Gary decided
(2026-11-03) that such a note is a moment in time: it is true on the day it is minted and stays
accurate as of that date. The long-form design is `.scratch/anchor-callouts/spec.md`.

A counting stat only goes up. So once a player meets a line, he has met it for good, and the one
fact worth storing is the day he first met it. The count on any past day is then the number of
such days up to it. A daily snapshot would repeat itself and could not answer "when did he cross?"

## Decision

- **The store is `public/data/nuggets/{season}.json`**, one append-only file per season, written
  nightly by `scripts/gen-nuggets.mjs` (behind the `finals` input gate). A nugget is
  `{ player, date, count, anchor, relation }` under its threshold id. `count` and `anchor` are
  frozen when it is minted; a later registry change never rewrites an old note. The crossing date
  comes from the player's game log, so a late run loses nothing, and a second run adds nothing.
- **Thresholds and anchors are data in code**: `src/lib/nuggets/thresholds.js` (regular-season
  counting stats, one season, MLB only) and `src/lib/anchors/anchors.json` with the pure picker
  `pick.js`. The generator and the app import the same files.
- **The date is the spoiler.** A nugget dated D says the player did something on D. On a scoring
  surface only nuggets dated strictly before the game's own date may come back (entering tense,
  ADR-0014, ADR-0088), and only those from the 7 days before it. The cut is in the reader,
  `nuggetsForGame` in `src/api/nuggets/nuggets.js`, not in its callers, and `test/nugget-notes.test.js`
  fails if a nugget dated on the game's own date reaches Between Innings.
- **Only the top-ranked nugget on a card gets its anchor.** The rest show as plain counts, and a
  plain count shows only at or under its threshold's `plainMax`. A nugget shows once a game
  (`ONCE_PER_GAME_KINDS`), and the anchor goes to the top one this reader has not seen yet.
- **The sentence reads the anchor as it is on the game's date.** The relation ("fewer than", "as
  many as") is worked out from the anchor's current count, and an anchor no longer verified or
  past its re-check window is dropped, so a note never contradicts itself. The stored `anchor` id
  is the pick frozen at mint; the stored `relation` is the record of that day.
- **A crossing dated today waits.** The generator mints only crossings dated before the baseball
  day (US Pacific), so a same-day crosser seen on a later run never leaves a frozen count short.
  A game log that fails to load holds its threshold for the night and fails the step.
- The first surface is Between Innings (the Gameday checkpoint's Notes page), for the two
  announced starters and the hitters due up next half (`selectDueUpNow`, which gates itself).

## Consequences

- A scoring correction after the fact can leave a stored count off by one. Accepted: the note was
  true to the data that day.
- The player page may show every nugget (an open surface, ADR-0034). That list needs a wireframe
  first and is not v1. Postseason lines, streaks and longer spans are later slices.
- A volatile anchor drops out of `pick` 180 days after its last check. A test lists the late ones
  and never fails on a date.
