# Offseason home — step 1, the two probes

Run 2026-09-15 against live `statsapi.mlb.com`, for issue #1038 step 1. Both
probes were asked before any code because both could change the design. Both
did. **Every script is in `probes/`** — each number below can be re-run rather
than believed. `probes/README.md` maps script to question to answer.

---

## 1a. The Arizona Fall League is fully in statsapi — and it is not alone

**Yes, and more than yes.** The AFL is `leagueId 119` under **`sportId 17`,
"Winter Leagues"** — not under any of the four minor-league sport ids.

| | |
| --- | --- |
| 2025 season | **100 games, Oct 6 – Nov 14**; 88 Final, 7 cancelled, 4 postponed, 1 completed early |
| 2026 season | **90 games already scheduled, Oct 3 – Nov 11** |
| Clubs | 6 (Peoria Javelinas, Scottsdale Scorpions, Glendale Desert Dogs, Mesa Solar Sox, Surprise Saguaros, Salt River Rafters) |
| Logos | All present on the CDN — `teamLogoUrl(490)` etc. return real SVGs |
| Game types | `R` regular, `L` league championship, `W` final |

And the feed is **complete**. gamePk 825618 (Peoria at Scottsdale, Oct 6 2025):
75 plays, 9 innings, both batting orders, **4 umpires**, weather, both probable
pitchers, pitch events on every at-bat. That is a fully scoreable game by the
existing `GameSelect → GameView → TeamInfo → InningViewer` flow.

> **Careful with `/seasons/2025?sportId=17`.** It answers
> `regularSeasonEndDate: 2026-02-10`, which is not the AFL — sportId 17 lumps
> every winter league together, and the Caribbean Series runs into February. The
> AFL's own bounds have to come from its schedule, filtered by `leagueId=119`.

### The rest of sportId 17 is complete too — with one exception found later

> **Correction, same day.** The check below asks whether a play carries ANY
> pitch event. Asking how MANY is a different question, and the Puerto Rican
> league (leagueId 133) answers it very differently: **1.69 pitches per play
> against ~3.9 for every other winter league and for MLB itself**, on 8 of 8
> games. It records the terminal pitch of most at-bats and drops the rest. It is
> excluded from #1055 for that reason. See `probes/pitchdepth.mjs`.

The same probe over the other six leagues, Nov 15 2025 – Feb 28 2026:

| League | id | Games | Final | Range |
| --- | --- | --- | --- | --- |
| Liga Mexicana del Pacifico | 132 | 241 | 240 | → Jan 25 |
| Liga Venezuela BP | 135 | 188 | 178 | → Feb 2 |
| Liga de Beisbol Dominicano | 131 | 143 | 136 | → Jan 27 |
| Liga Roberto Clemente | 133 | 126 | 120 | → Jan 20 |
| Australian Baseball League | 595 | 83 | 74 | → Jan 25 |
| Caribbean Series | 162 | 13 | 13 | Feb 1 – 7 |

One game sampled from each: **70–85 plays, 261–324 pitches, 9 innings (7 for the
ABL game), 9/9 batting orders, 4 umpires.** Every one of them is scoreable.

### What this means for the design

**Counting every sport Tally could plausibly show, the 2025-26 offseason was
twelve days long: February 8 to February 19, 2026.** Every other day from
September 15 to April 5 had at least one played professional game. The only
other gaps were single days — Christmas Eve, New Year's Eve, and five others.

But the app has **five tabs**, and none of them is sportId 17, so what a reader
actually sees is far darker. Per tab, days with no played game:

| Tab | Dark from | Dark to | Days |
| --- | --- | --- | --- |
| MLB | 2025-11-02 | 2026-02-19 | **110** |
| AAA | 2025-09-28 | 2026-03-21 | **175** |
| AA | 2025-09-25 | 2026-03-22 | **179** |
| A+ | 2025-09-17 | 2026-04-01 | **197** |
| A | 2025-09-18 | 2026-04-01 | **196** |

Three consequences for the design, in order of how much they change it:

