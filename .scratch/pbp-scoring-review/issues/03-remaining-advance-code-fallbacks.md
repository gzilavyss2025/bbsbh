Status: needs-triage

# Two advance-code fallbacks still pencil "GO" for something that wasn't a ground out

## What happened

`legAdvanceCode` falls through to `advanceCode(play)`, whose last resort is
`'GO'`. A sweep of every Final MLB game on 2026-07-20 … 24 turned up four
runner-level eventTypes with no `ADVANCE_CODES` entry. Two were correct through
the fallback (`force_out`, `field_out` — genuinely ground/fly outs) and one
(`forced_balk`) is fixed in PR #403. Two remain, both rare, neither with an
obvious right answer:

| runner eventType     | count in 52 games | renders | what it actually was |
| -------------------- | ----------------- | ------- | -------------------- |
| `other_out`          | 2                 | `GO`    | runners advancing on an uncaught third strike the catcher threw elsewhere |
| `caught_stealing_3b` | 1                 | `GO`    | a trail runner taking a base while the lead man was thrown out |

Real case (gamePk 824247, top 1st): *"Isaac Collins strikes out swinging,
catcher Dillon Dingler to pitcher Troy Melton. Vinnie Pasquantino to 3rd."* —
Pasquantino's leg reads `GO⁶`, a batted-ball code on a play where no ball was
put in play.

## Why it wasn't just fixed

Unlike `forced_balk` (unambiguously `BK`), there is no single mark a scorer
would obviously write here. Candidates for the uncaught-third-strike advance:
`K`, `PB`, `WP`, or nothing; for the trail runner on a caught stealing: the
base-taken-on-the-throw, or nothing. Guessing would trade a wrong code for a
different wrong code.

## Where

`src/api/playbyplay.js` — `ADVANCE_CODES` / `advanceCode` / `legAdvanceCode`.
