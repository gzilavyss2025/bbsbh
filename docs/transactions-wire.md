# The MLB transaction wire — field dictionary, code dictionary, and the roster rules underneath (verified 2026-08-11 against `statsapi.mlb.com`)

Reference for `GET /api/v1/transactions`, written for the next session to read
before designing anything on top of it. This endpoint is undocumented upstream,
so **every claim here was measured**, not recalled — the window, the sample size
and the script behind each number are named so a later session can re-run them
and check whether the wire has changed.

**Status: v1.** §1–§7 cover the wire's shape, its vocabulary and the roster
rules that vocabulary encodes. §8 onward record what has been decided on top of
it and what has not: §10 settles which rows are news, §11 settles whose story a
row is league-wide, and §9 is what is still argued.

## How to re-verify anything here

The scripts live in `.scratch/home-transactions/`. They import
`src/api/statsapi.js` and, where they de-duplicate, share one module
(`wire.mjs`) so no two of them can disagree about what a line is.

| Script | Answers |
| --- | --- |
| `type-census.mjs` → `census.json` | Every code, every sub-kind, the most recent examples of each |
| `last48.mjs` → `last48.json` | A window feed, its de-duplication, and a season-long backtest of the rule |
| `join-related.mjs` → `joined.json` | Joining a player's own moves, and grouping a club's day |
| `probe-resolution-date.mjs` | What `resolutionDate` marks |
| `probe-roster-verbs.mjs` | The roster-vocabulary claims in §5 |
| `pull-window.mjs` → `window.json` | The same rows run through the team-page pipeline, for comparison |
| `probe-coverage.mjs`, `probe-bare-activation.mjs` | §10 — which rows are news |
| `probe-league-grouping.mjs` | §11 — the league-wide pass, measured against the shipped code |

Three measurement bases are used below and they are **not interchangeable** —
each table says which it is:

- **Raw rows** — everything the endpoint returned. Season sample: **39,247 rows,
  2026-03-25 to 2026-08-11**, of which **8,683 name an MLB club** on one side.
- **MLB lines** — raw rows scoped to those naming an MLB club, then de-duplicated
  by §6's rule. Season: **8,068 lines**.
- **Deduped feed lines with a club resolved** — as above, used only in §5's
  correlations. Season: 8,065.

## 1. The endpoint

```
GET https://statsapi.mlb.com/api/v1/transactions?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
→ { transactions: [ … ] }
```

- **CORS-open**, no key, same as every other statsapi call this app makes.
- **`teamId=` is club-scoped, not org-scoped.** It misses rows whose only club is
  an affiliate, which is most call-ups and options. Fetch league-wide and bucket
  it yourself. (Verified in `.scratch/team-transactions/data-layer-scope.md` and
  again here.)
- **A season-to-date pull is one request** and returns ~39k rows by August. That
  is cheap enough to do in a generator and too big to do on page load.
- **There is no clock.** A transaction carries dates, never a time. "The last 48
  hours" can only ever mean "today and yesterday".

## 2. Field dictionary

Presence measured over 39,247 raw rows.

| Field | Present | What it is, and what bites |
| --- | --- | --- |
| `id` | 100% | **Not unique.** 38,784 distinct ids over 39,247 rows. Every player in one trade shares a single id, and the same move is occasionally re-filed under a *second* id. Do not de-duplicate on it — see §6. |
| `date` | 100% | The day the row was filed. |
| `effectiveDate` | 99.6% | The day the move takes effect. **Key on this**, not on `date`; they differ on a small share of rows, and at a two-day window that decides membership. |
| `resolutionDate` | 75.2% | Carries no date information — it equals `effectiveDate` on **all 29,526 rows that have one**, no exception all season. Its *presence* is the signal; see §4. |
| `typeCode` | 100% | The code. §3. |
| `typeDesc` | 100% | MLB's own words for the code. Safe to print. |
| `description` | 99.6% | The wire's sentence. Led by the acting club when there is one — but not always; see §5's note on club-less sentences. |
| `person` | 98.8% | `{id, fullName, link}`. Absent on a trade's mirror copy. |
| `toTeam` | 99.6% | `{id, name, link}` — the receiving club, MLB or affiliate. |
| `fromTeam` | 29.7% | Only on moves with a losing side. |
| `team` | **0%** | Never sent on this endpoint, despite appearing in other statsapi shapes. Do not read it. |

