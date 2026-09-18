# A length is not a result, and a season record is a labelled door

**Status:** Accepted
**Date:** 2026-09-18

## Context

ADR-0079 and ADR-0080 built the offseason home page: a winter read off statsapi's
own dates, the promotions list, and a checked game to score. Step 4 of issue
#1038 adds the last two rows the design study drew — **one notebook note** and
**the season record** (#1078) — and both of them walk up to the spoiler rule
from a direction nothing on this page had taken before.

Everything already on the page is neutral by construction. The roster wire is
moves and dates. The promotions list is careers. The picked game is sealed, and
its reason line counts people rather than runs, which is exactly what ADR-0080
decided. Neither of the two new rows can be built that way.

### A notebook note is about something that HAPPENED in a game

The design study picked *the twelve-pitch at-bats* for MLB: every plate
appearance of the season that ran to twelve pitches or more. It is the right
note for this app — twelve pitches is four lines of a scorebook cell, and it is
the thing a scorer notices that a highlight reel never shows — and it is also
the first thing the offseason page has wanted to say about a specific play in a
specific game.

Issue #1078's own spoiler note allows it, conditionally: *"A report about a
specific result says so before it opens."* So the question was not whether the
note may ship, but whether it is a report about a result at all — and what it
would have to look like if it is.

### A minor level's note cannot be the note that would be easier

The obvious note at a farm level is a rate board: the patient hitters, the
fewest strikeouts, the best month. Every one of them needs a playing-time floor,
and `research.md` §7 records why a floor at a SINGLE level is a trap — it selects
for the players nobody promoted. The best hitter in the Midwest League in May is
in Double-A by July with 180 plate appearances, and a 250-PA board has quietly
dropped him. The board would be headed *the league's best seasons* and be a list
of who stayed.

### A season record is a destination that is already open

Standings and the postseason pages have opened live since ADR-0034 ("the cutoff
is opt-in now"). A season record is nevertheless the one thing on this page that
tells a reader how the year came out, and #1078 asks for it to say so: *"It
opens on a clearly labelled link and does not mark every game or date
revealed."*

And it cannot be built the same way at both levels. MLB has a standings page and
a postseason history. The minors have neither, and the reason the gap is not
closed here is not effort: a minor league qualifies its clubs on HALVES. statsapi
publishes a first-half and a second-half record for all eleven leagues in 2026 —
checked live, and the two halves sum to the full record at every level including
Triple-A — but that establishes that the DATA exists, not that a league seeds its
postseason by it. The published tiebreakers start with head-to-head play within
the half, and the repeated-half-winner case is not settled by the official
procedures page at all. A table Tally drew by sorting full-season wins would be a
confident wrong answer about who got in.

## Decision

**A notebook note may name a game, and must carry nothing the game would have
sealed. The season record is a LABEL on a link, not a seal, and it goes inward
only where Tally has a page that can answer.**

Three rules follow.

### 1. A length is not a result

A twelve-pitch at-bat is a **length**, and a length is true of the at-bat
whoever won. So the stored row is a batter, a pitcher, a date and a pitch count,
and `gen-long-at-bats.mjs` stores **no result event, no inning and no score** —
there is nothing in the file to leak one. The note therefore declares nothing
before it opens, because there is nothing to declare: opening a row opens that
game at its first lineup page, sealed under the same `revealedThrough` mark the
slate's own cards hand over.

`test/long-at-bats.test.js` asserts this of the committed file by vocabulary
rather than by trust, the same way `test/milb-pool.test.js` does for the game
pool (ADR-0080). This is the second static dataset in the repo built by walking
finished games, and in both the spoiler rule is a property of the FILE.

### 2. At a farm level the note measures age, and says what its floor selects

Age against level carries none of the rate board's bias: the floor decides **who
is on the page**, not what the number means, so the note is true as written. It
still says the floor out loud under the table — *a regular is 250+ plate
appearances in this league, so a player promoted out of it mid-season is not
here* — because a reader is owed the population as well as the figure.

Three leagues, never the level: no figure in `youngest-regulars/{sportId}.json`
is computed across two leagues, which is `research.md` §7's first rule.

### 3. The record is a signpost, and the minors link out

A `SealBox` withholds a value from the DOM until it is revealed (ADR-0001,
ADR-0002). That is the right machinery for a score on a scoring surface and the
wrong machinery for a link to a page that has always been open: wrapping one in a
seal would claim a protection the destination does not have. So the season record
is kraft tape and a sentence — *Opening this shows results* — and it persists,
reveals and consents to nothing.

MLB's links go to `/standings` and `/postseason-history`. The minors' go to
MiLB.com, plainly marked as leaving, until the half-season qualification rules
are validated. They go to MiLB's **index** pages rather than a per-league slug,
because a league slug cannot be checked from outside: milb.com is a single-page
app and returns 200 with the same title for a league that does not exist, so a
guessed slug fails silently into a generic page.

### The consequence nobody asked for: the standings page had to be fixed

Building the record "for MLB, where standings and postseason pages already
exist" means the door has to open onto something. It did not. `/standings`
defaults to *entering today* and passes that date to statsapi, and
`/api/v1/standings?date=` only resolves a day the season actually played — so
from November to February the page said **"No standings available for this
date"** for a third of the year. Omitting the date returns the season's real
final standings; it is the same endpoint reading `gen-season-score.mjs` needed
for closed seasons.

So the page now reads the same offseason phase the slate does, and in the winter
it shows the season that ENDED, final, with its date controls put away — there
is nothing to scrub to when the record is the record, and a row of buttons that
each return an empty table is worse than no buttons.

## Consequences

- The offseason page has exactly one row that opens onto results, and it is the
  only thing on the page wearing kraft tape.
- `gen-long-at-bats.mjs` is a seventh nightly sweep of MLB game feeds, and the
  cheapest of them by a factor of twenty: `playByPlay?fields=` is 28 KB a game
  against the 555 KB the foul and arsenal sweeps need, because `pitchIndex`'s
  LENGTH is the pitch count and the pitch events never come down the wire. A
  night in season reads ~15 games; a first run on an unswept season reads ~2,300.
- The note is a census or it is nothing. It renders only when every played game
  of the season has been ingested and no plate appearance came back without pitch
  events (`coverage.complete`), so a sweep that quietly stopped in July takes the
  note off the page rather than publishing a count that is short a thousand
  games. That is also why the dataset needs no freshness stamp: it states its own
  coverage.
- A postponed MLB game reports `abstractGameState: "Final"`. The #1031 trap is
  not only a minor-league one, and the census could never have called itself
  complete while treating one as a game it failed to read.
- Both datasets are frozen from the day a season ends until the next one starts,
  which is the shape `check-data-freshness.mjs` cannot tell from a dead
  generator — so both take an `EXCEPT` entry, as `milb-pool/` already does.
- Whether a minor league qualifies its clubs by halves is still unanswered, and
  is still the thing that would have to be established before any of this comes
  in-house. What #1078 listed as unverified is now half-answered: the half
  records exist and are internally consistent at every level for 2026. That is
  evidence about the data, not about the rules.
