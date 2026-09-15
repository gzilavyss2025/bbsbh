# ABS challenge report — verified facts and derivations

Working notes behind the seven questions tracked in **#1072**. Everything here
was measured against the season on file (2026, through Sept 14) or checked
against a live statsapi response on 2026-09-15. Numbers are MLB unless a row
says otherwise.

The point of this file is that no agent should have to re-derive any of it.
Where a number is quoted in an issue body, it came from here.

---

## 1. What is already on file

`node scripts/gen-abs-challenges.mjs --export-only` re-derives every split from
the rows already stored and rewrites the JSON. **No refetch.** That is the whole
data cost of questions 1, 2, 3, 4 and 7.

| Level | Games swept | Challenges | Won | Per game |
|---|---|---|---|---|
| MLB (sportId 1) | 2,254 | 9,413 | 53.9% | 4.18 |
| Triple-A (sportId 11) | 2,158 | 9,420 | 51.7% | 4.37 |

By role:

| Level | Catcher | Batter | Pitcher |
|---|---|---|---|
| MLB | 4,987 at 58.7% | 4,254 at 48.9% | 172 at 39.5% |
| AAA | 5,003 at 57.8% | 4,108 at 45.3% | 308 at 38.6% |

`byInning` **is already computed and written to the JSON, and nothing in `src/`
reads it** (`grep -rn byInning src/` returns only unrelated modules). It is the
one export cut that needs no new derivation at all, only a denominator.

---

## 2. statsapi facts, each checked against a live response

### Final inning, without refetching a game feed

`/api/v1/schedule?sportId={1|11}&startDate=&endDate=&gameType=R,F,D,L,W&hydrate=linescore`

Per game it carries `linescore.currentInning`, `scheduledInnings`,
`isTopInning` and an `innings[]` array. About one call per week per level
covers a season — roughly 50 calls for both levels.

**The trap, and it is the whole extraction:** on a Final game whose home club
did not need to bat, the last `innings[]` entry's `home` object carries **no
`runs` key at all**. That absence is the only reliable record that the bottom
half was never played. `isTopInning` agrees but is a state flag describing where
the game stopped, not a record of what happened.

Captured in `test/fixtures/abs-denominators.json`:

| gamePk | State | currentInning | Bottom played |
|---|---|---|---|
| 824872 | Final | 9 | no |
| 823413 | Final | 9 | yes |
| 814842 | Cancelled: Rain | none | n/a |
| 815811 | Suspended: Rain | 2 | no |

A new game needs no extra call at all — `gen-abs-challenges.mjs` already reads
the full feed, and `liveData.linescore` is in it.

### Per-player exposure, one call per club

```
/api/v1/teams/{teamId}/roster?rosterType=fullSeason&season=2026
  &hydrate=person(stats(type=season,group=[hitting,fielding],season=2026,sportId={1|11}))
```

- the hitting split carries `numberOfPitches` and `plateAppearances`
- the fielding splits carry `innings` (a string in baseball thirds, `"1011.2"`
  meaning 1011 and two thirds) and `gamesStarted`, one split per position
- `rosterType` matters: `active` returns 28, `fullSeason` 55, `fullRoster` 272.
  `fullSeason` is the one that covers everybody who played for the club

Cost: 30 clubs per level, about 60 calls. Matched **100% of MLB challenge rows**
and 99%+ of Triple-A when joined back.

**The trap:** a traded player returns **one split per club plus an aggregate
whose `team` is undefined**. Gabriel Arias has four hitting splits across three
clubs; Patrick Bailey has three across two, with catcher innings on both sides.
A sweep that takes `splits[0]` gives one club a player's whole season. Match on
`split.team.id`. Both are in the fixture.

**Catchers have no pitches-received figure anywhere in statsapi.** Not on the
player, not on the team, not in the feed. The honest denominators are innings
caught or games started at catcher. Do not quietly reuse the batter
pitches-seen number for a catcher; the two rates are not comparable and any
surface showing both has to say so.

### Sandbox

statsapi calls fail with ENOTFOUND under the Bash sandbox. Pass
`dangerouslyDisableSandbox: true`, and retry once on a connect timeout.

---

## 3. The answers, with the caveat each one had to survive

### Q1 — Which umpires get the most and fewest challenges

MLB league rate 4.18 a game. Triple-A is **4.41** over games actually played,
against the 4.37 the file publishes — that gap is #1073. **87 of 91 MLB
umpires** clear a 15-game floor (`MIN_UMPIRE_GAMES`, already applied by
`umpireBoard`); 54 of 61 at Triple-A, where the spread is wider still, 3.43
(Macon Hammond) to 6.07 (Robert Ginther III).

- Most: John Bacon 5.40 (81 in 15 games). He worked Triple-A the same way, 5.24 in 25
- Fewest: Adam Hamari 3.13 (94 in 30 games)
- Spread **2.27 a game**, 3.13 to 5.40
- Most overturned: Andy Fletcher 70.2%. Least: Steven Jaschinski 38.9%