**Joining a row to more data.** One batched `GET /api/v1/people?personIds=a,b,c`
(100 per call) returns position, position name, bats/throws, age, height and
weight, birth date and birthplace, `mlbDebutDate` and an `active` flag.
**`currentTeam` never comes back from the batched form** — it was empty on all
3,821 people tested. Read the club off the row's own `toTeam`/`fromTeam`.
`mlbDebutDate` is present on only ~19% of the people named on the wire, which is
what makes it a usable filter for "has this player ever been a major-leaguer".

## 3. Type-code dictionary

All 22 codes seen in the season sample, by raw-row volume. "MLB" counts rows
naming a major-league club on either side.

| Code | `typeDesc` | Rows | MLB | What it does to a roster |
| --- | --- | --- | --- | --- |
| `ASG` | Assigned | 19,279 | 942 | Two different events sharing a code — see §3.1. Mostly affiliate-to-affiliate movement no major-league roster feels. |
| `SC` | Status Change | 11,968 | 1,547 | Eleven different events sharing a code — see §3.2. |
| `NUM` | Number Change | 1,575 | 1,570 | **Not a roster move at all.** Nearly all major-league. The third-biggest MLB-touching code on the wire. |
| `REL` | Released | 1,263 | 48 | Player leaves the organisation. Mostly filed at affiliate level. |
| `SFA` | Signed as Free Agent | 1,142 | 840 | Arrival. Whether it reaches the 40-man depends on the contract — see §5.1. |
| `OPT` | Optioned | 930 | 927 | Off the active roster, **stays on the 40-man**. Reversible. |
| `CU` | Recalled | 770 | 765 | Onto the active roster from the minors. **Already on the 40-man**; costs no spot. |
| `SGN` | Signed | 591 | 581 | As `SFA`; the wire uses both. |
| `TR` | Trade | 487 | 379 | Changes clubs. **One of two codes naming two different MLB clubs.** |
| `DES` | Designated for Assignment | 368 | 368 | **Off the 40-man immediately**, into a limbo that must resolve. |
| `SE` | Selected | 358 | 358 | Contract selected: **onto the 40-man and the active roster**. A spot must be opened. |
| `OUT` | Outrighted | 214 | 211 | Cleared waivers, assigned to the minors **off the 40-man**. Usually resolves a `DES`. |
| `DFA` | Declared Free Agency | 108 | 10 | **Not "designated for assignment"** — that is `DES`. This is the player *electing* free agency. Sentence names no club. |
| `CLW` | Claimed Off Waivers | 60 | 60 | Arrives **on the claiming club's 40-man**. The second code naming two MLB clubs. |
| `ACQ` | Acquired | 49 | 49 | From outside affiliated ball (independent leagues). |
| `RET` | Retired | 35 | 1 | Sentence names no club. |
| `SU` | Suspension | 27 | 8 | Sentence names no club, no reason, no length. |
| `OBT` | Obtained | 9 | 9 | Same event as `ACQ`, different verb. |
| `RTN` | Returned | 9 | 8 | Coming back from a loan or a Rule 5 assignment. Sentence leads with the **player**, not a club. |
| `LON` | Loan | 3 | 0 | Loans to Mexican League clubs. No MLB club involved all season. |
| `PUR` | Purchase | 1 | 1 | Same event as `ACQ`/`OBT` again. |
| `CP` | Contract Purchased | 1 | 1 | Same event, fourth wording, and the only one naming no source club. |

**`ACQ` + `OBT` + `PUR` + `CP` are one concept in four codes** — a player arriving
from outside affiliated ball, 60 rows a season between them. Group by meaning or
the same event reads four ways.

### 3.1 Inside `ASG`

| Sub-kind | Rows | MLB | Note |
| --- | --- | --- | --- |
| Assigned between clubs | 16,964 | 15 | A prospect moving affiliates. Almost never touches a major-league club. |
| Sent on a rehab assignment | 2,164 | 927 | **Not a roster move** — the player is already on the injured list and stays there. |
| Other | 151 | 0 | Rows carrying no description at all. |

### 3.2 Inside `SC`

