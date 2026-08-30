# Widening the ABS challenge gate (issue #957)

Working notes for the change that replaced `gameHasAbs`'s `sport.id === 1`
allowlist with a read of the feed's own `gameData.absChallenges` key. The
decision and its spoiler footing are ADR-0068; this file is the measurement
trail behind it, including one wrong turn worth knowing about.

## The probes

Run any of them with `node .scratch/abs-aaa-gate/<file> [args]`. They hit the
live MLB Stats API, so results drift with the season.

| file | question it answered |
|---|---|
| `probe.mjs <pk...>` | Does a Triple-A feed carry challenges in the shape `challenges.js` already parses? **Yes** — same `MJ` `reviewDetails`, same two locations. |
| `probe2.mjs <pk>` | Where does each review sit, play level or pitch event? Both, and **sometimes two in one play** — which became issue #963. |
| `probe3.mjs <sportId> <dates...>` | How many challenges can one club FAIL in regulation? Caps at 2 at every level, so `START_CHALLENGES = 2` holds below MLB. |
| `probe4.mjs` | Do levels below Triple-A carry any `MJ` review? Double-A and High-A: none at all. Single-A: some. |
| `probe5.mjs` | Which Single-A league were those in? The Florida State League. |
| `probe6.mjs` | Is there a `gameData` flag naming the system, so the gate need not read a level? **Yes — `gameData.absChallenges`.** This is the finding the whole change rests on. |
| `probe7.mjs` | What does that key mean? `hasChallenges` is "at least one has been used", NOT a system flag — so the gate must read PRESENCE, never that field. The key is present pregame at every level that runs the system. |
| `probe8.mjs` | Does the extra-inning refill hold below MLB? Yes: 3 failures appear only in games past the 9th. |
| `venue-crosstab.mjs [dates...]` | Added afterwards — see below. Cross-tabulates "has the key" against "has real `MJ` reviews", grouped by venue. |

## The wrong turn

The sweep behind the first draft concluded that the key is "present on exactly
the games that run the system and absent on every game that does not". That is
false, and the way it was measured is why.

**The sweep counted challenges only inside games that already had the key.**
It grouped by level, asked "of the games with the key, how many have `MJ`
reviews", and found no disagreement. Games with reviews and no key were
skipped before anything was counted, so the one class of miss that matters —
a real challenge the gate would hide — was invisible by construction. The
FSL games missing the key were even printed, and read as correct.

`venue-crosstab.mjs` is the corrected method: group every Final game by VENUE
and count both directions, including `MJ`-but-no-key. It finds the hole
immediately.

```
venue                                  games  key    MJ   MJ-but-no-key
Roger Dean Chevrolet Stadium               8     8    35        0
TD Ballpark                                8     8    37        0
George M. Steinbrenner Field               7     0    30        7   <-- issue #964
Lee Health Sports Complex                  5     5    20        0
Jackie Robinson Ballpark                   5     0     0        0
Publix Field at Joker Marchant Stadium     5     5    11        0
Clover Park                                3     3    15        0
LECOM Park                                 2     2    14        0
BayCare Ballpark                           1     1     5        0
```

The key is reported per **venue**, not per league. Steinbrenner Field runs the
challenge system without reporting a bank, so the gate hid a row that should
show. Jackie Robinson Ballpark is the honest opposite: no key, no challenges,
and it has to keep showing nothing.

**Do not "fix" this by widening the gate to include an `MJ` scan.** That reads
play data to decide whether the row exists, which leaks a bit about unrevealed
innings. ADR-0068 has the argument, and `challenges.test.js` fails if anyone
tries it.

Fixed instead by `ABS_VENUE_IDS` in `challenges.js` — a venue allowlist, since
`venue.id` is in `gameData` pregame exactly like the key (issue #964). Rerun
`venue-crosstab.mjs` to re-derive the list; Steinbrenner (venue `2523`) was the
only park at any level.

## What the gate does and does not claim

Exact at MLB and Triple-A, which is where this row is read and what #957 asked
for: 89/89 MLB and 95/95 Triple-A Final games carried the key across six dates
spanning the season, and all 125 Double-A, High-A, Carolina and California
League games carried neither key nor review. Below that the key alone is a
strong heuristic, and `ABS_VENUE_IDS` covers its one known hole.

## Loose ends

- **#963 / #965 — both fixed.** `challengesForPlay` returns a LIST and counts
  every ABS review, `MJ` and `MZ` alike. Two beliefs had to go: that a play
  carries at most one challenge, and that a play-level `reviewDetails` mirrors
  a pitch-level one (gamePk 816935 play#12 disproves it — identical club,
  outcome and player, and the bank counts both). Derived now matches the feed's
  own bank in 209 of 210 games sampled; the holdout, 820476, omits a challenge
  its own box-score note lists.
- `scripts/gen-abs-challenges.mjs` still sweeps MLB and Triple-A only. The FSL
  runs real challenges and is not in the season aggregate; adding it needs a
  backfill and a report page that splits one sportId into two populations.
