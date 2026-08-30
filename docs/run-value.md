# Run value — the reconstruction, and how it was checked

`public/data/run-value.json` says what every player's season has been worth in
runs, split four ways. This document is the research trail behind it: which
Baseball Savant leaderboards the four columns come from, why they can be added
together at all, and the check that says the reconstruction is right.

Read it before changing `scripts/gen-run-value.mjs`. The reader's own rules —
the total, the ranks, the role split, the floors — are documented at the top of
`src/api/around-the-game/runValue.js` and in `docs/api/static-data.md`.

## What a run value is

Savant scores a baseball event by how much it changed the runs an average team
would go on to score from the base, out and count state it happened in. A
season of those, summed, is **runs above average**. Because every one of the
four columns is measured that way, `+36` with the bat and `+24` with the glove
are the same `+36` and `+24`, and adding them is a real sentence rather than an
index with weights somebody chose.

That is the whole reason the page exists. Every other leader board in this app
ranks one skill in its own units — home runs, ERA, stolen bases — and leaves a
reader to guess how twenty home runs stack up against a season of elite
defense.

## The four sources

Savant computes all four and publishes them on four separate boards. It never
adds them up. Each URL below is CORS-open and undocumented, like every other
Savant endpoint this repo reads (`docs/data-enrichment.md` §3), and every one
was verified live on **2026-08-30**.

| Column | Board | Value column |
| --- | --- | --- |
| Batting | `/leaderboard/swing-take?group=Batter&type=All&min=1` | `runs_all` |
| Pitching | `/leaderboard/swing-take?group=Pitcher&type=All&min=1` | `runs_all` |
| Defense | `/leaderboard/fielding-run-value?type=fielder&minInnings=1` | `total_runs` |
| Running | `/leaderboard/baserunning-run-value` | `runner_runs_tot` |

**Batting and pitching are the same metric read from the two sides of the
plate.** That is not a shortcut. It is what Savant's own player pages show under
"Batting Run Value" and "Pitching Run Value", and it is why a two-way player is
the one row that carries both columns.

**Defense is more than range.** `total_runs` on the fielding board is range plus
arm plus double plays for a fielder, and framing plus blocking plus throwing for
a catcher — which is why a catcher can post a large figure without ever
covering ground.

## Context neutral, and why

The swing/take board has a `ddlLeverage` control with two settings: **Context
Neutral** and **Leverage Based**. The generator takes the neutral one, which is
the board's default and the one the published leaderboards quote.

A leverage-weighted figure weighs a swing by how much the game hung on it. It
answers "how much did this season help his club win", which is a different and
also interesting question — but it cannot be compared across the four skills,
and it cannot be compared across clubs, because a player on a club that plays
more close games accumulates leverage that has nothing to do with him. Neutral
says how much a player DID.

## Three traps

1. **The `custom` board's run-value selections come back blank.** Savant's
   `/leaderboard/custom` accepts `batting_run_value` and `pitching_run_value`
   as column selections and returns an empty column for both. The working
   selection there is `swing_take_run_value` — which is the same number the
   swing/take board carries, except rounded to a whole run. That is the reason
   the generator reads the four dedicated boards rather than one `custom` call:
   the whole runs are not precise enough for the total (see below).

2. **Each board spells its floor differently, and one ignores it.** Swing/take
   takes `min`, fielding takes `minInnings`, and the baserunning CSV export
   ignores a floor argument entirely and always returns its own qualified set.
   Savant's defaults are aggressive — `min=q` returns 299 batters where `min=1`
   returns 640 — and a club page wants its whole roster, not its nine
   regulars.

3. **A renamed column does not error.** It comes back empty for every row, which
   is the failure mode every Savant reader in this repo is built around
   (`scripts/lib/savant.mjs`'s header). The generator counts usable rows per
   board and aborts on the two boards it cannot ship without.

## The total is summed before it is rounded

This is the one arithmetic rule worth stating twice, because a reader will check
it against the columns beside it and get a different answer.

Every figure is stored to a tenth of a run and printed as a whole one. The total
is the sum of the tenths, rounded once at the end — not the sum of the printed
columns. Pete Crow-Armstrong's 2026 line is the worked example:

```
stored     bat 36.2   fld 24.4   run 5.1   pit 0.0   ->  sum 65.7  ->  +66
printed        +36        +24        +5        +0    ->  sum 65
```

The published board this reconstruction was checked against prints exactly that:
`+36 +24 +5 +0`, total `+66`. So the rounding is not a bug on either side, and
`test/run-value.test.js` pins it as the first thing that suite asserts.

## The check

The reconstruction was validated against a published run value leaderboard
(@TJStats, from Baseball Savant, dated 2026-08-29, "current through Friday's
games"). The generator was run on 2026-08-30 — one more day of games — and the
top ten came out as:

| # | Player | Total | Bat | Def | Run | Pit | Published |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Pete Crow-Armstrong | +66 | +36 | +24 | +5 | +0 | identical |
| 2 | Shohei Ohtani | +51 | +29 | +0 | +1 | +21 | +50 / +20 pitching |
| 3 | Jacob Misiorowski | +47 | +0 | +0 | +0 | +47 | identical |
| 4 | Yordan Alvarez | +44 | +50 | −2 | −5 | +0 | identical |
| 5 | Bobby Witt Jr. | +43 | +19 | +18 | +6 | +0 | +18 batting |
| 6 | Willson Contreras | +37 | +38 | +3 | −3 | +0 | identical |
| 7 | Dylan Cease | +36 | +0 | +0 | +0 | +36 | identical |
| 8 | Matt Olson | +36 | +30 | +6 | +0 | +0 | identical |
| 9 | Yoshinobu Yamamoto | +35 | +0 | +0 | +0 | +35 | identical |
| 10 | Kyle Schwarber | +34 | +38 | −1 | −2 | +0 | identical |

Same ten players, same order, and every figure identical except three, all on
the two men who played on the extra day. That is as close to an exact
reproduction as a moving season allows.

If this ever needs re-checking: run `node scripts/gen-run-value.mjs`, sort the
players by the sum of their four components, and compare the head of the list
against any published board of the same date. A component that has silently
gone to zero across the whole league is a renamed column, not a quiet season.
