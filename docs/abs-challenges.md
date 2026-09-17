# ABS challenges — seven questions, and what the data answered

2026 is the first MLB season in which a player could argue a ball-strike call
and win it on the spot. Triple-A has run the same system for several years.
Nobody publishes what it has added up to across a season, so this repo does:
`public/data/abs-challenges.json` is one row per review, folded into season
boards, and `public/data/abs-exposure.json` is the denominator behind them —
how many pitches each man saw and how many innings he caught.

This document is the written half. It holds the answer to each of the seven
questions the report asks, with the real numbers and every caveat stated out
loud. **A finding that survives its caveat is worth more than five that were
never tested against one**, and two of the seven below only became interesting
after the caveat was applied.

Read it before changing `scripts/gen-abs-challenges.mjs`, the boards on
`/abs-challenges`, or the challenge card on a club's Numbers tab. The generator's own rules are documented at the top of that
file and in `scripts/lib/abs/`; the readers' rules are at the top of
`src/api/around-the-game/absChallenges.js` and `absExposure.js`.

**Figures below were read on 2026-09-17**, over 2,284 MLB games and 2,163
Triple-A games. They move every night. The shapes do not.

## How the system works

A club is issued **two challenges**. A batter can call for one on a called
strike; a catcher or a pitcher can call for one on a called ball. The club
**keeps** the challenge when the call is overturned and **loses** it when the
call stands.

That is the whole rulebook, and almost every mistake in this report came from
applying it one inning too far. See "The rule that is only true for nine
innings" below.

| | MLB | Triple-A |
| --- | --- | --- |
| Games swept | 2,284 | 2,163 |
| Challenges | 9,550 | 9,542 |
| Overturned | 5,154 (54.0%) | 4,940 (51.8%) |
| Per game | 4.18 | 4.41 |
| Run expectancy put back | 918.0 | 907.5 |

"Run expectancy put back" is what the overturns MOVED, not runs that scored:
every overturn takes the umpire's call off the board and puts the correct one
back, and the swing is measured with the same run-expectancy table the box
score's umpire row already uses.

---

## 1. Umpires

**Finding.** How often a plate umpire is challenged varies far more than how
often he is wrong. Across the 87 MLB umpires who worked at least 15 swept
games, the rate runs from **3.13 challenges a game (Adam Hamari) to 5.40 (John
Bacon)** against a 4.18 league rate — a spread of 2.27, more than half the
league figure itself. John Bacon tops both levels' draw rates.

The share of those challenges that stood up runs from 38.9% to 70.2%.

**The floor, and why there has to be one.** A man who worked four games swings
thirty points on a single call, so the board takes only umpires with **15 or
more swept games** (`MIN_UMPIRE_GAMES`). The floor is printed on the page
rather than applied silently — a board that drops rows without saying so is a
board a reader cannot check.

**This is not the `/umpire-rankings` figure, and the page says so twice.** That
board scores **every called pitch** against the rule-book zone. This one scores
only the pitches a player thought were wrong — a much smaller, self-selected
set. A man can rank well on one and poorly on the other without either being
wrong.

---

## 2. Innings — and the denominator problem

**The raw count says nothing, twice over.** Ask which innings draw the most
challenges and the rows answer that the ninth (1,234) barely beats the eighth
(1,163): a flat appetite that sags at the end. Both halves of that are the
denominator.

1. **Not every game reaches the ninth**, and in a good half of the ones that
   do, the home club never bats in it.
2. **A club that has lost two cannot ask at all**, so by the ninth a large
   share of the league is silent by rule rather than by choice.

**Divided by the chances, the answer inverts.** A *chance* is one half-inning a
club played while it still held a challenge (ADR-0075). Per 100 chances the
rate runs **10.26 in the first to 21.37 in the ninth** — the appetite MORE THAN
DOUBLES across the game, and the raw count hides half the rise because the
chances are gone.

**And the share won falls the other way**, 61.4% in the first to 40.5% in the
ninth. Clubs ask more as the game gets late and are right less often when they
do. Triple-A gives the same shape: 10.44 to 23.51, and 58.4% to 41.5%.

**How a game's length is sourced.** `--recheck` re-reads the schedule over a
trailing window to evict games no longer coded Final, and the same call carries
`hydrate=linescore`, which hands back `currentInning` and `scheduledInnings`
while it is there. One mode, one pass, and the nightly self-heals the two
columns the way it already self-heals dead games. **Nothing is dropped for want
of a length**: all 2,284 MLB and 2,163 Triple-A games on file carry both
columns.

