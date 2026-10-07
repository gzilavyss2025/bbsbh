# Matchup Edge: research notes and working model

**Date:** 2026-10-07. **Data as of:** 2026-10-06 (`asOf` in the pitch-arsenal shard).
**Issue:** the GitHub issue "Matchup Edge" links to this folder.
**Status:** research only. Nothing here is in the app. Two scripts reproduce every
number below.

Read this file before you start work on the issue. It holds all of the research,
so you do not need to redo it.

## What Gary asked for

A scouting report on the Brewers hitters against Walker Buehler. It grew into a
question: can Tally show, for any pitcher and lineup, who has the edge? Gary
wants it simple. The Matchup Scout (#1408, #1411, both closed) already draws
pitch-location maps. This work adds a ranked list of hitters on top of the same
data.

## Short answer, for the Brewers vs. Buehler example

Buehler is a cutter and fastball pitcher. His whiff rate is below league on every
pitch type. Brewers lefties who handle fastballs and cutters (Bauers, Mitchell,
Turang) have the edge. Frelick and Hamilton have the least. Righties are below
league against him because his locations avoid damage.

## Files in this folder

- `hitter-by-pitch.mjs`: each Brewers hitter's results by pitch type against
  right-handed pitchers (pitches, swing %, whiff % per swing, xwOBA).
- `matchup-model.mjs`: Buehler's profile by pitch, and the expected-xwOBA model.
- Run either one from the repo root: `node .scratch/matchup-edge/matchup-model.mjs`.
  Both read `public/data/` only. They need no network.
- Both scripts hard-code the Buehler id (621111) and the 13 Brewers ids. They
  are one-off scripts. Turning them into a module is the main task.

## Data sources (all verified on 2026-10-07)

### MLB Stats API (`statsapi.mlb.com`)

The sandbox blocks this host (ENOTFOUND). Run curl with the sandbox off.

| Call | Gives |
|---|---|
| `/api/v1/people/search?names=Walker%20Buehler` | Buehler id: **621111** |
| `/api/v1/teams/158/roster?rosterType=active` | Active Brewers roster |
| `/api/v1/people/{id}/stats?stats=vsPlayerTotal&group=hitting&opposingPlayerId=621111` | Career line of a hitter against one pitcher. A hitter with no history returns an empty split. |
| `/api/v1/people/{id}/stats?stats=pitchArsenal&group=pitching&season=2026` | A pitcher's pitch mix (share, count, average speed). For a **hitter** the same call gives pitches SEEN, not results. |
| `/api/v1/people/{id}` | `batSide.code` (L, R or S) |

### Repo data (`public/data/`, spoiler-free season sums over Final games)

Cells are a 5x5 grid in row-major order (25 values). Row 0 is the top. Column 0 is
the third-base side (feed frame). The nine inner cells are indexes
`6,7,8,11,12,13,16,17,18`.

- `hitter-grid/2026/{personId % 100, 2 digits}.json`:
  `{ season, xwoba, bat, post }`. Path:
  `bat[id].mlb[pitchCode][pitcherHand][batterSide]` is
  `{ pitches, swings, whiffs, paEnd, wobaFixed, xwobaBip, bipUntracked }`, each a
  25-value array. All-zero counters are left out. ADR-0096 and ADR-0097.
- `hitter-grid/2026/league.json`: same shape, summed over every hitter:
  `bat.mlb[code][pitcherHand][batterSide]`.
- `pitch-command/2026/{NN}.json`: `pit[id] = { throws, mlb: { [code]: { L|R:
  { cells, whiffs, calledStrikes, homers, swings, firstPitch } } } }`. The `L|R`
  key is the **batter side**. It has no xwOBA allowed.
- `pitch-arsenal/2026/{NN}.json`: `pit[id] = { name, teamId, mlb: [{ code,
  description, pitches, avgVelo, century, maxVelo, tto, vs: { L, R } }] }`.
- Reader that exists: `src/api/scout/hitterGrid.js` (spoiler-free, one season per
  read). Also `src/api/scout/headToHead.js`.
- xwOBA uses a per-season lookup on exit velocity and launch angle (ADR-0097). A
  PA-ending pitch counts in `paEnd`. xwOBA of a cell is
  `(xwobaBip + wobaFixed) / paEnd`.
- Spoiler rule: season and career stats are open, outside the scoring flow
  (ADR-0034). This page is not a scoring surface.
- Pitch codes: FF four-seam, SI sinker, FC cutter, SL slider, ST sweeper,
  KC knuckle-curve, CH changeup.

## Results: Buehler (2026, regular season, MLB)

Mix overall: cutter 24%, four-seam 20%, sinker 20%, slider 11%, changeup 9%,
knuckle-curve 8%, sweeper 7% (2,606 pitches).

Mix by batter side (pitches from `pitch-command`):

- Vs lefties: cutter 29%, four-seam 20%, changeup 16%, sinker 15%, knuckle-curve
  10%, slider 6%, sweeper 3%.
- Vs righties: sinker 26%, four-seam 20%, cutter 19%, slider 16%, sweeper 12%,
  knuckle-curve 6%, changeup 1%.

| Pitch | Pitches | Zone % | Whiff per swing (league vs RHP) | Called + whiff % | HR |
|---|---|---|---|---|---|
| FF | 522 | 41% | 14% (19%) | 29% | 4 |
| SI | 521 | 48% | 10% (12%) | 32% | 0 |
| FC | 645 | 40% | 15% (21%) | 24% | 5 |
| SL | 269 | 37% | 22% (32%) | 22% | 2 |
| ST | 183 | 32% | 27% (30%) | 23% | 4 |
| KC | 219 | 32% | 29% (33%) | 22% | 2 |
| CH | 247 | 30% | 27% (29%) | 18% | 5 |

Location factors (his locations vs. league damage; below 1 means less damage):

- Vs L: FF .99, SI .95, FC .97, SL 1.07, ST 1.07, KC .90, CH .99.
- Vs R: FF .89, SI .94, FC .93, SL .94, ST .91, KC 1.01. (No changeup: under 30.)

## Results: Brewers career line against Buehler

| Hitter | PA | AB | H | HR | RBI | BB | K | AVG/OBP/SLG |
|---|---|---|---|---|---|---|---|---|
| Yelich | 6 | 6 | 2 | 0 | 0 | 0 | 2 | .333/.333/.333 |
| Turang | 5 | 4 | 1 | 0 | 1 | 1 | 1 | .250/.400/.750 (1 triple) |
| Bauers | 5 | 5 | 1 | 1 | 1 | 0 | 1 | .200/.200/.800 |
| Mitchell | 5 | 3 | 1 | 0 | 0 | 2 | 1 | .333/.600/.333 |
| Contreras | 5 | 4 | 0 | 0 | 0 | 1 | 1 | .000/.200/.000 |
| Chourio | 4 | 3 | 1 | 0 | 2 | 1 | 0 | .333/.500/.333 |
| Hamilton | 2 | 2 | 1 | 0 | 0 | 0 | 0 | .500/.500/.500 |
| Frelick | 2 | 2 | 1 | 0 | 0 | 0 | 0 | .500/.500/.500 |
| Ortiz | 2 | 2 | 0 | 0 | 0 | 0 | 0 | .000 |
| Lara | 2 | 2 | 0 | 0 | 0 | 0 | 1 | .000 |
| Vaughn, Pratt, Sánchez | 0 | | | | | | | no history |

Bat sides: Vaughn R, Turang L, Yelich L, Pratt R, Hamilton L, Mitchell L,
Sánchez R, Chourio R, Bauers L, Ortiz R, Lara S, Frelick L, Contreras R.
Player ids are in the two scripts.

## The model (`matchup-model.mjs`)

For hitter h with batting side s, against a right-handed pitcher:

1. **Hitter skill by pitch.** `hxS = (hitterX + 60 * lgX) / (hitterPA + 60)`.
   `hitterX` is the sum of `xwobaBip + wobaFixed` over his cells for that pitch,
   `hitterPA` is the sum of `paEnd`, and `lgX` is the league xwOBA for that pitch
   and side. 60 is the shrinkage constant `K_X`. Whiff per swing uses the same
   shape with 75 swings (`K_W`).
2. **Pitcher location factor.** `xf = sum over cells of (Buehler share of the
   pitch in the cell * league (x+f)/pitches in that cell) / league overall
   (x+f)/pitches`. The whiff factor `wf` is built the same way from whiffs per
   pitch. A pitch with fewer than 30 Buehler pitches to that side is dropped.
3. **Weights.** `mix * leaguePAendPerPitch` for xwOBA, and
   `mix * leagueSwingRate` for whiff. `mix` is Buehler's share of that pitch to
   that side.
4. **Expected xwOBA** = weighted sum of `hxS * xf`. The league baseline is the
   weighted sum of `lgX` with the same weights. The report shows the difference.
5. **Expected whiff per swing** = weighted sum of `hwS * wf`.

The constants (60 and 75) are guesses. Nobody has tested them.

### Output (13 Brewers hitters)

| Hitter | Side | Season xwOBA vs RHP (PA) | Expected vs Buehler | vs league | Expected whiff per swing (league) |
|---|---|---|---|---|---|
| Bauers | L | .381 (412) | .357 | +.022 | 24% (21%) |
| Mitchell | L | .354 (399) | .348 | +.013 | 27% (21%) |
| Turang | L | .361 (472) | .347 | +.012 | 18% (21%) |
| Contreras | R | .348 (455) | .302 | −.010 | 20% (23%) |
| Pratt | R | .325 (193) | .300 | −.012 | 21% (23%) |
| Yelich | L | .316 (365) | .323 | −.012 | 24% (21%) |
| Lara | L | .306 (136) | .321 | −.014 | 19% (21%) |
| Chourio | R | .332 (400) | .296 | −.016 | 23% (23%) |
| Vaughn | R | .322 (196) | .294 | −.018 | 21% (23%) |
| Sánchez | R | .332 (150) | .293 | −.018 | 23% (23%) |
| Ortiz | R | .299 (263) | .288 | −.024 | 20% (23%) |
| Hamilton | L | .285 (296) | .307 | −.028 | 18% (21%) |
| Frelick | L | .278 (282) | .305 | −.030 | 15% (21%) |

Hitter results by pitch type (first pass, `hitter-by-pitch.mjs`) show the
pieces behind these numbers. Notable: Mitchell cutter xwOBA .536 (27 PA) and
50% changeup whiffs; Turang cutter .491, sinker .447, changeup .274; Bauers
sinker .509; Hamilton cutter .208 and changeup .247; Vaughn sweeper .182;
Sánchez slider .191 (38% whiffs); Ortiz slider .205.

## Caveats you must keep

- Hitter numbers are against **all** right-handed pitchers. They do not reflect
  Buehler's velocity, spin or movement. The model adjusts for location only.
- Many pitch-type samples are under 30 PA (cutter, sweeper, knuckle-curve). The
  shrinkage pulls those toward league, so a middle result can mean "no data".
- The pitcher's location factors are all below 1 against righties, so every
  righty reads low against him. Part of the delta is Buehler, not the hitter.
- Lara is a switch hitter. The run models him as a lefty against a righty.
- League whiff per swing mixes both batter sides. Buehler's does too.
- The model was **not backtested**. The ranking is reasoned, not proven.
- One season per read (ADR-0096: the 2026 zone is not the 2025 zone). Early in
  a season the samples are small.
- `pitch-command` has no xwOBA allowed per pitch. Pitch results for the pitcher
  come from whiff rate, zone % and home runs only.

## Peer-site research (2026-10-07)

Added to `docs/peer-sites.md` in PR #1681. Every row there says "search result
only; not read in full". What each method does:

- **Savant pitch arsenal stats** (`baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats`):
  pitchers and hitters split by pitch type: run value, whiff rate, xwOBA. The
  common view of "what a hitter does against a pitch".
- **FanGraphs pitch type linear weights**
  (`library.fangraphs.com/pitching/linear-weights`): runs above or below average
  per 100 pitches, by pitch type.
- **Stuff+, Location+, Pitching+** (Eno Sarris and Max Bay): Stuff+ grades
  velocity, spin, movement and release point. Location+ grades hitting the spot
  for the count and pitch type. Pitching+ combines both. Needs spin and
  movement, which the MLB live feed does not carry.
- **PLV** (Pitcher List): each pitch gets a 0 to 10 score from a machine
  learning model, plus a `plvLocation+` that uses only the end location.
  Decision Value grades each swing or take.
- **aStuff+ v2** (Adam Salorio, Substack): an independent Stuff+ model.
- **SEAGER** (Robert Orr): selective aggression, a swing-decision season metric.
- **Savant bat tracking**: bat speed, squared-up rate, blasts (a fast swing that
  squares the ball up), swing length, attack angle (5 to 20 degrees is "ideal"),
  attack direction, tilt. See `docs/peer-sites.md`, "Data notes", for the lag
  measured on 2026-10-06: `/gf` `batSpeed` median 162 s and p90 479 s; the swing
  path fields exist only in the Statcast CSV.
- **Ballpark Pal Matchup Machine**: a batter-vs-pitcher tool on contact quality.
- **MLB.com "best hitter against each pitch type"**: a yearly story.

A claim common to these sites, not checked by us: a hitter's results against the
pitcher's pitch types predict better than head-to-head history.

## Design: how to combine the methods

Four layers, each a separate adjustment. Keep the pieces visible instead of one
blended number.

| Layer | Question | Source | Status |
|---|---|---|---|
| 1. Pitcher mix and locations | What does he throw, and where? | `pitch-arsenal`, `pitch-command` | Have it |
| 2. Pitch quality | How good is each pitch? | Stuff+ or PLV | **No source.** Needs a Savant pull. |
| 3. Hitter by pitch type | What does the hitter do against it? | `hitter-grid` | Have it |
| 4. Swing decisions | Will he chase what the pitcher throws off the plate? | `hitter-grid` (swings by cell) | Can build now, no new source |
| 5. Swing quality | Bat speed, squared-up, blasts | Savant `/gf`, CSV | Late and partial. Least reliable. |

Layers 1 and 3 carry most of the value. Add one layer at a time and keep it only
if a backtest shows a gain.

## Wireframe (phone width)

```
┌─────────────────────────────────────┐
│  ‹  MATCHUP                         │
│  Walker Buehler (R)                 │
│  vs  Milwaukee Brewers              │
│  [ Change pitcher ]  [ Change team ]│
├─────────────────────────────────────┤
│  HIS MIX                            │
│  vs lefties      vs righties        │
│  Cutter    29%   Sinker     26%     │
│  4-seam    20%   4-seam     20%     │
│  Changeup  16%   Cutter     19%     │
│  Sinker    15%   Slider     16%     │
│  Knuckle-c 10%   Sweeper    12%     │
│  (tap a row to see where he throws) │
├─────────────────────────────────────┤
│  WHO HAS THE EDGE                   │
│  Bauers     L    ▲▲   .357          │
│  Hits all his pitches; whiffs a lot │
│  Mitchell   L    ▲    .348          │
│  Crushes the cutter; 27% whiffs     │
│  Turang     L    ▲    .347          │
│  Good vs fastballs, rarely misses   │
│  Contreras  R    ▼    .302          │
│  Even across the mix                │
│  Frelick    L    ▼▼   .305          │
│  Makes contact, but little damage   │
├─────────────────────────────────────┤
│  Season stats through Oct 6.        │
│  Small samples shrink toward league │
│  average. [How this works]          │
└─────────────────────────────────────┘
```

Tap a hitter to expand: a table of pitch, share, his xwOBA, and who has the
edge, plus the career line against the pitcher.

Design rules:

- One number per hitter (expected xwOBA vs the pitch mix), shown with arrows
  against the league. One plain sentence explains it.
- One level of detail on tap. No zone maps in version one. The Matchup Scout
  pages carry the maps.
- The mix sits above the list.

## Open questions for Gary

1. Entry point: pick any pitcher and team, or open from a game and prefill the
   starter and the posted lineup?
2. Keep the career vs-pitcher line on the card? It is a tiny sample.
3. Does the Stuff+ pull earn its cost? Decide after the backtest.

## Suggested plan

1. Turn `matchup-model.mjs` into a module. It takes a pitcher id and a lineup
   (team roster, or a posted lineup) and returns the table. Put it beside
   `src/api/scout/`. It is spoiler-free: season sums only.
2. Backtest. Pick past pitcher-and-hitter pairs with real results. Check
   whether the model ranks better than the plain season stat. Tune the two
   constants. Never loosen a test to pass.
3. Add the chase layer (layer 4) from `hitter-grid`. Backtest it.
4. Build the page (the wireframe). Check it in `npm run dev` with `?nointro`.
5. Decide on Stuff+ and bat tracking after the backtest.

## Related

- Issues #1408 and #1411 (Matchup Scout, closed). `docs/scout-design.md`.
- ADR-0034, ADR-0094, ADR-0096, ADR-0097. `docs/peer-sites.md`.
- PR #1681 (peer-sites rows).
