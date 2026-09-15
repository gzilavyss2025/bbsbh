Seven questions about ABS challenge behaviour, answered across MLB and Triple-A, shipped as six new sections on `/abs-challenges`, one revision to a board already there, and one card on the team hub. This issue records **what to build and in what order**, so the work can be picked up cold.

- **Design canvas:** https://claude.ai/artifact/DdXwqNvni67o4MrJB3wkgY (Phone page and Wide page)
- **Working notes and probes:** `.scratch/abs-reports/`
- **Existing pipeline:** `scripts/gen-abs-challenges.mjs`, `scripts/lib/abs-challenges.mjs`, `src/api/around-the-game/absChallenges.js`, `src/screens/around-the-game/AbsChallengesPage.jsx`, `test/abs-challenges.test.js`

---

## The one thing that decides the order

**Two files are nearly at the 600-line cap in `scripts/check-file-size.mjs`:**

- `AbsChallengesPage.jsx` is at **575** — 25 lines of headroom against six new sections
- `scripts/lib/abs-challenges.mjs` is at **497** — about 100 lines against four new export cuts

`scripts/lib/` is also at its own directory budget of 35, and `src/screens/around-the-game/` holds 7 files, so neither new siblings nor a widened budget table is the answer. The guard's header says it outright: the default answer is to split.

So #1056 and #1057 land first, alone, with no new behaviour. Everything else is small afterwards.

---

## Step 1 — Make room (no new behaviour)

- #1056 — split the page into section components under `src/screens/around-the-game/abs/`
- #1057 — split the lib into `scripts/lib/abs/`

Both are pure moves. #1057's acceptance is that `--export-only` rewrites a byte-identical JSON.

**Every section built after #1056 must read the `summary` it is handed, never the file.** That single rule is what makes the page's existing MLB / Triple-A chip work for all six new sections without a follow-up issue.

## Step 2 — Data

Four of these cost `node scripts/gen-abs-challenges.mjs --export-only` and no refetch. Two need something new.

- #1058 — **the chances denominator** (needs #1057). Two columns on `abs_ingested_games`, filled from the feed at sweep time and backfilled from about 50 schedule calls. Carries the inning-by-role cut and an ADR
- #1059 — the out-of-challenges board (needs #1057)
- #1060 — streaks (needs #1057)
- #1061 — after a win, after a loss (needs #1057 and #1058)
- #1062 — **per-player exposure** (needs #1057). The only new fetch in the whole job: about 60 roster calls, verified to match 100% of MLB challenge rows

## Step 3 — Surfaces

Each depends on #1056 and on its own data issue. They are independent of each other, so they can land in any order or in parallel.

| Issue | Question | Needs |
|---|---|---|
| #1063 | When they call for one | #1058 |
| #1064 | Out of challenges | #1059 |
| #1065 | Longest runs | #1060 |
| #1066 | How often is normal | #1062 |
| #1067 | After a win, after a loss | #1061 |
| #1068 | The plate umpires, revised | nothing new |
| #1069 | Team hub card | #1062 |

#1068 needs no new data at all and can go any time after #1056.

## Step 4 — Decision and write-up

- #1070 — the caps convention. **Blocks any section that ships a real sentence**, so decide it early even though it is listed late
- #1071 — `docs/abs-challenges.md`, the written report. Last, because it records what the build settled

---

## The findings the build has to preserve

Each of these came out of the data and survived a caveat. If a surface loses one, it has lost the point of the question.

1. **Umpires.** 3.13 to 5.40 challenges a game against a 4.18 league rate — a spread of 2.27. John Bacon tops both levels.
2. **Innings.** Raw counts say the ninth barely beats the eighth. Per chance it runs 10.20 to 21.36 — the appetite more than doubles, and the raw count hides half the rise because the chances are gone. The share won falls the other way, 60.9% to 40.5%.
3. **Ran out.** 9 MLB clubs emptied in the first inning, 18 more in the second. The tie pile is the finding; a top 10 would have been an arbitrary slice.
4. **Streaks.** Carson Kelly won 16 in a row from 88 all season; Jimmy Crooks lost 9 in a row from 15. Inside one game the loss streak is capped at 2 by the rulebook.
5. **Baselines.** A batter challenges once every 40 plate appearances, a catcher once every 8 innings caught. The spread is so wide that the mean describes nobody: seven qualified hitters never challenged once, and one called for 32 in 1,085 pitches.
6. **The scatter.** Milwaukee is 29 of 30 at the plate and above the league behind it — the same club, two different habits.
7. **After a win, after a loss.** Counted straight it looks like clubs go quiet after a loss (8.20 against 7.08). Held equal it is 8.30 against 8.63, and Triple-A gives the same size gap the other way. **The apparent effect is the rulebook, not psychology.** This is the finding most easily lost, and the control must ship with it.

## Standing constraints

- **Spoiler rule.** `/abs-challenges` is classed `spoiler-free` in `src/api/spoiler-manifest.json`. #1059 and #1064 name specific games: club, opponent, date, inning, the call and the miss distance are fine. A score, a winner, a run total or anything one can be read from is not.
- **Colour.** No new colour, and no three-way role split by hue: clay against field green fails the colourblind check (delta-E 4.4 under protanopia), and so does clay against graphite (4.8). Navy against clay is safe. Thin evidence is drawn hollow, not grey.
- **Contrast.** `--graphite-soft` is 3.10:1 on card paper and fails AA for small text. Chart labels take `--text-caption`.
- **Typography.** `check-typography` scans stylesheets only, so every font-size, weight, line-height and tracking must be a token in `src/styles/68-around-the-game.css`, never an inline style.
- **Tests.** Product code and its tests land in the same PR. Never loosen an assertion to make CI pass. Verify by exit code, not by grepping output — guards print an ASCII cross and eslint prints a different one.
- **Workflow.** Task branch and PR, never a push to `main`. Reserved dev ports are often all taken; `npx vite --port NNNN` with `E2E_PORT` is the fallback.
