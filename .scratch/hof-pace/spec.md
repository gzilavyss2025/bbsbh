# Spec: Hall of Fame pace check on the player page

Status: draft, waiting on Gary. Nothing here is built. Source idea: ScriMLB
(`docs/peer-sites.md`), which compares a player with about 17 hand-picked
greats using hardcoded numbers. This spec uses a sourced pool instead.

## Goal

On a player's Stats tab, answer one question: **"Where does this career stand
against Hall of Famers at the same age?"** Shape: "Through age 27: {n} HR.
Nearest Hall of Famers at 27: {name} {n}, {name} {n}." (A template, not real
numbers.)

## What already exists

- **Milestone Watch** (`playerstats/MilestoneWatchCard.jsx`,
  `api/person/milestones.js`, `gen-milestones.mjs`) looks FORWARD to round
  numbers. This card looks SIDEWAYS at peers. Put them next to each other on the
  Stats tab.
- **Career register** (`api/person/careerRegister.js`) already merges
  traded seasons in `aggregateSplits` (lines 46-56). The generator reuses it.
- **WAR history** (`public/data/war-history/`, `api/war.js`) covers 1901 onward,
  labeled "WAR (MLB calc)".
- **The HOF award** is already read (`api/person/awards.js:66`, `MLBHOF`).

## Data (verified 2026-10-12)

| Need | Source |
|---|---|
| Inductees | `GET /api/v1/awards/MLBHOF/recipients`: 354 rows, `player.id`, `primaryPosition`, `season`. Position `X` (69) = managers, executives, umpires, pioneers: drop them. |
| Season lines | `GET /api/v1/people?personIds={50 ids}&hydrate=stats(group=[hitting,pitching],type=[yearByYear],sportId=1)`: 6 requests for the pool. `stat.age` uses the June 30 age. |

The pool: 283 players with MLB-level lines (197 hitters, 86 pitchers, split
by `primaryPosition` P). 34 have Negro League seasons, which `sportId=1`
returns as MLB seasons (Mays, 1948 Birmingham). 43 began before 1901.

Fields by era: hitters before about 1950 lack CS, IBB, SF and sometimes SO.
Pitchers have the full set. So the card uses only fields every era has.

Size: cumulative lines for 283 players are 181 KB minified, 73 KB gzipped.

## Decisions (recommended)

1. **Match on age, not on season count.** A season count makes a September
   debut a full season (Maddux 1986, 6 G), and military gaps and Negro League
   seasons change the count. (ScriMLB's Mays 5-season HR of 152 skips 1948.
   With 1948, it is 116.) Age has none of these problems.
2. **Traded seasons: one row per season.** Use the `numTeams` total row when
   it exists, otherwise the one row. Reuse `aggregateSplits`.
3. **Pool: every inductee, not a hand-picked list.** Show the **nearest two or
   three** Hall of Famers at the same age by the headline stat, one above the
   player and one below where possible. A fixed "vs. Willie Mays" reads as spin.
4. **Stats.** Hitters: H, HR, WAR (1901 onward). Pitchers: W, SO, IP, WAR, and
   SV for relievers. One headline stat per card, chosen by the player's role.
5. **Who gets the card.** MLB players with at least two MLB seasons and a
   career that started at age 30 or younger (inference: before that the
   comparison means little). Retired players get it too. The card then reads
   "Through age {last}".

## Card

- Head: "Hall of Fame pace". Note: "Hall of Famers at the same age".
- One row per stat: the player's total, then two or three nearest Hall of
  Famers with their totals at that age, each name linked to the player page.
- Caption: "Ages use MLB's June 30 rule. Negro League seasons count as MLB
  seasons. WAR is MLB's own calculation, from 1901."
- No tier colours and no emoji. Follow the shared-grammar direction Gary picks
  in PR #1841 for the rank and bar look.

## Slices

| # | What | Files (≤ 5) | Pattern | Done test |
|---|---|---|---|---|
| 1 | Generator: pull the pool, write cumulative-by-age lines | `scripts/gen-hof-pace.mjs`, `public/data/hof-pace.json`, `docs/scripts/generators.md`, `package.json` script | `gen-war-history.mjs` (hand-run, yearly) | Output has 280+ players; Mays at age 24 matches the API by hand |
| 2 | Pure rule: nearest comps at an age | new module beside `api/person/milestones.js` (a subfolder if the dir cap requires), a test, `spoiler-manifest.json` | `milestones.js` | Tests: traded season counted once; age gap; a retired player; under `?d=` the date-cut register totals are used |
| 3 | Card on the Stats tab | `components/playerstats/HofPaceCard.jsx`, `screens/player/PlayerStatsTab.jsx`, one CSS partial | `MilestoneWatchCard.jsx` | Chromium 390 px, `?nointro`: an active star, a rookie (no card), a retired HOF player |
| 4 | Yearly refresh note | the nightly workflow comment or `docs/scripts/generators.md` | `gen-war-history` notes | Lint passes |

Model: Sonnet for slices 1, 2 and 4; Opus for slice 3.

## Out of scope

- Players who were not inducted (Trout, Pujols in ScriMLB's list).
- Projection ("on pace for 600 HR"). Milestone Watch owns projection.
- MiLB and Negro League careers before their MLB-tier seasons.

## Spoiler-rule impact

None. The player page is an open surface (ADR-0034). The file is historical.
Two edges to state in the code:
- On a live page a game in progress today can count in this season's total,
  the same as every season line.
- Under a `?d=` cutoff, use the date-cut register totals, not `stats=career`
  (Milestone Watch has the same rule).

## Questions for Gary

1. Match on age (recommended) or season count?
2. Nearest Hall of Famers (recommended), or a few famous names?