The floor matters: without it Ron Kulpa tops the Triple-A per-game board on a
single game's work.

### Q2 — Which innings, and does it differ by role

**The trap is the denominator and it changes the answer.** Raw counts say the
9th (1,216) barely beats the 8th (1,151). Per *chance* — one half-inning a club
played while it still held a challenge — it runs:

| Inning | 1 | 3 | 5 | 7 | 9 |
|---|---|---|---|---|---|
| Per 100 chances | 10.20 | 10.26 | 11.54 | 13.99 | 21.36 |
| Chances | 9,013 | 8,941 | 8,706 | 8,192 | 5,694 |
| Share won | 60.9% | 59.3% | 56.4% | 56.3% | 40.5% |

Only 3,503 ninth innings were played against 4,508 first innings, and a club
with two failed challenges cannot call for one at all. Both effects hide the
rise.

**The role split has its own trap.** A batter can only challenge in his club's
batting half, so his own opportunity is half the club total. Panels drawn on
that denominator sum to **exactly 2.000 times** the club rate at every inning
and read as though catchers alone out-ask the whole club. Ship role rates on the
club denominator so the three add up:

| Inning | Catcher | Batter | Pitcher | Club |
|---|---|---|---|---|
| 1 | 5.77 | 4.25 | 0.18 | 10.20 |
| 9 | 10.90 | 10.15 | 0.31 | 21.36 |

A pitcher never clears 0.32 per 100. On a shared scale every one of his nine
values rounds to the same bar, so he is a stat line, not a panel: 172 of 9,413.

### Q3 — Who ran out earliest

Per club per game, keep the fails, sort by inning then half then `seq`; the
**second** empties the club.

**The tie pile is the finding.** MLB, by the inning the second loss came in:

| Inning | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10+ |
|---|---|---|---|---|---|---|---|---|---|---|
| Clubs | 9 | 18 | 47 | 54 | 112 | 131 | 170 | 238 | 320 | 41 |

1,140 of 4,508 MLB club-games ran dry, about one in four. A "top 10" would be
the nine first-inning rows plus one arbitrary second-inning row, so ship the
band. Triple-A's first-inning band is 13.

Five of the MLB nine were emptied by **one man asking twice**. Sean Murphy's
first of the two was a pitch 0.0 inches off the edge.

### Q4 — Longest streaks

Order by `(date, game_pk, seq)` and walk for runs of the same outcome.

- Season, wins: **Carson Kelly 16**, from 88 challenges all year. Triple-A:
  Sandy Leon 15, from 31
- Season, losses: **Jimmy Crooks 9**, who won 2 of 15 all season. Triple-A:
  Carlos Mendoza 10, from 26
- In one game, wins: **5** — Tyler Stephenson and Edgar Quero, the only two.
  Triple-A reaches 7
- In one game, losses: **2 in regulation**, because the second loss takes the
  club's last challenge. **Not a cap on the game**, though: a club that reaches
  extra innings is issued another challenge, and Triple-A's in-game loss streak
  reaches 3. See #1074 — the lib does not model this yet

Season win-streak distribution (players at each length): 0:99, 1:182, 2:118,
3:89, 4:61, 5:29, 6:31, 7:15, 8:6, 9:5, 10:4, 12:1, 13:1, 16:1.

**Small-sample caution:** Isaac Paredes went 10 in a row from 14 challenges all
season. Kelly went 16 from 88. Print the season total beside the streak.

### Q5 / Q6 — How often is normal

- **Batters: 6.41 per 1,000 pitches seen, one challenge every 40 plate
  appearances.** Triple-A is 6.38 and also one every 40 — the two leagues have
  the same batter appetite
- **Catchers: 1.12 per 9 innings caught, about one every 8 innings.** Triple-A
  1.21, one every 7.4

**The mean describes nobody.** Among 338 MLB hitters with 200 or more plate
appearances: p10 1.96, p25 3.62, median 5.90, p75 8.51, p90 12.28. Seven never
challenged once. Gary Sanchez called for 32 in 1,085 pitches (29.5 per 1,000),
five times the median. Catchers cluster far tighter: p10 0.69, median 1.10,
p90 1.56 over 72 qualifiers.

For the club scatter, Milwaukee is a good demonstration: **29 of 30 at the plate
(4.51 per 1,000) and above the league behind it (1.51 per 9 against 1.12)** —
the same club with two different habits.

### Q7 — Do they challenge again sooner after a win

Measured as a rate, not an average wait, so the end of the game does not censor
it: next challenges over armed half-innings remaining.

**Counted straight:** after a win 8.20 per 100, after a loss 7.08. A 16% drop
that looks like a psychological effect.

