# Segment 2 — what the wire says about a league-wide grouping pass

**Window:** 2026-06-21 → 2026-08-20 (60 days), pulled live 2026-08-20.
**Rows:** 16,211 raw; 30 MLB clubs; 291 affiliates; 5,022 people resolved.
**Probe:** `.scratch/home-transactions/probe-league-grouping.mjs`. Re-run it to
regenerate every number here (`node .scratch/home-transactions/probe-league-grouping.mjs 60`).
It caches its pull in `league-window.json`, so a second run costs no fetches.

The probe runs TWO pipelines over one pull and compares them:

- **Baseline** — the thirty per-club pipelines of `gen-team-transactions.mjs`,
  merged. This is what the study proved a home feed cannot be built from.
- **League-wide** — every raw row assigned to exactly ONE owning club, then the
  same `dedupeTransactions` → `filterStoryworthy` → `groupIntoStories` machinery
  run per owner.

---

## 1. Ownership — a row has one owner, and the rule is not close

| Orgs claiming a raw row | Rows |
| --- | --- |
| 0 (pure minor-league housekeeping) | 3,883 |
| 1 | 12,035 |
| 2 | 293 |

Every one of the 293 two-org rows is `TR` (253) or `CLW` (40), and on all 293
**both** sides are a major-league club directly. No third code names two orgs.
Wire doc §7 said so from the season census; a 60-day live window agrees.

So single ownership is well defined: one MLB club on the row, or the parent org
of the affiliate the row names, and a stated rule for the 293.

## 2. It costs no coverage

| | 30-org merge | league-wide |
| --- | --- | --- |
| stories | 1,384 | 1,269 |
| player-days named | 2,163 | **2,163** |
| lost | — | **0** |
| gained | — | **0** |

The league-wide pass names exactly the same 2,163 player-days. It tells 115
fewer stories because it stops telling the same event twice.

## 3. It removes the duplication the study measured

Baseline: **81 events told by two clubs** (163 stories). 79 of those share a
story key, so a merge could catch them; **2 escape** — the same failure the
study measured at 24 of 193 over its own 21-day window.

League-wide: **0 events told by two clubs.** Not reduced — structurally absent,
because a row is only ever grouped once.

## 4. The trade voice — the wire decides it, a headcount gets it wrong

Product decision 1 says one voice, from the acquiring club's side. For a trade
both sides acquire, so "which side" needs a rule. Two candidates were measured
against all 92 trade groups (date + club pair):

- **Headcount** — the club taking more named players.
- **The wire's own sentence** — the wire writes "{A} traded X to {B} for Y", so
  B is the acquiring club.

They **disagree on 26 of the 60 groups where both decide**, and the headcount is
wrong every time it disagrees, because the wire names the headline player first
and the return second:

| The wire's sentence | headcount | sentence |
| --- | --- | --- |
| Seattle traded RHP **Luis Castillo** to Chicago White Sox for Domínguez, Smith, Jones and cash | SEA | **CWS** |
| Baltimore traded C **Adley Rutschman**, C Jake Rogers and cash to Boston for five | BAL | **BOS** |
| Colorado traded RHP **Seth Halvorsen** to Los Angeles for Frasso and Vidourek | COL | **LAD** |

The headcount would have headed the deadline's biggest cards with the prospects
going the other way.

**The sentence rule always decides**, and it is not a heuristic:

- 253 of 253 `TR` rows lead with one of the row's own two clubs.
- In **92 of 92** groups the leading club sends at least one named player.
- In **0 of 92** does the leading club only receive.

So: **the acquiring club is the club the wire's sentence does not lead with.**
No tie-break needed, and no headcount.

One group of 92 needs a fallback: on 2026-08-02 the Cubs and Blue Jays made
**two** trades, and the existing grouper keys a trade on date + club pair, so it
already merges them into one story. That story now appears once instead of
twice. The fallback for an ambiguous lead is the headcount, then the lower id.

## 5. The waiver-claim voice comes out right for free

With the owner set to the claiming club, `rowClause`'s `CLW` branch
(`row.fromTeam?.id === ctx.orgId`) is never taken, so the feed prints the wire's
own sentence — which is already written from the claiming club's side.

24 claim stories in the window. Stories reading "claimed a player off waivers
from their own club": **0**.

## 6. Defect 3 — the length cap

All seven over-length stories are the leftover `shuffle` bucket. Nothing else
in the window passes 280 characters.

| Faces in a shuffle | Stories | Longest cutline |
| --- | --- | --- |
| 2 | 245 | 129c |
| 3 | 67 | 193c |
| 4 | 43 | 244c |
| 5 | 22 | 351c |
| 6 | 7 | 336c |
| 7 | 2 | 348c |
| 8 | 1 | **413c** |

Simulated caps, splitting an over-cap shuffle into `ceil(n / cap)` chunks dealt
round-robin over its in-rows then its out-rows:

| Cap | Shuffle stories | Chunks that lose their in/out mix | Worst cutline |
| --- | --- | --- | --- |
| 3 | 465 (from 387) | 14 | 211c |
| **4** | **419** | **2** | **244c** |
| 5 | 397 | 1 | 351c |

**Cap 4.** It is the largest cap that holds every story under 320 characters,
and it costs 32 extra stories over 60 days.

## 7. Defect 2 — one player twice in one story

