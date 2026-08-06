# 03 — ABS challenges + handedness split (generator + backfill)

Status: `needs-triage`
Phase: 2
Blocked by: 02

The two bands of the reference graphic that need data not currently on disk.
Both are cheap additions to a walk `gen-umpire-accuracy.mjs` already performs —
but both need the season re-swept, so **they land as one schema bump and one
backfill**, not two.

**Do not start this before issue 02 is merged.** Bundling a UI review with a
multi-thousand-request data migration serves neither.

## Generator change — `scripts/gen-umpire-accuracy.mjs`

### ABS challenges

`computeGameAccuracy()` already iterates every play and every `playEvent`. Add a
tally, using `src/api/challenges.js`'s already-verified rule:

- A review counts only when `reviewDetails.challengeTeamId != null` **and**
  `reviewDetails.reviewType === 'MJ'`.
- Check **both** locations — `play.reviewDetails` and
  `playEvents[].reviewDetails`. About half of real challenges appear at only one
  of them (verified against gamePk 823036; `challenges.js`'s header has the
  case-by-case detail).
- Dedupe a mirrored review so one challenge counts once.
- The `MA` reviews are MLB's older manager's-replay system and **must be
  excluded** — they also set `challengeTeamId`, so a `challengeTeamId`-only test
  silently inflates every count.

New per-game row fields: `challenges`, `challengesOverturned`.

Attributing them to the plate umpire is correct and is the point: a challenge
overturns *his* call.

Extend `aggregate()` to sum both, and null them (rather than zero them) for rows
predating the schema — the same degrade pattern the cell arrays and
consistency/favor already use. A pre-schema row and a game with genuinely zero
challenges must not become indistinguishable.

### Handedness split

`missRegion()` already takes `batSide` and already flips the horizontal for a
left-handed batter. Add parallel region tallies keyed by batter side —
`missL: {high, low, inside, outside}` and `missR: {...}` — alongside the existing
combined counts. Keep the combined tallies; issue 01's `umpireWatchArea` reads
them and must keep working through the migration.

## Backfill

```
node scripts/gen-umpire-accuracy.mjs --since=<opening day> --sports=1
```

~3,300 feed fetches. This is the documented path the file has already been
through once (when the 3×3 cell grid was added, per the generator header).
`--sports=1` keeps the immutable AAA rows out of the sweep.

**Run it by hand, commit it as a data-only push, and confirm before starting.**

## Then the card gains

- **`CHALLENGES/GAME`** — `challenges / games`.
- **`OVERTURN%`** — `challengesOverturned / challenges`, with a league-average
  footnote computed the same way `accuracyIndex`'s `leagueShare` baseline
  already is (pool-wide, from the same qualifying set).
- **Area to Watch gains its handedness clause** — `LOW AND INSIDE TO
  LEFT-HANDED HITTERS` — but only when one side's miss share is far enough above
  the other's to be worth claiming. Same principle as everywhere else here: if
  the split is noise, say the unqualified version.

## Measured baselines (for sanity-checking the output)

Sampled live from real 2026 feeds while scoping:

- gamePk 824484 — 2 challenges, 1 overturned.
- 20 games, Aug 3–4 2026 — **4.50 challenges/game, 57.8% overturned.**

The reference graphic's own footnote reads *"MLB AVERAGE: 54% OF CHALLENGES
OVERTURNED"*. If the backfill produces a league overturn rate far from ~55%, the
`MA`/`MJ` filter is the first thing to check.

## Level note

MLB (`sportId 1`) only for the card. AAA runs the ABS challenge system too and
would produce numbers, but it is a different regime against a different peer
pool — `seasonAAA` stays separate and unblended, per the generator's existing
split.