**It is the rulebook.** After a failed challenge a club has one fewer in hand;
after two it has none. Hold that constant — the club's *second* challenge,
exactly two called, exactly one in hand, so the only difference is how the last
one went:

| | After a win | After a loss |
|---|---|---|
| MLB | 8.30 | 8.63 |
| Triple-A | 9.51 | 8.91 |

The gap closes, and the two leagues **disagree on the sign**. Both differences
are inside one standard error of each other. There is no effect to report.

At player level the same strict control gives 2.91 against 2.55 (MLB) and 3.53
against 2.72 (Triple-A) — same direction this time, but one to two standard
errors. Suggestive at most, and it must be reported as that.

---

## 4. Things that will bite

- **A club is topped back up to one challenge at the start of EVERY inning from
  the 10th, and the lib does not model it.** `ranOutByTeam` treats the second
  failure as the end of a club's night. Not once, per inning: `824312` failed in
  the 10th and the 11th, `815625` in the 10th, 12th and 13th for five failures
  in a game, and the feed's bank agrees (`usedFailed: 5`). It is a top-up to
  one, not `+1` on what you hold — the most any club ever lost inside a single
  extra inning is exactly what it held entering it, across 822 club-games that
  reached extras. Replaying the rule over all 8,069 club-games leaves **2
  violations**, both Triple-A, both in regulation. See **#1074**;
  `diag-bank-violations.mjs` exports the eight-line `bankWalk()` that #1058 and
  #1061 should lift rather than rewrite. It also affects both streak boards
  (#1060, #1065) and the shipped "Ran out" column
- **Those 2 violations are upstream, not ours.** Every stored row matches the
  feed exactly (5 of 5 and 6 of 6), and in each game the OTHER club goes through
  the same code and comes out legal. `816599` is the clean control: both clubs
  finish 1 successful and 2 failed, and only the order differs — `WLL` is
  spendable from a bank of two, `LLW` is not. MLB's bank agrees with our counts
  and disagrees with its own ordering. So `bankWalk()` must **tolerate** an
  over-spend: floor at zero, count it, carry on. Never throw, never go negative,
  never drop the row — the challenge was called and belongs in every count.
  Tolerated set: `815094` team 102, `816599` team 416
- **984 club-games carry two challenges in the same half-inning**, and their
  order comes from a sort on inning and half alone. It is chronological only
  because `Array.sort` is stable over `allPlays` order — incidentally, not by
  design, and not at all for the leftover rows `challengeRowsForGame` appends
  after its walk. Give any within-half derivation an explicit tiebreak
- **`abs_ingested_games` counts games that were never played.** 23 Triple-A rows
  are `Cancelled: Rain` with zero innings, and one (`815811`) is
  `Suspended: Rain` and still unfinished. See **#1073**. The published Triple-A
  per-game figure is 4.365; over games actually played it is 4.412
- **Two source files are nearly at the 600-line cap.**
  `AbsChallengesPage.jsx` 575, `scripts/lib/abs-challenges.mjs` 497. `scripts/lib/`
  is also at its directory budget of 35. Split before building (#1056, #1057)
- **`check-typography` scans stylesheets only.** Any font-size, weight,
  line-height or tracking written as an inline style in JSX passes lint and is
  still drift. Put them in `src/styles/68-around-the-game.css` as tokens
- **`--graphite-soft` fails AA for text**: 2.83:1 on manila, 3.10:1 on card
  paper. Chart labels take `--text-caption` (4.91 / 5.36)
- **Colour pairs that fail the colourblind check**, measured with the dataviz
  validator: clay against field green delta-E 4.4 (protan), clay against
  graphite 4.8. Navy against clay is safe at 19.8, and navy against graphite at
  22.3. So: no three-way role split by hue, and thin evidence drawn hollow
  rather than grey
- **The page ships its sentences SHOUTING today.** `.hint` and `.rptsource`
  carry no `caps-exempt`. Changing that is #1070
- **The report pages are not capped at 440px.** `.screen` widens to 960px from
  a 740px viewport (`src/styles/25-wide-layout.css:20`). Measured: at a 1280px
  viewport the column is 960, slabs go four across at 226px, `.rptpair` splits
  into two 456px columns

---

## 5. Reproducing any of this

| Script | What it does |
|---|---|
| `fetch-innings.mjs` | Sweeps both levels' schedules with `hydrate=linescore`, writes `final-innings.json` |
| `fetch-exposure.mjs` | Sweeps every club's fullSeason roster, writes `exposure.json` |
| `build-fixture.mjs` | Rebuilds `test/fixtures/abs-denominators.json` |
| `diag-cancelled.mjs` | Quantifies the never-played games behind #1073 |
| `analysis.mjs` | Every figure in section 3, from the row store plus the two caches |

The two caches are gitignored — they are derived, and both rebuild in about a
minute. Run `fetch-innings.mjs` and `fetch-exposure.mjs` before `analysis.mjs`.