**Extra innings never get a column each.** The thirteenth carries a handful of
chances against the first's thousands, so everything past regulation is pooled
into one column, drawn hollow, with its own count and chances stated: MLB's
pool is 187 challenges over 1,056 chances.

---

## 3. Ran out of challenges

**Finding.** **Nine MLB club-games ran out of challenges in the FIRST inning**,
18 more in the second and 47 in the third. Triple-A's first-inning band is 13.
Over the season 1,155 of 4,568 MLB club-games emptied at least once — about one
in four.

**A band, not a top ten.** Eighteen club-games tie for tenth-earliest, so a
ten-row board would print nine real rows and one picked by nothing. **The tie
pile is the finding**, so the board is every club-game that emptied in the
earliest inning any club emptied in. Within the band the order is half, then
the sequence the challenge was written in, then date — a tiebreak and nothing
more, and the page claims nothing by it.

**Context is what stops the nine reading as a scandal.** 378 of the 1,155
emptied through the sixth; the other 777 went out in the seventh or later,
having spent their challenges on a game that was still in front of them.

**The emptying is read off the bank replay**, never off a count to two
(`replayBank(...).emptiedIn` in `scripts/lib/abs/bank.mjs`). That dates it to
the inning the last challenge was spent in, which is what "ran out in the
sixth" has always meant here, and it catches a case a count cannot see: an
emptying a club immediately undid with an overturn in the same inning is not a
club that ran out.

**Spoiler rule.** `/abs-challenges` is classed `spoiler-free`. This board names
a club, an opponent, a date, an inning, the call and the miss distance. None of
those is a score, and `test/abs-challenges.test.js` asserts the exact key set
on the night row rather than scanning it for a bad word.

---

## 4. Longest runs

**Finding.** **Carson Kelly won 16 challenges in a row** — out of 90 called all
season. **Jimmy Crooks lost 9 in a row**, out of 15. Triple-A's longest run of
wins is Sandy León's 15, out of 31.

| | MLB longest | Triple-A longest |
| --- | --- | --- |
| Won in a row, a season | catcher 16 · batter 10 · pitcher 3 | catcher 15 · batter 10 · pitcher 3 |
| Lost in a row, a season | catcher 9 · batter 7 · pitcher 5 | batter 10 · catcher 9 · pitcher 8 |
| Won in a row, one game | catcher 5 · batter 3 · pitcher 2 | catcher 7 · batter 3 · pitcher 2 |
| Lost in a row, one game | catcher 3 · batter 2 | catcher 3 · batter 2 |

**The small sample is the finding's own caveat, so it rides on every row.** A
run of 16 out of 90 and a run of 10 out of 14 (Isaac Paredes) are different
achievements, and a board printing the run alone would rank them as one. The
season total is a column headed "Won of called, all season" — on the row,
never in a note under the table, because a reader comparing two rows does not
have a note in front of them.

**The twelve longest are shipped and the whole distribution behind them is
too.** 1,553 men's run lengths cost about 108 KB on a file every visitor
downloads whole, to show twelve; the distribution costs about a kilobyte, which
is what lets the page say how many men tie below the rows on screen.

**A man is grouped by the job he mostly did**, which differs on purpose from
`byPlayer.role` (the role of his FIRST challenge). A catcher who also hits
would otherwise be filed under his opening call in April for the rest of the
year.

### The rule that is only true for nine innings

This is the correction that cost the most rework in the whole milestone, and it
is worth reading before touching anything here.

Every issue in this report was drafted against "a club is issued two
challenges, keeps one per overturn, and is out after the second loss". **That
is true in regulation and false after it.** A club that has run out is armed
again at the start of **every extra inning**: 55 club-games on file carry a
third failed challenge, all of them in extras, and gamePk 815625 lost **five**
in a thirteen-inning game.

So the in-game loss cap on the page is **read off the season**
(`inGameLossCap(summary)`) and never stated as a rule. It is 3 at both levels
today. A page that printed "two is the rulebook, not a record" would be wrong
one chip tap away.

**Two related traps:**

- **`FIRST_EXTRA_INNING = 10` is wrong in Triple-A.** 171 games on file are
  seven-inning doubleheader games. Extras start at the EIGHTH there, so the
  constant is `scheduledInnings + 1`.
