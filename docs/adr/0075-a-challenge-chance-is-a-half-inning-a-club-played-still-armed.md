# A challenge chance is a half-inning a club played still armed

**Status:** Accepted
**Date:** 2026-09-16

## Context

The ABS report asks which innings draw the most challenges. The rows on file
answer it directly, and the answer is dull: across MLB the ninth inning drew
1,224 challenges and the eighth drew 1,157, so the appetite looks flat all night
and sags a little at the end.

That reading is an artefact of the denominator, in two separate ways.

**Not every game reaches the ninth, and in half of the ones that do the home
club never bats.** A count that divides by "games" treats the ninth as though it
were offered as often as the first. It is not. The season's own ledger says the
ninth offers about 64% of the half-innings the first does.

**A club that has lost two challenges cannot ask at all.** By the ninth a large
share of the league is holding nothing, so its silence is the rulebook rather
than a decision. Counting those clubs in the denominator scores them as having
declined an opportunity they never had.

Correct for both and the answer inverts. Per hundred chances MLB runs **10.20 in
the first against 21.04 in the ninth** — the appetite MORE THAN DOUBLES, and the
raw count hides half of that rise because the chances disappear at the same time
the asking climbs. The share won falls the other way over the same span, **61.2%
to 40.5%**. Clubs ask more as the game gets late, and are right less often when
they do. Triple-A gives the same shape: 10.44 to 23.10, won 58.3% to 41.5%.

## Decision

**A chance is one half-inning a club played while it still held a challenge.**

Both clubs are exposed in every half-inning — the batting club through its
batter, the fielding club through its catcher or its pitcher — so a played
half-inning offers two chances, one to each club, and only to a club that is
still armed. The derivation is pure, in `scripts/lib/abs/chances.mjs`, and is
computed at export time like every other split (ADR-0021's rule: the database
stores facts).

Three consequences follow, and each was a choice.

### The ledger stores the game's shape, in three columns

`abs_ingested_games` gains `final_inning`, `bottom_played` and
`scheduled_innings`. Counting half-innings played is impossible without the
length of the game, and nothing else on file carried it.

`bottom_played` is written from the **presence** of the last inning's
`home.runs` key, never from its value. A home club retired in order carries
`runs: 0`; a home club that never batted carries no `runs` key at all (verified
on gamePk 824872 against 823413). A reader that tested `home.runs > 0` would
drop every scoreless home half in the season.

### `--recheck` fills them, rather than a new backfill mode

`--recheck` already re-reads the schedule over a window, with the same endpoint,
the same window loop and the same `officialDate` dedup, to evict a game that
stopped being Final. Adding `&hydrate=linescore` to that one call hands it
`currentInning`, `innings[].home.runs` and `scheduledInnings` at no extra
request and no refetched feed. So the nightly self-heals the game's shape the
same way it already self-heals a game's status, and a separate
`--backfill-innings` mode would have been a second pass over identical rows. The
whole season backfilled in two calls.

The ordinary sweep writes the same three columns off the game feed it is already
reading, so a new game costs nothing either.

### Extra innings start at `scheduled_innings + 1`, not at the tenth

A club that has run out is armed again in extra innings (ADR on the bank;
`scripts/lib/abs/bank.mjs`). `FIRST_EXTRA_INNING` was the constant 10, which is
right for every MLB game and **wrong for the 171 seven-inning Triple-A
doubleheader games on file**, where extras begin at the eighth. 22 of them went
past the seventh.

Nothing shipped was wrong before this change, because `replayBank` was only ever
called *without* a length and so topped a club up solely at innings it really
challenged in. The chances denominator passes a length on every game, which is
exactly what breaks that: replaying those 22 games at their real length asks
about innings the club never challenged in, and without the scheduled length the
model calls a club unarmed in the eighth **15 times** when the rule has just
re-armed it. Hence the third column, and `firstExtraInning(scheduledInnings)` in
place of the constant.

### One denominator, and it is the club's

The inning cut is crossed with role on the **same club chances**, not on a
role's own share of them. A batter can only challenge in his club's batting
half, so his own opportunity is half the club total — and a panel drawn that way
sums to exactly twice the club rate, which reads as though catchers alone
out-ask the whole club they play for. On the club denominator the three roles
add back up to the club figure, which is pinned by a test.

### A game with no length is dropped, and the count is shipped

A game swept before these columns existed has `final_inning` NULL, and treating
a NULL as a game of nought innings would shrink every denominator and inflate
every rate. Such a game is dropped from the chances denominator instead.

The count is carried in the export as `chancesGamesDropped` rather than printed
by the generator, so the page can say *every game counted* instead of printing a
drop figure that reads as data loss. It is **0** today and expected to stay
there: `--recheck` backfills the columns, and the 23 games that fell outside a
schedule sweep in testing were the cancelled Triple-A games that no longer sit
on the ledger at all. The guard stays because the class of row can recur; it is
expected to fire on nothing.

## Consequences

- `challenges per inning` is shipped with its denominator beside it
  (`chances`, `perChance`) rather than as a bare count, so no surface can draw
  the misleading version by accident.
- The three new columns are NULL on any game swept before this change and are
  filled by the next `--recheck`, which the nightly already runs. No
  `--rebuild`, and no feed is refetched: the dump's INSERT statements name their
  columns, so an old dump replays into the new table unchanged.
- `replayBank`, `bankHolds` and `armedAt` take a third argument, the scheduled
  length. A caller that omits it gets the nine-inning answer, which is right for
  every MLB game and wrong only for a seven-inning game it did not identify as
  one. `auditBank` deliberately still passes nothing, which only makes it
  stricter.
- The figures here move as the season runs. They were measured on 4,418 games —
  2,269 MLB and 2,149 Triple-A — as of 2026-09-16.