| Sub-kind | Rows | MLB | Note |
| --- | --- | --- | --- |
| Activated, no list named | 4,749 | 198 | Added to an active roster. What completes a signing — see §5.1. |
| Placed on the injured list | 2,744 | 637 | The `{N}-day` in the sentence is the list, not a prediction. |
| Activated off the injured list | 1,509 | 396 | |
| Other status change | 1,178 | 0 | |
| Moved to or from the development list | 1,016 | 0 | Minor-league mechanism. |
| Moved between injured lists | 468 | 138 | **A roster move in disguise** — see §5.4. |
| Roster status changed, unexplained | 154 | 64 | "RHP Nate Pearson roster status changed by Kansas City Royals." Says nothing. Often an echo of a real move — see §6.1. |
| Placed on the paternity list | 67 | 63 | |
| Placed on the restricted list | 38 | 10 | |
| Placed on the bereavement list | 34 | 30 | |
| Reassigned to the minor leagues | 11 | 11 | Frequently an echo of an option filed the same day. |

**A type code is not a kind of move.** `SC` and `ASG` together are 79% of the
wire and cover thirteen distinct events. Anything that switches on `typeCode`
alone is switching on the wrong thing.

## 4. `resolutionDate` — what its presence marks

The value is redundant (§2). Which rows carry one is not.

| Kind of row | Codes | Rows | Carry one |
| --- | --- | --- | --- |
| One club acting on a player it already holds | `SC`, `NUM`, `REL`, `SFA`, `SGN`, `DES`, `DFA`, `RET`, `SU` | 17,077 | 17,045 (99.8%) |
| A player moving between two clubs | `OPT`, `CU`, `TR`, `SE`, `OUT`, `CLW`, `ACQ`, `RTN`, `OBT`, `LON`, `CP`, `PUR` | 2,891 | **0** |
| `ASG` naming an origin club ("assigned to X **from Y**") | | 6,653 | 15 (0.2%) |
| `ASG` naming no origin club | | 10,311 | 10,304 (99.9%) |
| `ASG` rehab assignment — the deliberate exception | | 2,164 | 2,162 (99.9%) |

Read it as: **this row resolves at one club rather than between two.** A rehab
assignment names both clubs and still carries one, because the player never
leaves his parent club's control.

`fromTeam` answers nearly the same question. The one thing this field adds is
telling a rehab assignment apart from a real transfer with no text parsing.

## 5. The baseball underneath — two rosters

**Nothing in any sentence says which roster moved, and every verb is really
answering that.**

- **The 40-man roster** — who the club controls at the major-league level. A
  fixed 40 spots. Adding anybody means removing somebody.
- **The 26-man active roster** — who is available to play tonight. A subset of the
  40-man.

Correlations below are measured over 8,065 deduped MLB feed lines with a club
resolved (`probe-roster-verbs.mjs`).

### 5.1 Arrivals

| Verb | Rows | 40-man effect | Tell |
| --- | --- | --- | --- |
| **Recalled** (`CU`) | 765 | none — already on it | Routine. Shares a club-day with a 40-man-clearing move only **24%** of the time. |
| **Selected the contract of** (`SE`) | 358 | **adds** him | A spot must be opened, and one is: **68%** share a club-day with a designation, outright, release or 60-day transfer. Often a debut. |
| **Claimed off waivers** (`CLW`) | 60 | **adds** him | Same arithmetic: **72%**. |
| **Signed** (`SFA`/`SGN`) | 1,414 | depends on the contract | 808 say "**to a minor league contract**" — none was activated the same day. Of the 606 without that qualifier, **3** were. |

**A signing alone does not mean he joined the major-league roster.** The
activation is what says so. Signed-and-activated on one day happened three times
all season: Craig Kimbrel (Aug 10), Santiago Espinal (May 29), Randal Grichuk
(May 4).

### 5.2 Departures, in ascending severity

| Verb | Rows | 40-man effect | What it means |
| --- | --- | --- | --- |
| **Optioned** (`OPT`) | 920 | **stays on** | To the minors, club keeps him, recall at will. |
| **Designated for assignment** (`DES`) | 368 | **off, immediately** | Limbo. Must be traded, released, or passed through waivers. **337 of 368 are followed later by an outright, release, trade or claim** — so a designation and its outright days later are two views of one departure. |
| **Sent outright** (`OUT`) | 209 | **off** | Cleared waivers; still in the organisation, no longer on the 40-man. |
| **Released** (`REL`) | 48 | off | Gone. |
| **Elected free agency** (`DFA`) | 10 | off | A veteran refusing an outright assignment. Rare at MLB level; 2 of 209 outrights this season drew a same-day election. |