- **`gameData.absChallenges.remaining` is not a bank and cannot check one.**
  It equals `max(0, 2 - usedFailed)` on 342 of 342 club-sides — a display value
  derived from the failure count, not a tracked balance. A model reconciled
  against it passes while being wrong.

---

## 5. How often is normal — the baselines

**Finding.** **A batter challenges about once every 40 plate appearances**
(6.42 per 1,000 pitches seen). **A catcher challenges about once every 8
innings caught** (1.12 per 9 innings). Triple-A: one every 40.2 plate
appearances, one every 7.4 innings caught.

**And the mean describes almost nobody.** Among the 352 MLB hitters with 200 or
more plate appearances the rate runs from **2.13 per thousand pitches at the
tenth percentile to 12.11 at the ninetieth**, against a 5.83 median. **Six of
them never called for a review all season**, and Gary Sánchez called for 32 in
1,085 pitches — 29.49 per thousand, more than four times the league figure.

Catchers cluster far tighter: 0.73 to 1.56 over 71 qualifiers.

**The catcher denominator is innings caught, not pitches received, and nothing
in any feed counts the latter.** That makes the two figures different
measurements which **cannot be read straight across**, and the page says so
once rather than implying they can be by drawing them alike without a word.

**Each rate counts only the challenges its own denominator can explain.** A
catcher who also hits is two challengers: dividing all of a two-way man's calls
by the pitches he saw as a BATTER invents a man who argues with every other
pitch.

**Two floors, MLB-tuned, used at both levels.** 200 plate appearances and 200
innings caught. Triple-A rosters churn, so the same floor admits a smaller
share of that league's men — which is a statement about the league, not a
distortion of it, and moving the floor per level would make the two boards
incomparable on the one axis a reader wants to compare them on. The count that
cleared it rides in the chart head at both levels.

**A mark placed by a counted index is a mark that lies.** The median and mean
rules on each histogram are placed through `binPosition`, which maps a VALUE
onto the drawn columns by the same arithmetic the labels under them are written
from. Placed by a hand-entered bin index instead, the median rule in the first
draft pointed at 5.11 under a label reading 5.90.

---

## 6. The scatter — a club's hitters against what they see

**Finding.** **Milwaukee is last of thirty at the plate and third of thirty
behind it** — 4.53 challenges per 1,000 pitches seen against a league 6.42, and
1.50 per nine innings caught against 1.12. The same club, two different habits,
and neither figure is visible from the other. That is the whole reason the card
exists: the league board ranks thirty clubs on one rate at a time and cannot
say it.

Twelve of the thirteen Brewers hitters who clear the floor sit **under** the
line the league's own rate would put them on, and the thirteenth is Gary
Sánchez — the most eager hitter in the league, 32 reviews in 1,085 pitches.

**The card lives on the team hub's Numbers tab**, beside the run value card,
and it is MLB only: `abs-exposure-clubs.json` sweeps sportId 1, so an
affiliate's page is unchanged the way it is for run value.

### Why this needed a third file

`abs-exposure.json` ships **one row per player-SEASON**, folded across clubs.
The fold is deliberate and right for the league board: a hitter traded in July
clears a 200-plate-appearance floor on his season, not on either half of it, and
the histograms in §5 would lose every traded regular without it.

The same fold drops `team_id`, which the sweep's own rows carry. So a club board
built on that file would have to attribute a traded man to whoever holds him
now, counting a whole season against a club he played sixty games for.

`abs-exposure-clubs.json` is the same sweep cut by club instead: **733 MLB rows
against the fold's 659**, because only 178 of MLB's 1,453 swept men appear for
more than one club. **95 KB**, fetched by one club's hub tab and by nothing
else — ADR-0076 applied a second time, and the alternative was 95 KB on a file
every visitor to `/abs-challenges` downloads whole.

**It ships counts and denominators and no rates.** `per1000Pitches` prints as
`11.224987798926305` — forty bytes for a number the reader divides in one line
— and three of them a row was 210 KB of a first draft that came out at 465 KB.
`name` does ride along, because a team hub that had to fetch 418 KB to put a
name on a dot would have paid for the file this one exists to avoid.

### A scatter for the hitters, a table for the catchers

One dot a man, pitches seen across against reviews called up, with the league's
rate drawn as the diagonal a man would sit on if he argued at exactly the
league's pace. **That is a shape**, and a ranked list of thirteen rates would
say who argues most and hide it.

