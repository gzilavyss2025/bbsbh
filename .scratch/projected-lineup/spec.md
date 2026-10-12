# Spec: a projected lineup before the real one posts

Issue: #1854. Status: draft, waiting on Gary. Nothing here is built.

## Goal

Before a lineup posts, the lineup page shows the club's whole active roster
(`TeamInfo.jsx`, `rosterFallbackGroups`). A scorer who fills in the book early
must guess the nine from that list. Show a labeled guess instead: the nine the
club will most likely use, in their likely order, with the roster still one tap
away.

## What already exists

- **The projected STARTER is built** (ADR-0089, `src/api/rotation/`,
  `components/workload/ProjectedStarters.jsx`). It shows "Likely starters" on
  the Starting pitcher card when MLB has named no probable. So #1854's first
  half is done. This spec covers the lineup half only.
- The schedule endpoint already returns posted lineups
  (`hydrate=lineups`, used by `api/schedule.js` for the readiness pill).

## The rule (measured, not guessed)

**Copy the club's most recent lineup against a starter of the same hand as
today's opposing starter. If there is none, copy the most recent lineup.**

`backtest.py` in this folder measured three rules on 2,266 MLB team-games
(2026-07-01 to 09-27), each projected from earlier games only:

| Rule | Names right (of 9) | Slots right (of 9) | Exact nine in order | 8 or 9 names right |
|---|---|---|---|---|
| Last lineup | 6.79 | 4.14 | 4% | 28% |
| **Last lineup vs. same-hand starter** | **7.30** | **4.84** | **7%** | **44%** |
| Usual nine vs. same hand (last 10) | 7.23 | 3.96 | 3% | 42% |

Two things follow:

1. The same-hand rule is best on every measure and is the simplest. Use it.
2. **The names are good. The order is not.** About 7 of 9 names are right,
   but only about half the slots. The label must say so, and the card must not
   look like a posted lineup.

## Data

One request per open card, only while the lineup is not posted:

```
GET /api/v1/schedule?sportId=1&teamId={id}&startDate={date-21d}&endDate={date-1d}
    &gameType=R,F,D,L,W&hydrate=lineups,probablePitcher
```

Verified on 2026-10-12 (Brewers, 2026-09-20 to 09-28): every final game has
`lineups.homePlayers` / `awayPlayers` with nine entries `{ id, fullName,
primaryPosition }`, and `teams.{side}.probablePitcher.id`. Then one batch
request for the opposing starters' hands:

```
GET /api/v1/people?personIds={id,id,...}   → people[].pitchHand.code ('L' | 'R')
```

The `probablePitcher(...)` hydrate does NOT return `pitchHand` (checked). Today's
opposing hand comes from the card already on the page: the probable's `hand`,
or the first "Likely starters" row when no probable is named. If neither is
known, use the plain "last lineup" rule.

Notes:

- `primaryPosition` is the player's usual position, NOT his position in that
  game. The card shows no position, or labels it as usual position.
- **The schedule response also carries `teams.*.score`.** The new module must
  keep only ids, names, dates, and the probable's id, the same way
  `normalizeGame` keeps only spoiler-free fields. Read only games whose
  `officialDate` is before this game's date, plus game 1 of a doubleheader when
  this is game 2 and game 1 is final.
- Drop any projected player who is not on today's active roster (the roster the
  fallback already fetches). Show the remaining names; do not pad to nine.
- MiLB: lineups were present on 2 of 4 Triple-A games checked (2026-08-20 to
  08-22). MLB only for v1, like ADR-0089. MiLB keeps the roster fallback.

## What the card shows

- Label "Likely lineup". Note under it: "Not posted yet. Their last lineup
  against a {left/right}-hander, on {date} vs {opp}." This tells the reader
  where the guess came from.
- Numbered list, no jersey-style formatting that matches the real lineup card,
  no position column (or "usual position" in caption type).
- The roster fallback stays below it, behind a "Full roster" door.
- The real lineup replaces the card the moment it posts. The slate's readiness
  pill (`readiness.awayLineup`) does not change: a guess is never "posted".

## Slices

| # | What | Files (≤ 5) | Pattern to follow | Done test |
|---|---|---|---|---|
| 1 | Pure rule `projectLineup(games, hands, asOfDate, oppHand)` | `src/api/rotation/projectedLineup.js`, `test/projected-lineup.test.js` | `rotation/projectedStarters.js` | Unit tests: same-hand pick, fallback to last, doubleheader game 1, a game on/after the date ignored, roster filter |
| 2 | Live read: schedule + people batch, spoiler-free shaping | `src/api/rotation/liveLineup.js`, the test file, `src/api/spoiler-manifest.json` | `rotation/liveStarters.js` | Test: a response with scores yields rows with no score field; a failed read yields `[]` |
| 3 | Card + wire into `TeamInfo` | `src/components/workload/ProjectedLineup.jsx` (or a lineup folder), `src/screens/TeamInfo.jsx`, one CSS partial | `ProjectedStarters.jsx` | Chromium at 390 px, `?nointro`, a game with no posted lineup: card shows; with a posted lineup: card gone |
| 4 | ADR | `docs/adr/0109-…md`, `src/api/CLAUDE.md` one line | ADR-0089 | Lint passes |

The `src/api` top level is over the file cap, so the module goes in
`src/api/rotation/` beside its sibling. (`rotation` is a loose name for it. The
folder is small, and a rename is out of scope.) Model: Sonnet for slices 1, 2
and 4; Opus for slice 3 (it touches the scoring-surface page).

## Out of scope

- Platoon by batter hand, injuries announced today, and "day off" patterns.
- MiLB.
- Any change to the projected starter.

## Spoiler-rule impact

None by design. Every input is a lineup from a game that ended before this
one. The lineup page is a scoring surface, so the one risk is the schedule
response's score fields. Slice 2's test pins that they never leave the module.

## Questions for Gary

1. Label: "Likely lineup" (matches "Likely starters") or another word?
2. Show the order, or the names only? The order is right about half the time.
