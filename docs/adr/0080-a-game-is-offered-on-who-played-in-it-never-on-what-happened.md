# A game is offered on who played in it, never on what happened in it

**Status:** Accepted
**Date:** 2026-09-18

## Context

ADR-0079 put a real page in the four minor levels' empty games area and left one
thing out of it: the card the design study leads with, *a verified, scoreable
game from the season just finished, carrying its own reason line*. That card is
the point of the whole page. A scorer in December does not want a highlight reel
or a standings table; they want a game and a blank sheet, and at High-A alone
there are 1,881 played games from 2026 that nobody has opened.

Two questions had to be answered before it could exist, and both of them are
about trust.

### Can the page promise the game is scoreable?

Not from a schedule row. A minor-league schedule reports `"Final"` for **every
row of a 1,980-game High-A season**, postponements included — the same trap
issue #1031 recorded for the slate. Probe 1b measured the other direction and
found the feeds themselves are excellent (135 of 135 sampled games complete
across all four levels), but "almost always fine" is not what a card that says
*score this game* is promising. A dealt game with a thin feed is a dead end at
the exact moment the page asked for a tap.

### May the card say why THIS game?

It has to. A uniformly random game can be ordinary, and the design study named
that as the concept's one weakness. But every obvious answer to "why this one"
is a result: a close finish, a comeback, extra innings, a slugfest. Dealing on
any of those would make the pool a ranking of games by drama — the page reading
the result it refuses to show, and telling the reader about it before they have
scored a pitch (`research.md` §5.6).

## Decision

**A game enters the pool only if its own feed says the scoring flow can carry
it, and the card explains the game only with facts about the CAREERS in it.**

### The pool is checked, once, and stored

`scripts/gen-milb-pool.mjs` writes `public/data/milb-pool/{11,12,13,14}.json`:
120 games per level from the most recent season that is over. Each candidate
costs one request — the live feed trimmed with `fields=` from 686 KB to 17 KB —
and that one response answers the whole gate:

```
plays      every play placed in an inning and a half   InningViewer's spine
lineups    nine in each batting order                  the page the card opens on
pitchers   at least one a side                         the Pitchers table
```

It demands nothing else. Not nine innings (a seven-inning doubleheader game is a
real game), not a bottom ninth, and not pitch tracking — there is none at AA or
A+, in 0 of 85 sampled games. It fails closed: a game that cannot be read is not
offered.

Whether a game was PLAYED comes off the game's own linescore, hydrated onto the
one schedule call, never off the status string.

**The pool is frozen per season.** A completed season's games do not change, so
the expensive half runs once — the night the level's winter opens — and the
nightly run after it re-joins the reason lines with no network at all. That is
why `milb-pool/` is an exception in `check-data-freshness.mjs`: an unchanged file
is the healthy state here, not a missed night.

### The file carries nothing that could say how a game went

No score, no run total, no winner, no decisions, and **no inning count** — an
inning count is a spoiler in its own right (ADR-0008: extras never show up
front). An entry is two clubs, a date, a park, and counts of careers.

This is the first static dataset in the repo built by walking finished games, so
the spoiler rule here is a property of the FILE rather than of a `SealBox`. A
generator that quietly started copying `linescore` would break nothing and
render nothing and spoil everything. `test/milb-pool.test.js` therefore reads
what is committed and asserts the vocabulary positively — an entry may hold
`pk`, `date`, `g`, `venue`, `away`, `home`, `why` and nothing else — and then
re-asks the question of every key at every depth.

### The reason line counts careers

Four facts, in order of what a reader can do with them, all of them true before
the first pitch and still true whoever won:

| | |
| --- | --- |
| a name off the national prospect board | `Jesús Made played in this game, No. 1 on the national prospect board.` |
| players who reached the majors | `2 players in this game reached the majors.` |
| players on any prospect board | `6 ranked prospects played in this game.` |
| players who finished the season higher | `4 players in this game finished the season at a higher level.` |

A NAME outranks a count: "Jesús Made played in this game" is a reason to open it,
where "six ranked prospects" is a statistic about it.

**The line the issue specified is the third-best one, and measurement is why.**
Issue #1077 named the alumni join — "7 players in this game reached the majors",
from `milb-alumni/{teamId}.json` — as the reason line. Measured against a
just-finished season it returns **zero, in every game**, and structurally so: an
alumnus is a player with 20+ games for the club who then reached the majors and
accumulated real career WAR, which nobody from last summer has had time to do.
The fact is kept and will start firing on its own as those careers happen (the
join is re-run nightly against a frozen pool), but the prospect boards are what
carry the line today: 80 of 120 High-A games have a national-board name in them.

## Consequences

- The offseason page's cost is unchanged for the reader: one static file per
  level, ~39 KB, beside the promotions board it already reads.
- The card links to the game's ordinary lineup address, so the game opens sealed
  under the same `revealedThrough` mark as any other. Nothing about the card
  reveals, consents or persists.
- One game per day per level, and "another game" walks a fixed deck. The pick is
  seeded on the viewed date and the level rather than `Math.random()`, so a
  re-render — or StrictMode's second mount — cannot deal a new game under the
  reader, and two tabs on the same slate agree.
- A game this device has already opened is not offered as a fresh one; the pool
  is filtered against the reveal marks in local storage. A reader who has opened
  all 120 still gets an offer, and it says "your progress applies" instead.
- The pool is one season deep. A reader browsing back to an older winter sees the
  promotions list and no card, because the file names its season and the page
  checks it — the same fail-closed check the board beside it makes.
- An older season's pool watches its prospects graduate off the board. Measured
  on Triple-A 2025, 50 of 120 games have no fact left at all, and those show the
  game with no reason line rather than an invented one.