Most clubs carry two or three catchers, so the same chart behind the plate is
three dots and a line. The catcher view is a table.

**The table is not a repetition of the chart.** It is the only way to reach a
player page from the card — an SVG text node cannot be a link — and it gives
the unlabelled dots their names. One direct label on the chart at most: three
in a first draft ran straight through other players' dots.

**Emphasis is by hue, never by size.** A larger dot reads as "more important"
when what it means is "further from the line".

### Whether Triple-A is worth drawing

**The churn is real and it is not the objection it looks like.** This was first
argued as "an affiliate's roster turns over, so the dots are a different
population in April and September". That is true — and it was measured, below —
but it tests the card against a claim the card does not make.

**The card is a record of a season, not a picture of a roster.** A man who
batted 250 times at Sacramento and was promoted in July clears the floor and
gets a dot, and that dot is a true fact about what he did there. Counting him
against the club he actually batted for is the entire reason the per-club cut
exists. Nothing on the card says "these are the men here now", so a man leaving
does not make it wrong.

**The test that decides it is coverage: how much of a club the dots account
for.** A floor that admits twelve men holding four in five of a club's plate
appearances draws that club. The same floor admitting twelve men holding two in
five draws a fragment and looks identical.

| | MLB | Triple-A |
| --- | --- | --- |
| Men who batted for a club, median | 24 | 34 |
| Men clearing 200 plate appearances, median a club | 12 | 12 |
| **Share of a club's plate appearances drawn** | **84.2%** | **71.8%** |
| Worst club | 70.6% | 57.6% |
| Catchers clearing 200 innings | 73 | 75 |
| Share of a club's catcher innings drawn, median | 90.9% | 74.8% |

**Three quarters of a club is not a fragment.** Triple-A uses ten more batters
a club and still concentrates 71.8% of its plate appearances in the twelve men
the floor admits. Every Triple-A club would draw a scatter, and every one would
draw a catcher table too — 75 catchers clear 200 innings, a median of two a
club, and no club has none.

**And the club's own rate, the number the card leads with and is ranked on, is
not floored at all.** `clubRate` runs over every man with a denominator. The
floor decides who gets a dot, never what the club's figure is, so the headline
and the rank are complete at Triple-A whatever the scatter shows.

**The churn, for the record.** 50.4% of a Triple-A club's qualified men played
for it in both April and September, against MLB's 77.4%; over each level's
first thirty days against its last thirty, 55.2% against 78.3%. Of the 126
Triple-A men absent in September, 62 were in the majors instead. The number is
a fact about how a farm system works. It is not a reason the chart would lie.

**What is left is a build, and one file decision.** ADR-0076 holds: the rows
and the surface land together, so `EXPOSURE_CLUB_LEVELS` in
`scripts/lib/abs/export.mjs` is still `['MLB']` until a Triple-A surface reads
them. Adding the level takes `abs-exposure-clubs.json` from 93 KB to about
222 KB, and that file is fetched by one club's hub tab — so a major-league club
would download the Triple-A half for nothing. Split it per level, or accept the
weight; do not ship the level without settling which.

**The figures above are cut per club, not per season.** §5's board floors a
man's folded season — 377 Triple-A men and 352 major-league men clear it — and
the card floors his plate appearances *for that one club*, a stricter test a
traded regular can fail at both stops. That is why the counts here are 355 and
341 instead. `.scratch/abs-reports/churn.mjs` reproduces every number in about
four minutes.

## 7. After a win, after a loss

**This is the finding most easily lost, and the control must ship with it.**

**Counted straight it looks like nerve.** An MLB club asks **15.20 times per
100 armed half-innings after winning a review and 11.30 after losing one** — a
26% drop.

**It is the rulebook.** A club that has just lost one holds one fewer, so it is
allowed to ask less. Nothing about its nerve has been measured.

**Held equal the gap all but vanishes and tips over.** Take only the club's
SECOND call of the night, with exactly one still in hand, so the single
difference between two clubs is how the last call went:

| | after a win | after a loss | gap | standard errors |
| --- | --- | --- | --- | --- |
| MLB, counted straight | 15.20 | 11.30 | +3.90 | 13.8 |
| MLB, held equal | 12.72 | 12.77 | **−0.05** | 0.1 |
| Triple-A, held equal | 14.64 | 14.04 | **+0.60** | 0.7 |