One player's KEPT rows on one club-day:

| Rows | Player-days |
| --- | --- |
| 1 | 2,074 |
| 2 | 90 |
| 3 | 4 |

Of the 94 multi-row player-days, **40 are same-direction** — the shape that
prints a player twice. 31 of them are `DFA + OUT`, which step 1b already pairs.
That leaves **9 player-days in 60 days** the grouper still gets wrong:

| Combination | Player-days | Example |
| --- | --- | --- |
| `DES + REL` | 3 | Mets designated **and** released Joey Gerber, 2026-08-02 |
| `ACQ + SFA` | 1 | Pirates acquired **and** signed Joshua Palacios, 2026-07-07 |
| `DES + OPT` | 1 | Orioles designated **and** optioned Johnathan Rodríguez |
| `DFA + OPT` | 1 | Royals optioned Aaron Bummer, who elected free agency |
| `DFA + DFA + OUT` | 1 | Lou Trivino III elected free agency **twice** |
| `SE + SFA` | 1 | Brewers signed **and** selected Ji Hwan Bae |
| `DES + OPT + TR` | 1 | White Sox, Duncan Davitt — the trade case |

Measured story-level damage: **4 stories name one player twice** league-wide
(3 shuffles, 1 trade), 3 in the baseline. Two separate causes, exactly as the
study said:

1. Two same-direction rows land in one shuffle —
   *"Recalled RHP Garrett Stallings…; released RHP Lance McCullers Jr.;
   designated RHP Lance McCullers Jr. for assignment."*
2. A trade's 40-man-clearing move names a player already in the trade —
   *"Acquired C Joey Bart from the Atlanta Braves for RHP Duncan Davitt;
   designated RHP Duncan Davitt for assignment."*

The Trivino row also shows why `id` and the §6 sentence key both fail here: his
two identical `elected free agency` rows carry different ids **and** different
club sets (one names the parent club, one the affiliate), so no de-duplication
rule sees them. Only grouping a player's own rows on a club-day does.

## 8. Found while measuring, NOT in the brief

**A same-day arrival plus an option prints only the option.** `cutlineDouble`
leads with the out-row and folds the in-row in as "(activated … first)", which
it can only write when the arrival is an injured-list activation. When it is
not, the arrival disappears:

| The wire | What the card prints |
| --- | --- |
| Blue Jays claimed RF Rudy Martin Jr. off waivers from Baltimore; optioned him to Buffalo | *Optioned RF Rudy Martin Jr. to Buffalo Bisons.* |
| Marlins claimed RHP Wikelman González off waivers from the White Sox; optioned him | *Optioned RHP Wikelman González to Jacksonville Jumbo Shrimp.* |
| Yankees selected the contract of RHP Bradley Hanner; optioned him | *Optioned RHP Bradley Hanner to Scranton/Wilkes-Barre RailRiders.* |

**20 player-days in 60 days** — 16 `CLW + OPT`, 4 `SE + OPT`. This is live on
team pages today. It is not one of the three defects in the brief.

## 9. Two facts segment 3 will need

The league-wide pass needs the same two side-loads the nightly generator makes.
Measured by re-running with each one withheld:

| | Stories |
| --- | --- |
| Both | 1,353 |
| No affiliate parent map | 1,332 (−21, −1.6%) |
| No `mlbDebutDate` set | 1,957 (**+604, +45%**) |

The affiliate map is nearly free to drop. **The debut set is not** — without it
the feed is 45% anonymous minor-league signings.

Day volume, league-wide: 2026-08-19 → 30 stories, 08-18 → 14, 08-17 → 18,
08-16 → 16, 08-15 → 14. A 48-hour card holds roughly 30 to 45 stories.

---

## 10. After the change — the same probe, re-run against the shipped code

`probe-league-grouping.mjs` now imports `src/api/transactions/league.js` rather
than re-implementing a candidate, so re-running it measures the real pipeline.
Same 60-day window, same 16,211 rows.

| | Before | After |
| --- | --- | --- |
| **30-club merge** — stories | 1,384 | 1,416 |
| longest cutline | 413c | **245c** |
| stories over 320c | 7 | **0** |
| stories naming a player twice | 3 | **0** |
| **League-wide** — stories | 1,269 | 1,300 |
| longest cutline | 413c | **244c** |
| stories over 320c | 6 | **0** |
| stories naming a player twice | 4 | **0** |
| player-days named (both pipelines) | 2,163 | **2,163** |
| events told by two clubs, league-wide | 0 | **0** |

The extra 32 stories on each side are the split shuffles, exactly as simulated.
Shuffle sizes now stop at four faces: 267 stories with two, 101 with three, 47
with four, and none above.

**One "event told more than once" survives, and it is not a duplicate.** On
2026-07-13 Baltimore acquired Cam Sanders from Pittsburgh for cash and optioned
him to Norfolk the same day. A trade leg must always reach the trade step, so
the option stays a story of its own. Two true sentences about one player, not
one event told twice — the four that were real duplicates are gone.

The claim-then-option fix reads as intended on live rows:

> [SF] Claimed LHP Philip Abner off waivers from Arizona Diamondbacks; optioned
> to Sacramento River Cats.
> [SEA] Claimed RHP Troy Watson off waivers from Detroit Tigers; optioned to
> Tacoma Rainiers.
