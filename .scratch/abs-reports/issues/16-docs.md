The written report is half the job. There is no `docs/abs-challenges.md` today; this issue writes it.

It holds the answer to each of the seven questions in plain words with the real numbers, and every caveat stated out loud. A finding that survives its caveat is worth more than five that were never tested against one.

## What it must carry

1. **Umpires** — the spread (3.13 to 5.40 a game in MLB against a 4.18 league rate), the 15-game floor and why a floor is needed, and why this is not the `/umpire-rankings` figure.
2. **Innings** — the raw shape, the corrected shape (10.20 to 21.36 per chance), and **the denominator problem in full**: not every game reaches the ninth, and a club out of challenges cannot call for one. How the final inning is sourced, and how many games were dropped for want of one.
3. **Ran out** — the band, the size of the tie pile (9 clubs in the first, 18 in the second, 47 in the third), the tiebreak, and why a top 10 would have been arbitrary.
4. **Streaks** — the season and in-game boards, the small-sample caution (10 of 14 against 16 of 88), and the rulebook cap of 2 on an in-game loss streak.
5. **Baselines** — one every 40 plate appearances, one every 8 innings caught, the spread that shows the mean describes nobody, and **the catcher denominator**: statsapi counts no pitches received, so the figure is innings caught and the two rates are not comparable.
6. **The scatter** — what it shows, the traded-player attribution, and whether Triple-A is worth drawing.
7. **After a win, after a loss** — the naive result, the control, the reversal, the Triple-A replication with the opposite sign, and the conclusion that the apparent effect is the rulebook.

Also: the API facts worth not rediscovering — the roster hydrate that matched 100% of MLB rows, the per-club stat splits for a traded player, the schedule linescore hydrate for final innings, and that no feed anywhere counts pitches received.

## Acceptance

- `docs/abs-challenges.md` written, and linked from `docs/scripts/generators.md`
- Check whether the nested `CLAUDE.md` in `src/`, `src/api/`, `scripts/` and `test/` went stale. Root `CLAUDE.md` is capped at 200 lines — add a pointer at most, never prose
- ASD-STE100, and "postseason" never "playoffs" (`check-word-choice` gates it)
