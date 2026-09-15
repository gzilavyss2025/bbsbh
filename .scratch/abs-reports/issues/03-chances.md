The report's second question is "which innings draw the most challenges". A raw count by inning misleads twice: not every game reaches the ninth, and a club that has lost two challenges cannot call for one at all. Later innings look quiet partly because the CHANCES are gone.

Measured on the season already on file, the correction changes the answer. Raw counts say the ninth (1,216) barely beats the eighth (1,151). Per chance it runs **10.20 in the first to 21.36 in the ninth** — the appetite more than doubles, and the raw count hides half the rise.

## The missing fact

`abs_ingested_games` has no final inning, so there is no way to count half-innings played. Two new columns:

- `final_inning` INTEGER — the game's last inning
- `bottom_played` INTEGER — 1 when the bottom of that inning was batted, 0 when the home club did not need it

At sweep time both come from the feed already being read (`liveData.linescore.currentInning`, and whether the last `innings[]` entry carries a `home.runs`). **No extra fetch for a new game.**

For the 4,412 games already on file, add a `--backfill-innings` mode that reads them from `/api/v1/schedule?...&hydrate=linescore` — about one call per week per level, roughly 50 calls for the whole season. **No game feed is refetched.** Verified against the live API: a Final game with `isTopInning: true` has no `home.runs` on its last inning, which is how a skipped bottom half is told from a played one.

23 of 2,158 Triple-A ledger rows fell outside a schedule sweep of the same window in testing. Leave a game with no `final_inning` OUT of the denominator rather than guessing it, and have the export say how many it dropped.

## The derivation (in `scripts/lib/abs/export.js`)

A **chance** is one half-inning a club played while it still held a challenge.

- Inning i, top half is played when i is at most `final_inning`; the bottom when i is below it, or equals it and `bottom_played`
- A club holds a challenge until its SECOND failed challenge. Count fails strictly before the half in question
- Both clubs are exposed in every half-inning: the batting club through its batter, the fielding club through its catcher or pitcher

Cross it with role for the same cut. **Keep one denominator.** A batter can only challenge in his club's batting half, so his own opportunity is half the club total — but a panel drawn on that denominator sums to exactly twice the club rate and reads as though catchers alone out-ask the whole club. Ship the role rates on the CLUB denominator so the three add up to the club figure.

## Acceptance

- New columns, the backfill mode, and the export cut, with the derivations pure in `scripts/lib/abs/`
- Unit tests in `test/abs-challenges.test.js`: a game that ends on a walk-off (bottom half short), a game whose home club never batted in the ninth, a club that emptied in the third, and the sum check that role rates add to the club rate
- An ADR for the denominator choice and the dropped-games rule. Highest taken is **0073**; `scripts/check-adr-numbers.mjs` guards collisions
- `docs/scripts/generators.md` (lines about 217-245) updated with the new mode
- statsapi calls need the Bash sandbox off (`dangerouslyDisableSandbox`), and one retry on a connect timeout
