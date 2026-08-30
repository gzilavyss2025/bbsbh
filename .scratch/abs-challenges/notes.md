# ABS Challenges report page — working notes (issue #938)

What was built, what the season's first backfill found, and the three things
about this feed that are not obvious from reading it.

## The pipeline

- `scripts/gen-abs-challenges.mjs` — the sweep. Append-only over newly-Final
  MLB (sportId 1) and Triple-A (sportId 11) games, SQLite-backed
  (`abs-challenges` group, ADR-0021). Nightly on `--days`; the season backfill
  was `--since=2026-03-26`.
- `scripts/lib/abs-challenges.mjs` — the pure half. One feed to rows, and rows
  to `public/data/abs-challenges.json`. Unit-tested in
  `test/abs-challenges.test.js`.
- `src/api/around-the-game/absChallenges.js` — the reader (ranking + sample
  floors only).
- `src/screens/around-the-game/AbsChallengesPage.jsx` — `/abs-challenges`,
  filed under "This season" in the menu.

## The 2026 season, as of 2026-08-27

| | MLB | Triple-A |
| --- | --- | --- |
| Games swept | 2,010 | 1,933 |
| Games with a challenge | 1,985 (98.8%) | 1,899 (98.2%) |
| Challenges | 8,316 | 8,455 |
| Overturned | 4,468 (53.7%) | 4,356 (51.5%) |
| Per game | 4.14 | 4.37 |
| Run expectancy put back | 797.1 | 807.0 |

By who called for it (MLB): batter 3,787 at 48.8%; catcher 4,375 at 58.5%;
pitcher 154 at 39.6%. Triple-A runs the same shape a little lower: batter
45.4%, catcher 57.6%, pitcher 37.5%. **The catcher is the best judge of a
pitch in baseball and the pitcher is the worst**, at both levels, and the gap
is about twenty points.

Clubs ran out of challenges in 1,008 MLB games, 329 of them before the seventh.
Club success rates span 46.0% to 62.8%.

## Three things about this feed

1. **On a SUCCESSFUL challenge the feed rewrites the pitch to the corrected
   call.** Garrett Mitchell's overturned strike in gamePk 823036 prints as
   `code: 'B'` with a four-ball count after it; Kyle Hayes's overturned ball in
   815863 prints as `code: 'C'`. So the printed call is the umpire's own only
   when the challenge failed. Reading it as his puts every batter in the
   catcher's column, and the two splits would have come out as exact mirrors
   with the labels swapped — which looks perfectly plausible on a chart.
   `umpireCallFor` flips it back.

2. **A box-score entry carries the position a man ENDED the game at.** A
   catcher who later moved to first base or to designated hitter reads as
   neither pitcher nor catcher. Twenty-eight real challenges landed in the
   `other` bucket that way on the first backfill — Iván Herrera and Samuel
   Basallo among them. The rule closes it: only three men may ask for a review,
   so a challenger from the fielding side who is not the pitcher is the
   catcher. After the fix, `other` holds one row league-wide, a challenge the
   feed attributes to no player at all.

3. **Role and call type are one fact, not two.** A batter may only challenge a
   called strike; a catcher or a pitcher only a called ball. Across 16,771
   challenges the two splits agree exactly, which is worth knowing before
   anyone builds a second chart of the same numbers. `callSplitAnomalies` in
   the reader exists to surface the day that stops holding rather than to
   assert it silently.

Two smaller ones. `runsToChallenger` comes out within a run of `runsRecovered`
(796.4 against 797.1 in MLB) rather than exactly equal — the handful of
exceptions are the run-expectancy table's own per-count noise, not a challenge
that hurt the club that called for it. And the biggest single overturn is the
identical figure at both levels (1.809 runs), because `pitchFavor` is a pure
table lookup: any overturn out of the same base-out-count state is worth
exactly the same, so the ceiling is a property of the table and ties are
expected. The tie breaks on the later date.

## Verified against

- gamePk 823036 (MLB, four challenges, two at each review location).
- gamePks 815863 / 816463 / 816544 (Triple-A, three, three and four) — the
  issue's own check that Triple-A carries real `MJ` reviews, confirmed here.

`probe.mjs` in this directory is the throwaway that dumped a game's challenges
with the pitch, the count and the box-score position beside each; `shot.mjs`
drives the page at phone and desktop width and prints what rendered.

## Left alone, deliberately — since resolved

`gameHasAbs` in `src/api/challenges.js` gated the LIVE box-score row on
`sport.id === 1`, so Triple-A box scores showed no challenge row even though
their feeds carry real challenges. Out of scope here (a live-UI change with its
own spoiler footing); flagged for its own issue, and fixed there — issue #957
replaced the level check with the feed's own `gameData.absChallenges` key.