1. **October is not the offseason for MLB** — it is the postseason, and the
   published dates say so with no help from the schedule (`postSeasonEndDate`
   2026-10-31, `offseasonStartDate` 2026-11-01). This is now ADR-0074.
2. **October IS the offseason for the MiLB tabs, and has been since
   mid-September.** The artboards dated Oct 12 are not showing the wrong month —
   they are showing a month in which A+ has been dark for nearly four weeks.
   If anything they are late.
3. **The AFL covers exactly those players, on exactly those dates.** Oct 3 –
   Nov 11 2026, complete feeds, real logos, six clubs of prospects from the
   levels whose tabs just went dark. That is a live, scoreable answer to "what
   is there in October" that needs no archive at all — and then LIDOM, LMP,
   LVBP, PWL and the ABL carry it to February 7.

That is a genuinely new option the study did not consider, and it is not free:
an AFL club is a composite squad, not an affiliate, so it has no place on the
club strip and no parent in `teams.js`. It is a sixth thing, not a sixth level.
Recorded here as a finding; **not** proposed as step 3.

---

## 1b. Essentially the whole played MiLB season is scoreable

**135 of 135 sampled games passed. Every level, every check.**

The check is what the scoring flow actually reads, not a proxy: chronological
`allPlays` with every play placed in an inning and half, both `battingOrder`
arrays at 9 or more, `linescore.innings` present, and pitch events on at least
80% of plays.

| Level | Schedule rows (2025, `gameType=R`) | With a score | Sampled | Scoreable | Rate |
| --- | --- | --- | --- | --- | --- |
| AAA | 2,250 | 2,150 | 25 | 25 | 100% |
| AA | 2,070 | 1,965 | 25 | 25 | 100% |
| A+ | 1,980 | 1,893 | **60** | 60 | **100%** |
| A | 1,980 | 1,890 | 25 | 25 | 100% |

Median game: 74–75 plays, 286–299 pitches. Umpires on 135 of 135. Innings
distribution is correct and includes seven-inning doubleheader games (8 of 135)
and extras up to 13.

**So the picked-game card can lead the MiLB page.** The eligibility check
`research.md` asks for is still worth building — it costs nothing and it fails
closed — but it will reject approximately none of the pool.

### Three things the raw count gets wrong

**The 1,980 the first draft printed was right, and still misleading.** A+ 2025
really does have 1,980 unique regular-season gamePks — 30 clubs × 132 ÷ 2. It is
the *schedule*, and 87 of those rows carry no score.

**But 65 of those 87 games were played.** Asking each one's own linescore (47
bytes) rather than trusting the schedule row: 66 rows say "Postponed" and 65 of
them have real runs. Their feeds are complete — gamePk 784954 has 83 plays and
356 pitches, and its own feed says `Final` while the schedule row still says
`Postponed`. This is the #1031 trap, confirmed at A+.

**The honest A+ 2025 inventory is therefore 1,958 games**, not 1,980 and not
1,893. The gate must be the game's own feed or linescore, never the schedule
row — which is worth +3.4% of the pool for free.

### Pitch tracking is the one thing that varies, sharply

| Level | Games with pitch velocity and location |
| --- | --- |
| AAA | 25 / 25 |
| A | 9 / 25 |
| AA | **0 / 25** |
| A+ | **0 / 60** |

`derive.js` already handles this — `maxVelo`, `missedCalls` and `hardestHit` are
null at an untracked park and callers hide the stat rather than show a false
zero. This confirms that design rather than changing it, and it rules out any
MiLB report built on tracking data at AA or A+.

---

## What step 2 shipped, and what these probes leave open

Step 2 (the roster wire promoted on the MLB offseason page) is built. Probe 1a
is what set its boundaries: MLB only, November 1 to the day before spring
training, on the published dates rather than on an empty slate (ADR-0074).

Left open, for Gary:

- **Should the AFL and the winter leagues appear at all?** The finding above is
  the case for it; it is a sixth surface, not a sixth level, and it is not in
  #1038's four steps.
- **Do the MiLB tabs get the same treatment at their own, much earlier, dates?**
  That is step 3, and 1b says the picked-game card it needs is viable.
