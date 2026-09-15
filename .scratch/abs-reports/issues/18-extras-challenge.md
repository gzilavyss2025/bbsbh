Found while building the chances denominator for #1058. The lib's model of the challenge bank is missing a rule, and the missing rule is already visible in the rows on file.

## The rule

`scripts/lib/abs-challenges.mjs` states it in its own header, and `ranOutByTeam` implements it:

> A club is issued two challenges and keeps one every time it wins, so it is out of them after its SECOND loss.

That holds in regulation. It does not hold in extra innings: **a club that has exhausted its challenges is issued another one when the game goes past the ninth.**

## The evidence, from the rows already stored

Club-games carrying a THIRD failed challenge:

| Level | 3+ fails | Game went to extras | Third fail came in extras |
|---|---|---|---|
| MLB | 31 | 31 | 31 |
| Triple-A | 21 | 21 | 21 |

**52 of 52, with none in regulation.** One Triple-A club-game reaches five failures.

Confirmed against the feed's own bank. `gamePk 822685`, a ten-inning game:

```
home: { usedSuccessful: 1, usedFailed: 3, remaining: 0 }
```

One success and three failures cannot come out of a two-challenge bank that is
only kept on a win. The bank was topped up.

## What it breaks

1. **Shipping now:** `ranOutByTeam` treats the second failure as the end of a club's night, so the "Ran out" column on the club board counts a club as finished when it was handed another challenge an inning later. `LAST_EARLY_INNING` reasoning is unaffected (it is about the sixth), but the column's meaning is.
2. **#1058, the chances denominator.** A chance is a half-inning a club played *while it still held a challenge*. The current derivation marks a club unarmed after two failures, which understates the denominator for every extra inning and overstates the rate there.
3. **#1061, the after-a-win cut.** The control is "challenges in hand", computed as `2 - fails`. That goes to zero or negative in extras and puts events in the wrong stratum.
4. **#1060 and #1065, the streak boards.** "Two is the rule, not a record" is true of regulation only. A club that plays extras can lose three, and one Triple-A club lost three in a row inside a single game.

## What to do

Model the bank rather than counting failures:

```
remaining = 2 - fails, floored at 0
if the game reached extra innings, add 1 from the top of the 10th
```

Verify the exact shape against more games before pinning it — this issue establishes that a replenishment happens and when, not that it is exactly one challenge in every case. `gameData.absChallenges` carries `usedSuccessful`, `usedFailed` and `remaining` per club and is the check: a derived bank should reconcile with it on every completed game, and that reconciliation is worth a test of its own across the fixture set.

## Acceptance

- The bank modelled in `scripts/lib/abs/`, with extras handled
- A test asserting the derived bank matches `gameData.absChallenges` for a regulation game and an extra-inning game
- The "Ran out" column's meaning restated wherever it is labelled
- `docs/abs-challenges.md` (#1071) records the rule, since nothing else in the repo does