### 5.3 The injured list

| Row | Count |
| --- | --- |
| Placed on an IL | 576 — 15-day 295, 10-day 229, 60-day 41, 7-day 12 |
| Transferred between ILs | 137, **every one of them naming the 60-day** |
| Activated off an IL | 394 |

### 5.4 The trap worth knowing

**A transfer to the 60-day injured list is a roster move wearing a health move's
clothes.** It opens a 40-man spot, which is how a club adds a player without
designating a healthy one. All 137 transfers this season name the 60-day. Any
feed treating IL transfers as medical news will misread half of what they are.

### 5.5 What the wire cannot tell you

None of this is in any row, and all of it drives what the rows say:

- whether a player has **options remaining** — being out of options is *why* a
  club must designate rather than option him
- the **15-day minimum** before an optioned player can be recalled
- **service time**
- which of the two rosters any given move touched
- for a suspension: the reason or the length

## 6. How the wire repeats itself, and what actually de-duplicates it

Measured over the season: 8,628 MLB rows collapse to **8,068 lines**, removing
560 rows in 440 groups, with **no line printed twice and no real move merged
away** (`last48.mjs`).

**The rule that works: one line per `effectiveDate` + club set + normalised
sentence.** Normalise whitespace, case and the trailing period. Club set means
the unordered set of `fromTeam`/`toTeam` ids.

Three shapes of repeat, and they are the only three:

| Shape | Groups |
| --- | --- |
| A trade logged once per player — every row carries the one sentence naming the whole deal | 143 |
| The same move for the same player, filed twice under **different ids** | 292 |
| The same wire id logged more than once | 5 |

**Do not de-duplicate on `id`.** It merges a trade's rows by accident and misses
every re-filed move: over the season it leaves **332 lines still printed twice**.

**The club belongs in the key, and one real day proves it.** On Jackie Robinson
Day 2026 every player wears 42 and the wire files a number change for each. Two
of them are named **Max Muncy** — one Dodger (id 571970), one Athletic (id
691777) — so two rows carried *"3B Max Muncy changed number to 42."* on one date
for two different people. Keyed on the sentence alone, a feed prints one and
silently swallows the other. Keyed with the club, both survive, and a trade still
collapses because its two rows name the same club pair in opposite order.

### 6.1 The wire also echoes itself, which no sentence rule can catch

One demotion often arrives as three sentences that share no text:

```
OPT  Detroit Tigers optioned RHP River Ryan to Toledo Mud Hens.
SC   Detroit Tigers reassigned RHP River Ryan to the minor leagues.
SC   RHP River Ryan roster status changed by Detroit Tigers.
```

They are only visibly one event once that player's rows sit together. Grouping a
player's own moves on one club-day catches **22 such echoes** a season — a
second de-duplication net, arrived at by accident.

## 7. Scope: what "involves an MLB club" means

Most of the wire is minor-league housekeeping — of 39,247 rows, **8,683 name an
MLB club** and about 8,068 survive de-duplication.

Two scoping choices, and they are different:

- **Names an MLB club directly** (`fromTeam.id` or `toTeam.id` is one of the 30).
  What this document's numbers use.
- **Belongs to an MLB org**, resolved by mapping an affiliate to its parent via
  `GET /api/v1/teams/affiliates?teamIds=…&season=…` (each row carries
  `parentOrgId`). Wider — it also catches affiliate-only rows.

The **only two codes that name two different MLB clubs** are `TR` (trade) and
`CLW` (waiver claim). Everything else names one club plus its own affiliates.
That is the entire surface on which a league-wide feed can double-count, and a
single league-wide list does not double-count it at all: the wire logs a claim
**once**. The cross-club duplication measured in `window.json` was manufactured
by running thirty club-scoped pipelines over one shared row — a property of that
pipeline, not of the wire.

## 8. Where the existing implementation sits

Five files along four seams, plus the generator:

| File | Answers |
| --- | --- |
| `src/api/transactions/vocabulary.js` | Is this row news, and whose? |
| `src/api/teamTransactions.js` | Which rows belong in one story? |
| `src/api/transactions/cutline.js` | What does that story say? |
| `src/api/transactions/league.js` | Whose story is a row, league-wide? (§11) |
| `src/api/transactions/leagueFeed.js` | What does a browser fetch to read that live? (§12) |

`scripts/gen-team-transactions.mjs` runs the first three nightly to build the
team page's Transactions card: per-org, per-season static files. That path is
club-scoped by design, and `.scratch/home-transactions/findings.md` is why a
league-wide feed is not assembled by merging its thirty outputs.

Defects, each measured, all three now closed:

1. ~~**A waiver claim reads backwards on the club that lost the player.**~~
   Fixed in PR #690 — `rowClause` rebuilds the losing side's lead. `TR` and
   `CLW` are the only two codes naming two MLB clubs (§7), and both now carry a
   direction-aware clause, so no third case exists. Re-verified over a 60-day
   live window: `PUR`, `CP` and `WA` never appear on the wire at all, and every
   `ACQ`/`OBT` row names one MLB club and one independent-league club.
2. ~~**One player can appear twice in one story.**~~ Fixed: a player's rows on
   one club-day that point the same direction are now one story, ordered so the
   outcome leads and the paperwork trails (`NEWS_RANK`), and a trade never
   pulls a 40-man-clearing move naming somebody the deal already names.
   Measured over 60 live days: 4 such stories before, **0** after.
3. ~~**A busy club's story runs past 400 characters.**~~ Fixed: the leftover
   `shuffle` bucket splits at four moves. Longest story over the same window
   was **413 characters** before and **244** after, with nothing above 250.

A fourth, found while measuring the other two and fixed with them: **a same-day
arrival plus an option printed only the option**. The double-move cutline could
fold an arrival in only when it could word it as "(activated … first)", so a
waiver claim or a contract selection beside an option simply vanished — 20
player-days in 60 (16 claims, 4 selections). The arrival now leads unless it is
an activation, which really is bookkeeping for the move beside it.

## 9. Still open

Decisions this document deliberately does not make:

- Whether `NUM` belongs in a feed at all — 1,570 MLB-touching rows a season, and
  the biggest single club-day of the whole season is 31 Rangers changing to
  number 42.
- Whether the wire's own sentences are printed untouched (they name their club
  redundantly under a club heading) or rewritten (which leaves the wire's words
  behind, and every rewrite is a place to be wrong).

Two that WERE open here are now answered in §11: a league-wide feed prints one
event, from the acquiring club, and it reads the wire live. §12 covers what
reading it live costs, and ADR-0058 which of a row's two dates a window uses.

## 10. Settled since — the arrival family, and the two kinds of activation

Measured over a fresh 60-day league-wide window on 2026-08-20
(`.scratch/home-transactions/probe-coverage.mjs`,
`probe-bare-activation.mjs`), and now encoded in
`src/api/transactions/vocabulary.js`:

- **The `ACQ` family is news.** `ACQ`/`OBT`/`PUR`/`CP` are one event in four
  wordings (§3). All 31 rows in the window are shaped `fromTeam` a non-MLB
  club, `toTeam` a major-league club — a single MLB club, no direction to get
  backwards. Whitelisted. Two cautions the shape imposes: the source club is
  **not in affiliated ball**, so it carries a real statsapi id that must never
  be linked to a team page; and `OBT` is the one code the wire writes in the
  **present tense** ("Cardinals obtain RHP Durbin Feltman").
- **The paternity, bereavement and restricted lists are news.** 47 MLB rows in
  the window, split evenly between placements and activations. They fell out
  only because `mentionsInjuredList` does not match them. Whitelisted, with
  their own rail banners.
- **A bare activation is NOT news — it is an echo.** "Chicago White Sox
  activated RHP Luis Castillo." names no list, and **95 of 110** such
  MLB rows echo a move the feed already tells: **70** a trade, **12** a waiver
  claim, **13** a recall, selection or signing. Only two rows in sixty days had
  no arrival within a week. Admitting them as a class would print the
  deadline's biggest deals twice. They stay dropped — which is why the fix is a
  **list whitelist**, not a relaxation of the `/activat/i` test.

