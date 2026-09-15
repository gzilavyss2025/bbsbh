After a challenge goes a club's way or against it, does it challenge again sooner? Derivable from rows plus `seq`, but **only honestly if the rulebook is held constant**, and the depth of this issue is that control.

Measure in innings elapsed until the next challenge, both ways: the same PLAYER's next challenge, and the CLUB's next.

## The confound, which produces a false finding if skipped

After a failed challenge a club has one fewer in hand, and after two it has none. It therefore challenges less afterwards **by rule**, not by nerve.

Counted straight, the season on file says: after a win 8.20 per 100 half-innings left in the game, after a loss 7.08 — a 16% drop that looks like a psychological effect and is entirely the rulebook.

Held equal — the club's SECOND challenge, exactly two called, exactly one in hand, so the only difference is how the last one went — it is **8.30 after a win against 8.63 after a loss**. The gap closes and tips the other way. Triple-A held the same way gives **9.51 against 8.91**, the same size and the opposite sign. Two independent leagues that disagree on the sign have not found an effect.

At player level the same strict control gives 2.91 against 2.55 in MLB and 3.53 against 2.72 in Triple-A — one to two standard errors, suggestive at most. Report it as that, not as a result.

## What to build

- Censoring handled by rate, not by averaging a wait: `next challenges / armed half-innings remaining in the game`, which needs the `final_inning` column from the chances issue
- Both the naive cut and the controlled cut, because showing them side by side is the point
- Both levels
- Do NOT add a per-club split. 1,291 reviews over 30 clubs is 43 each against an effect of 0.4 per 100. That is manufacturing noise

## Acceptance

- Derivation in `scripts/lib/abs/export.js`, stratified by challenges in hand and by how many the club has called
- Tests: a club that never challenges again, a club emptied by the event itself (excluded, since no next challenge is possible), and the strict-control cell selection
- The caveat ships with the number **whatever the result turns out to be**