**Two independent leagues that disagree on the sign have not found an effect.**

**The standard error is a floor, not a measurement.** It treats every armed
half-inning as an independent trial, which they are not — the half-innings of
one game share a club, an umpire and a night — so the true error is wider and
the gap is even less than it looks. It is shipped to keep a small gap from
being read as a result, which is the only job it has.

**The asymmetry in the event counts is itself the confound.** 613 MLB calls
followed a win under the control and 854 followed a loss, because fewer clubs
reach a second call after losing the first.

**At player level the same control is suggestive and not a result**: 3.82
against 3.17 in MLB and 5.01 against 3.72 in Triple-A. Those agree in sign and
are worth 1.5 and 2.7 standard errors. Reported as that, and no further.

**Two things deliberately not built.** No per-club split — MLB's second calls
over thirty clubs is about fifty each against an effect of a tenth of a
challenge per 100 half-innings, and a board drawn that way manufactures noise
and then ranks it. And no "innings until the next challenge": a club that never
asks again has no wait to average, and dropping it keeps only the clubs that
did ask, which is the answer written into the question. The rate handles the
censoring — an event with no chances after it adds nought to both sides.

---

## API facts worth not rediscovering

Every one of these was verified live against the 2026 season. The full live
audit of statsapi is `docs/MLB_STATS_API.md`.

- **One `fullSeason` roster call per club carries the whole denominator.**
  `/api/v1/teams/{teamId}/roster?rosterType=fullSeason&season={season}` with the
  stat hydrations returns each man's pitches seen, plate appearances, innings
  caught and starts at catcher. About 60 calls covers a level. It matched
  **100% of MLB challenge rows** — every challenger has an exposure row.
- **A traded player's splits arrive per club**, so `team.id` on each split is
  what attributes his numbers, not his current roster. `splitsForTeam` in
  `scripts/lib/abs/exposure.mjs` is the filter.
- **Nothing anywhere counts pitches RECEIVED by a catcher.** Innings caught is
  the only denominator available, and it is a stand-in rather than the same
  measurement as a hitter's pitches seen.
- **`hydrate=linescore` rides free on a schedule sweep**, handing back
  `currentInning`, `scheduledInnings` and the per-inning shape while a
  `codedGameState` check is being made anyway.
- **A game is admitted on `codedGameState === 'F'` alone**, which takes a game
  shortened by rain and leaves out a cancelled one. The old abstract-Final rule
  put 23 never-played Triple-A games on the denominator.
- **On a SUCCESSFUL challenge the feed prints the CORRECTED call**, so the
  umpire's own call is the opposite of what is written down. Reading the printed
  call as his puts every batter in the catcher's column.
- **A box-score entry carries the position a man ENDED the game at**, so a
  catcher who moved to first base later reads as neither pitcher nor catcher.
  Twenty-eight real challenges landed in the `other` bucket that way in the
  first backfill.

## Where the code lives

| Piece | File |
| --- | --- |
| Sweep, export and CLI | `scripts/gen-abs-challenges.mjs` |
| Pure generator halves | `scripts/lib/abs/` — `rows`, `bank`, `chances`, `ranout`, `streaks`, `momentum`, `exposure`, `export` |
| Season board reader | `src/api/around-the-game/absChallenges.js` |
| Denominator reader | `src/api/around-the-game/absExposure.js` — the league histograms AND the team hub's per-club board |
| Team hub card | `src/screens/team/modules/TeamChallengeCard.jsx`, `src/styles/report/challenge-card.css` |
| Page and its sections | `src/screens/around-the-game/AbsChallengesPage.jsx`, `src/screens/around-the-game/abs/` |
| Chart primitives | `src/components/around-the-game/BroadcastBar.jsx`, `src/styles/report/charts.css` |
| Tests | `test/abs-challenges.test.js`, `test/abs-exposure.test.js` |
| Decisions | ADR-0075 (what a chance is), ADR-0076 (a dataset no surface reads) |

Three files come out of every run of the generator, and the split is a size
decision every time: `abs-challenges.json` (250 KB) is what `/abs-challenges`
fetches, `abs-exposure.json` (418 KB) is the per-player denominator list that
one section of that page reads, and `abs-exposure-clubs.json` (95 KB) is the
same denominators cut by club, read by one club's hub tab. Folded into one file
they would be 763 KB on every visit to either page.