## 11. The league-wide pass — one owner per row

Measured over a 60-day league-wide window on 2026-08-20 (16,211 raw rows),
`.scratch/home-transactions/probe-league-grouping.mjs`, written up in
`segment2-numbers.md` beside it. Re-run the probe to regenerate every number
below; it caches its pull, so a second run costs no fetches.

**The rule: every raw row gets exactly ONE owning club, before any grouping.**
Then the club-scoped pipeline runs once per owner. A row is never grouped
twice, so there is nothing to de-duplicate afterwards.

That is decidable because of §7. Of 16,211 rows, 3,883 name no major-league org
at all, 12,035 name one, and **293 name two — every one of them a `TR` (253) or
a `CLW` (40)**. There is no third case to rule on.

| | 30-club merge | league-wide |
| --- | --- | --- |
| stories | 1,416 | 1,300 |
| player-days named | 2,163 | **2,163** |
| events told by two clubs | 82 (2 of them escape a key-based merge) | **0** |

It costs no coverage: the same 2,163 player-days, 116 fewer stories, because it
stops telling the same event twice.

### Whose story is a trade?

Both clubs acquire, so "the acquiring club" needs a rule. Two were tested
against all 92 trade groups in the window:

- **The wire's own sentence.** It always writes "{sender} traded X to
  {recipient} for Y", so the recipient is the club acquiring.
- **A headcount** — whoever took more named players.

The sentence rule always decides and is not a heuristic: **253 of 253** `TR`
rows lead with one of that row's own two clubs; in **92 of 92** groups the
leading club sends at least one named player; in **0 of 92** does it only
receive. Note the SENTENCE says so, not the row — every row in a deal carries
the same sentence whichever way that player went, so `fromTeam` on any one row
answers a different question.

The headcount is wrong, and often: it **disagrees on 26 of the 60** groups it
can decide and loses all 26, because the wire names the headline player first
and the return second. It would have headed the deadline's biggest cards with
the prospects going the other way — Seattle rather than the club that got Luis
Castillo, Baltimore rather than the club that got Adley Rutschman.

One group of 92 needs a fallback: on 2026-08-02 the Cubs and the Blue Jays
traded **twice**, so there are two sentences, two senders, and no acquiring
side. The grouper already merges the two deals into one story (it keys a trade
on date plus club pair), so the fallback only picks whose story it is — the
headcount, then the lower club id.

### What single ownership settles for free

- **A waiver claim** belongs to the club that made it, which is the side the
  wire's sentence is already written from. `rowClause`'s rebuilt lead for the
  losing side is never reached. Stories reading "claimed a player off waivers
  from their own club": 0 of 40.
- **Every story has a real `orgId`**, so `filterStoryworthy`'s direct-touch gate
  applies exactly as its own comment requires — which is what keeps the `DFA`
  exemption safe. An election logged against a Triple-A club still finds its
  parent; an affiliate-only release still drops.

### What a live feed has to fetch

The pass needs the same two side-loads the nightly generator makes. Measured by
re-running with each withheld:

| | Stories |
| --- | --- |
| Both | 1,353 |
| No affiliate parent map | 1,332 (−1.6%) |
| No `mlbDebutDate` set | 1,957 (**+45%**) |

The affiliate map is nearly free to drop. **The debut set is not** — without it
the feed is 45% anonymous minor-league signings (the suppression is documented
in `vocabulary.js`).

A 48-hour card holds roughly 30 to 45 stories: over the window's last six days,
31, 14, 21, 16 and 14 per day.

## 12. What a browser has to do — the live 48-hour card

§11 settled what the league-wide pass returns. This section covers the other
half: what a LIVE reader has to fetch to feed it, which is a different problem
from the nightly generator's. The generator has all night and asks about all
39,000 of a season's rows; the card is on the busiest page in the app and has
one page load.

`src/api/transactions/leagueFeed.js` is that reader. It owns the window
arithmetic and the fetch chain, and hands the rows straight to
`groupLeagueWide` — there is no second grouping path.

