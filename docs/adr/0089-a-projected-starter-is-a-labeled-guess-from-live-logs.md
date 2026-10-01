# A projected starter is a labeled guess, read from live logs

**Status:** Accepted
**Date:** 2026-10-01

## Context

When MLB has not named a probable pitcher, the Starting pitcher card on the
lineup pages said "Not posted yet." The reader asked for more: look at the
roster, see who has started lately and who is rested, and name the likely
starters.

The first version read `public/data/workload.json`. That was wrong. The file
keeps regular-season rows only (`gen-workload.mjs` filters `gameType 'R'`, and
its request sends no `gameType`), and it is up to a day old. On 2026-10-01, for
the Wild Card game 3 of PHI at ATL, the card named Chris Sale ("7 days rest, 97
pitches on 9/23"). Sale had started game 1 on 9/29. Tyler Mahle had started
game 2 on 9/30. The reader saw it at once.

## Decision

**1. The file names candidates. A live read supplies the appearances.**
`api/rotation/liveStarters.js` takes the club's pitchers that the file shows
with a start in the last 35 days, then reads each one's game log with
`gameType=R,F,D,L,W` (the same types `fetchPitcherLastGame` reads, ADR-0088).
`projectedStarters.js` applies the rule to those rows. It never reads the file's
own `apps`.

**2. A failed read drops the pitcher. It never falls back to the file.** The
file's rows are the stale ones. If every read fails, the list is empty and the
card says "Not posted yet." A wrong name is worse than no name.

**3. The rule is simple and ranked by rest.** A pitcher is listed when his last
start is at least four days back and he has not relieved since. Regulars (two or
more starts in 35 days) rank above one-start pitchers. Oldest last start first.

**4. Two names, labeled as a guess.** The card says "Likely starters", prints
days of rest and the length of his last start, and ends with "Not announced
yet. A guess from days of rest." It has no headshot and no season line, so it
cannot pass for the real card. It is shown only when no probable is announced
and the game has not started. The announced probable replaces it at once. It is
never counted as announced: the slate card's `readiness.pitchers` is unchanged.

**5. Spoiler-free.** Every row is a completed game strictly before this game's
date. Nothing reads the feed. The card is on the lineup page, which is a
scoring surface, and it shows no number from this game.

## Evidence and its limits

`.scratch/projected-starters/backtest.mjs` projects each of the last 28 days of
the 2026 regular season from data strictly before that day: 592 team-games, the
exact starter first 51%, in the top two 82%. That is why the card lists two
names.

- **The backtest is regular season only.** Nothing in October has been
  measured. Rotations shrink, clubs skip a starter, and bullpen games are more
  common. On 2026-10-01 the Atlanta list was two bullpen-game arms (32 and 43
  pitches in their last starts), because the club's rotation was used up.
- **Short starts count as starts.** Ignoring starts under 40, 50 or 60 pitches
  did not raise the overall hit rate (0.50 to 0.51 first, 0.81 in the top two),
  so the rule stays simple.
- Off days, injuries and an announced bullpen game are not modeled.

## Consequences

- MLB only. The workload file has no minor-league pitcher, so those cards keep
  "Not posted yet."
- One request per candidate (six to nine) while a starter is unannounced, for
  the one club whose card is open. `fetchPersonStats` gained an optional
  `gameType`; every other URL is unchanged.
- **Not fixed here:** the bullpen availability board reads the same
  regular-season-only file, so in October it does not count a reliever's
  postseason outings. That is a separate data fix in `gen-workload.mjs`.
- `test/projected-starters.test.js` pins the rule and the live read, including
  the Sale case: a postseason start in the live log removes a pitcher the file
  shows as rested.