All numbers below are from a 30-day league-wide pull on **2026-08-20**
(2026-07-21 to 2026-08-20, 8,211 raw rows). Three probes regenerate every one
of them: `probe-card-fetch.mjs`, `probe-card-shape.mjs` and `probe-retro-il.mjs`
in `.scratch/home-transactions/`. Run `probe-card-fetch.mjs` first — it caches
the pull the other two read.

### 12.1 The window is not the fetch

The endpoint filters on `date`; the grouper buckets by `txnDate`
(`effectiveDate || date`, §2). **111 of 8,211 rows** carry a different
`effectiveDate`, skewed both ways — 29 days early to 24 days late. So a card
showing two days has to fetch more than two days and trim what comes back.

Backtested over 22 consecutive 48-hour windows against an unbounded-back
reference:

| Fetch width | Windows complete | Stories missed |
| --- | --- | --- |
| 2 days | 18 / 22 | 12 |
| 3 days | 21 / 22 | 1 |
| **4 days** | **22 / 22** | **0** |
| 5, 7 days | 22 / 22 | 0 |

Four days is the narrowest that misses nothing, and it is what `FETCH_DAYS`
holds. The one story a 3-day fetch misses is a Reds shuffle filed four days
before it took effect; a 2-day fetch loses twelve, mostly options filed the
evening before their effective date.

**Which date the WINDOW selects on is ADR-0058**, along with the one class of
row the choice knowingly omits (a move filed inside the window and backdated
outside it — 4.6 rows per 48 hours, 79 of 102 saying "retroactive", nearly all
injured-list placements). Read that before changing either constant.

### 12.2 The chain is two round trips, and only the second is worth cutting

`/people` cannot name its ids until the transactions call has answered, so the
chain is two deep and nothing can flatten it. Timed at a four-day width: 666
rows in 42 ms, then 116 ids in two batches in 160 ms — about 200 ms in total.

What keeps the second leg short is `leagueCandidateIds`, exported from
`league.js`. It runs the real storyworthy filter with **no debut set**, which
makes its output a superset of the final story rows: `debutedIds` only ever
SUPPRESSES (it is the anonymous-signing filter in `vocabulary.js`), so a row it
would drop is already in the list and a row it keeps could never be outside it.

| Prefilter | ids | `/people` calls |
| --- | --- | --- |
| Every row touching an MLB org | 3,099 | 31 |
| `leagueCandidateIds` | **1,096** (35%) | **11** |

The stories built from the two are **byte-identical**. That superset property is
the only thing making the shortcut safe rather than lucky, so
`test/home-transactions.test.js` pins it directly — not the id count, which
drifts daily, but the containment.

### 12.3 The affiliate map is already on disk

§11 measured that the pass needs an affiliate-parent map and a debut set. The
generator fetches both live. A browser needs neither request:

| Affiliate map | Stories |
| --- | --- |
| Live pull (291 clubs) | 696 |
| **`public/data/affiliates.json` (120 clubs)** | **696** |
| None | 689 (−1%) |

`gen-affiliates.mjs` already writes that file weekly for the team page. It
covers the four full-season levels only, and the complex-league and DSL clubs it
leaves out never own a storyworthy row — so the shipped file and a live 291-club
pull produce exactly the same stories. `leagueFeed.js` therefore reads it and
**degrades to an empty map**, at a cost of 7 stories: an option or a call-up
logged only against the Triple-A club stops finding its parent. The card is
still a card without it.

The debut set stays non-optional, as §11 measured — 696 stories become 990
(+42%) without it, and nearly all the growth is anonymous minor-league signings.
It rides along on the same `/people` response as the position fallback, so it
costs no extra request.

### 12.4 The shape a card has to lay out

The current window (2026-08-20 + 2026-08-19) held **36 stories across 21 clubs**:

- **by type** — roster-move 17, shuffle 13, injured-list 4, trade 1, signing 1
- **rail size** — 1 face ×19, 2 faces ×15, 3 faces ×2
- **cutline length** — min 27, median 103, p90 129, max 155 characters

A typical 48 hours runs 30 to 54 stories. **The worst 48 hours of the month held
125** (2026-08-04, the day after the deadline's paperwork landed). That range is
why the home card is a vertical ledger that fits itself to the space it has,
rather than the team page's horizontal deck of cards: `LeagueMovesCard.jsx` has
that reasoning, and `e2e/league-moves-card.spec.js` measures the fit.
