# Matchup Scout: design spec

**Issue:** #1408 (parent). Phase 1 is #1410. Phase 2 is #1411.
**Status:** Design pass, 2026-10-02. No real page exists yet.
**Prototype:** `/design-lab?nointro#prototypes` (band "Five — prototypes"),
code in `src/screens/designlab/scout/`. It uses invented data only.

This spec settles four questions: A (the 13 regions), B (the two maps and the
pitch type), C (controls and states) and D (the head-to-head list). Each
section gives the decision, the rejected alternative and the reason. "Open for
Gary" at the end lists the items that this pass cannot settle.

**Verified** means that I measured it in this pass. **Inference** means that
it is my reading, not a measurement.

## Change after the first draft

The first draft showed one row per pitch type, with two maps in each row.
Gary asked for **two maps only**: one for the pitcher and one for the hitter.
Pills flip the two maps through the pitch types and the other choices. Gary
also asked to reuse the pitch animation from the Now Pitching card (#1344).
This spec describes the two-map page. The issue body's sketch is out of date
on this point.

## A. The 13 regions

### Decision

Both maps draw the same 13 regions. Each region is a rectangle of whole 5x5
cells. Rows run from top (0) to bottom (4). Columns use the feed frame: column
0 is the third-base side and column 4 is the first-base side.

| Region | 5x5 cells | Cells |
| --- | --- | --- |
| 9 inner regions | rows 1-3, columns 1-3, one cell each | 9 |
| High | row 0, columns 0-4 (the two top corners included) | 5 |
| Low | row 4, columns 0-4 (the two bottom corners included) | 5 |
| Third-base side | column 0, rows 1-3 | 3 |
| First-base side | column 4, rows 1-3 | 3 |

```
Pitcher's view (from centre field)        Hitter's view (from behind the plate)
first-base side      third-base side      third-base side      first-base side
┌───────────────────────────────┐         ┌───────────────────────────────┐
│             HIGH              │         │             HIGH              │
├─────┬─────┬─────┬─────┬───────┤         ├───────┬─────┬─────┬─────┬─────┤
│ 1B  │     │     │     │  3B   │ ┆R┆     ┆R┆│  3B   │     │     │     │ 1B  │
│ side│  the zone's nine │ side  │ ┆ ┆     ┆ ┆│ side  │  the zone's nine │ side│
│     │     │     │     │       │ ┆ ┆     ┆ ┆│       │     │     │     │     │
├─────┴─────┴─────┴─────┴───────┤         ├───────┴─────┴─────┴─────┴─────┤
│              LOW              │         │              LOW              │
└───────────────────────────────┘         └───────────────────────────────┘
  R = a right-handed hitter's box: always on the third-base side.
```

- `REGION_OF` in `src/screens/designlab/scout/model.js` is the only table. The
  stored 5x5 shards do not change. The roll-up is a read-time sum.
- The existing pitcher shards (`public/data/pitch-command/`) work unchanged.
- `test/scout-design.test.js` pins the partition: every cell is in one region,
  every region is a rectangle, and the inner nine are the `inZone` cells.

### Why the corners go to High and Low

**Verified** on the 2026 MLB pitch-command shards on `origin/main` at
`8d0836c30` (713,860 pitches, every pitcher, both batter sides, columns turned
so that "inside" means inside for each stance). Whiff per swing:

| Cell group | Share of pitches | Swing % | Whiff per swing |
| --- | --- | --- | --- |
| Low-inside corner | 3.6% | 19.5 | 71.5% |
| Low-away corner | 5.8% | 21.2 | 71.3% |
| Low, middle three | 12.5% | 40.5 | 47.9% |
| Inside side, zone height | 7.6% | 43.2 | 16.3% |
| Away side, zone height | 13.5% | 32.7 | 28.4% |
| High-inside corner | 2.3% | 23.2 | 26.0% |
| High-away corner | 4.3% | 10.1 | 35.6% |
| High, middle three | 10.8% | 44.4 | 30.6% |

- The low corners behave like the low band. They do not behave like the sides.
- **Inference:** the high corners are closer to the high band (26.0 and 35.6
  against 30.6) than to the sides (16.3 and 28.4).
- **Hitter side.** The Phase 0 agent measured the same layout on hitter rows
  (comment on #1410, 2026-10-02): with hands pooled, 84.9% of pitches are in a
  region above the whiff floor and 72.1% above the xwOBA floor. By pitcher
  hand, 68.7% and 47.8%. That agent reached the same layout on its own.

### Rejected

- **Corners to the sides** (each side a full column of 5 cells). The away side
  would then mix the low-away corner (71.3% whiff per swing) with the
  zone-height away cells (28.4%). One region would hold two different pitches.
- **A pinwheel** (each outer region takes one corner, 4 cells each). Equal
  sizes, but the mirror changes the pinwheel's direction. The same region
  would hold different corners in the two views.
- **Savant's zones 11-14.** They are quadrants. The top-centre ring cell
  crosses their centre line, so they are not unions of 5x5 cells.

### Reads well on a phone

At 375 px each map is about 150 px wide (two maps side by side). An inner
cell is then about 27 px wide. Three mono figures at `--fs-cell` (11 px) fit
in it. Four do not: ".381" touched the next cell in the first screenshot. So
a cell prints xwOBA without its leading point ("381"). The expected line under
the maps keeps the point (".263"). See "Open for Gary", item 2.

## B. The two maps and the pitch type

### Decision

```
PHONE (375 px)                              TABLET / DESKTOP (≥ 740 px, screen 960 px)
┌──────────────────────────────┐            ┌──────────────────────────────┬───────────────┐
│ [Pitcher search][Hitter srch]│            │ [Pitcher search]       [Hitter search]        │
│ Pitch (All)(Fastball 44%)(Sl→│ scrolls    │ Pitch (All)(Fastball 44%)(Slider 24%)…│ HEAD TO HEAD  │
│ ┌──────────────────────────┐ │            │ ┌────────── scene ─────────┐ │ As-of banner  │
│ │ scene (Hitter's view)    │ │            │ └──────────────────────────┘ │ PA  slash     │
│ └──────────────────────────┘ │            │  PITCHER map    HITTER map   │ K   BB        │
│  PITCHER map  │  HITTER map  │            │  location %     xwOBA (est.) │ date round …  │
│  location %   │ xwOBA (est.) │            │ Expected xwOBA (est.) .265   │ date round …  │
│ Expected xwOBA (est.)  .265  │            │ View / Scope / Hand / Metric │               │
│ View  Scope  Hand  Metric    │            │ colour key                   │               │
│ colour key                   │            └──────────────────────────────┴───────────────┘
│ HEAD TO HEAD …               │
└──────────────────────────────┘
```

1. **Two maps, side by side.** Left: where the pitcher throws, as a share of
   the selected pitches, against this hitter's stance. Right: the hitter's
   result in each region, one metric at a time. The two maps stay side by side
   at every width; the phone does not stack them.
2. **Pitch pills flip both maps.** The first pill is **All**. Then one pill per
   pitch type at or above 5% use, most used first, at most 6. Each pill shows
   the name and the usage % ("Slider 24%"). A type under 5% is in All and has
   no pill. On a phone the pill row is one line that scrolls sideways, so a
   flip never moves the maps. On a wide screen the row wraps.
3. **Usage % and mph come from `pitchTiles`** (`src/lib/pitcherCard/card.js`),
   the Now Pitching card's helper. The integer shares add to 100, as on that
   card. Velocity shows under the pitcher map when one type is selected.
4. **The Now Pitching scene** (`PitchScene.jsx`) plays above the maps **in the
   Hitter's view only**, and only the selected pitch (all pills' pitches for
   All). **Verified** in `src/lib/pitcherCard/scene.js`: its camera stands 6 ft
   behind the plate and looks at the mound, and `+x` is the catcher's right.
   That is the Hitter's view. In the Pitcher's view the arcs would break the
   other way from the maps below them.
5. **Expected line.** "Expected {metric} · {pitch}" under the maps. For one
   type: the sum over regions of (pitcher share × hitter value). A thin region
   uses the hitter's whole-type value. For All: the usage-weighted mean of the
   pilled types, with "{n}% of pitches" beside it. It shows "—" when the
   pitcher map or the hitter's whole-type value is under its floor.
6. **Counts.** Under the pitcher map: "{n} pitches" (and mph for one type).
   Under the hitter map: "{n} pitches seen". Each hitter region prints its
   value and, below it, the count its floor uses.

### Colour scales (tokens only)

| Map | Scale | Tokens |
| --- | --- | --- |
| Pitcher | Sequential, 4 steps of the share, relative to the busiest region | `--clay` at .10 / .20 / .30 / .40 (the Command Map's ramp, `26d-command-map.css`) |
| Hitter | Diverging against the league rate in the same region and pitch type, 5 steps | below: `--allstar-blue` .36 / .16; near: `--surface-card`; above: `--award-line` .20 / .40 |
| Under the floor | No value, count only | a pencil hatch: `--graphite-soft` lines on `--surface-card` |

- Steps for xwOBA: ±.030 and ±.070. For whiff % and swing %: ±4 and ±10
  points. **Inference:** these are a starting point; tune them on real data.
- Floors: 10 plate-appearance-ending pitches for xwOBA, 10 swings for whiff %,
  10 pitches for swing % (see "Open for Gary", item 3). The pitcher map uses
  `MIN_COMMAND_PITCHES` (50) from `src/api/commandMap.js`: under it, every
  region is hatched and prints its count.

### Rejected

- **One row per pitch type, two maps per row** (the first draft). Gary chose
  two maps and pills: one screen shows the whole answer, and a flip compares
  types in place.
- **The same clay ramp on both maps.** One hue would mean a share on the left
  and a result on the right.
- **Good/bad colours** (`--accent-positive` / `--accent-negative`). The page
  serves both sides of the matchup. "Above league" is not good or bad.
- **A gray tint for "under the floor".** In the screenshot it read as a step
  of the navy scale. A hatch cannot read as a colour step.
- **The scene in both views.** The arcs would contradict the maps in the
  Pitcher's view.

## C. Controls and states

### Controls

| Control | Options | Default | One line at 375 px? |
| --- | --- | --- | --- |
| Pitch | All, then each type ≥ 5% | All | One line that scrolls sideways |
| View | Pitcher's / Hitter's | Pitcher's (ADR-0077) | Yes |
| Scope | Regular / Postseason / All | All | Yes |
| Hand | All / vs R / vs L | All | Yes |
| Metric | xwOBA (est.) / Whiff % / Swing % | xwOBA (est.) | **No**: "Swing %" wraps to a second line |

- **Verified** in the 375 px screenshots of the prototype. The Design Lab
  stage gives the page about 317 px of content. The real page has 343 px;
  Phase 1 must check the Metric row again there.
- All controls are `Pill role="control"` (`aria-pressed`), in labelled
  `role="group"` rows, the same as `CommandMap`'s chips. No native `title=`
  tooltip.
- **The mirror.** View changes only the drawing. `projX` in `model.js` is
  `sx(px)` for the Pitcher's view and `sx(-px)` for the Hitter's view;
  `drawCol` is `viewCol` and its identity. A region's rect and the batter's
  box come from that projection, so the mirror moves them together.
  `test/scout-design.test.js` checks a lattice of pitches: in both views, the
  drawn point is inside the region that counts it.
- **Hand** chooses the pitchers in the hitter's map. It does not change the
  pitcher's map: the pitcher throws with one hand.
- **Switch hitter.** He bats opposite the pitcher's hand (Phase 0, Lindor
  2025, no exceptions). "All" would add his left-handed and right-handed
  stances into one map, so the third-base side would be inside for one half
  and away for the other. So for a switch hitter "All" is off, and Hand opens
  on this pitcher's hand. Each map draws the stance box of its own data. With
  "vs L" against a right-hander, the two maps show two different boxes. See
  "Open for Gary", item 1.
- **Persistence (Phase 1).** View, Scope, Hand, Metric and Pitch go in the URL
  (`?view=hitter&scope=post&hand=r&metric=whiff&pitch=SL`) and in
  `localStorage`. Not in My Tally: its set is closed at four fields
  (ADR-0039).

### States

| State | What shows |
| --- | --- |
| Empty | Two empty search fields and "Pick a pitcher and a hitter". No controls. |
| Loading | The fields, then the house `Loader` (`AsyncStatus`). |
| No head-to-head on file | The maps as usual. The list shows "No head-to-head on file". The same label shows for a Savant failure (fail soft). |
| Not posted | The pitcher map as usual. The hitter map is replaced by "Not posted". The expected line shows "—". |
| Postseason, almost no pitches | Every region on both maps is hatched with its count. The pitcher caption says "Under 50 pitches". The expected line shows "—". |

### Rejected

- **A slider for the pitch type.** A pill names the pitch and its share; a
  slider position names nothing until it moves.
- **"All" hands for a switch hitter**, pooled in a batter frame (inside/away).
  It would break the rule that the cell a pitch is counted in is the cell the
  map draws.

## D. The head-to-head list

### Decision

```
HEAD TO HEAD
[View as of a date]                  ← AsOfBanner; "Stats entering Oct 8, 2025" when dated
┌──────────────┬──────────────────┐
│ PA  9        │ AVG/OBP/SLG      │
│              │ .375/.444/.875   │
│ K   3        │ BB  1            │
└──────────────┴──────────────────┘
DATE      ROUND  RESULT  PITCH      PITCHES
9/12/26   (REG)  K       Slider     5
10/27/25  (WS)   2B      Changeup   4
10/15/25  (LCS)  FO      Slider     1
```

- The total line is a `FactGrid`: PA, the slash line, K, BB.
- One row per plate appearance, newest first, in the house `Table`
  (`density="tight"`, so it fits the 300-360 px rail on a wide screen).
- Round tag from Savant `game_type`: R → REG, F → WC, D → DS, L → LCS,
  W → WS, as a `Pill` tag (read, not pressed).
- Result: scorebook shorthand from `events` (and `bb_type` for an out): K, BB,
  IBB, HBP, 1B, 2B, 3B, HR, SF, E, DP, GO, FO, LO, PO.
- Pitch: the last pitch's type, by name (`pitchLabel`), not by code.
- Scope filters the list too: Regular keeps R rows; Postseason keeps the rest.
- **The cutoff.** The list and its totals count only games dated **before**
  the cutoff: today (`isoToday`, UTC), or `?d=` when present. A game dated on
  the cutoff never shows. `h2hBefore` filters once, and `h2hTotals` reads the
  same rows, so the line and the list always agree. The fixture's last row is
  dated today, every load, and the test checks that the filter hides it.
- `AsOfBanner` is the way to change the cutoff, as on the player and team
  pages. Phase 1 sends Savant `game_date_lt` = the day **before** the cutoff,
  because Savant's date bounds are inclusive (#1408, verified there).

### Rejected

- **statsapi `vsPlayer`** as the source. It returns the regular season only
  by default, and its career split counts each plate appearance twice
  (#1408). It stays a cross-check.
- **A seal on today's meeting.** This is an open surface (ADR-0034). The date
  cutoff is the seal (ADR-0087, ADR-0088).

## Open for Gary

1. **Switch hitter and "All" hands.** The prototype turns "All" off and opens
   on this pitcher's hand. The alternative pools his two stances in an
   inside/away frame, but then a stored cell no longer draws where it was
   counted. Keep "All" off?
2. **xwOBA in a map cell prints without its leading point** ("381"), because
   four characters do not fit at phone size. The expected line keeps ".381".
   Acceptable?
3. **Swing % floor.** The spike set floors for whiff % and xwOBA only. I used
   10 pitches for swing %. Confirm.
4. **The expected line follows the metric** ("Expected whiff %"), so it is
   always built from the map on screen. The issue defined it for xwOBA only.
   Keep it for all three metrics?
5. **Which hand feeds the expected line?** It uses the Hand control. With
   "All", the hitter's half against left-handers counts too, although this
   pitcher throws right. **Inference:** a "vs this pitcher's hand" value is
   more relevant but thinner (47.8% of pitches above the xwOBA floor).
6. **The Now Pitching scene in the Hitter's view only.** The lazier option
   shows it in both views with a "from behind the plate" label. Which?
7. **The date picker's floor.** `asOfBounds` stops at January 1 of the current
   year, so the picker cannot set a cutoff in an earlier season. Verified: a
   pick of 2025-10-08 became 2026-01-01. `?d=` in the URL still works. Widen
   the floor for this page, or leave it?
8. **Two different stance boxes** (a switch hitter with "vs L" against a
   right-hander). Keep, or lock the hitter map to the matchup's stance?
9. **Phase 1 tag.** Until #1411 ships, the maps say "Regular season" and Scope
   moves only the list (#1408). The prototype shows the Phase 2 behaviour.

## What Phase 1 (#1410) can reuse

| Prototype part | Phase 1 home | Notes |
| --- | --- | --- |
| `REGION_OF`, `rollUp`, `projX`, `drawCol`, `regionRect`, `stanceRect`, `mapBox` (`model.js`) | `src/lib/zone/` beside `zoneGeometry.js` | Move `test/scout-design.test.js` with them. |
| `hitterRegions`, `typeValue`, `band`, `expected`, `METRICS` | `src/api/scout/` | Spoiler-free: add manifest entries. |
| `h2hBefore`, `h2hTotals`, `ROUND`, `resultShort` | `src/api/scout/` | Feed them Savant rows; keep the cutoff test. |
| `ZoneMap.jsx` | `src/components/charts/` | Pure: takes cells, view and stance. |
| `HeadToHead.jsx` | `src/screens/scout/` | Already on `FactGrid`, `Table`, `Pill`, `AsOfBanner`. |
| `styles/designlab/scout.css` | a per-route partial in a subdirectory | `src/styles` is at its file budget. Drop the `.scout__lab` rule. |
| `PitchScene` + `pitchTiles` + `scenePitches` | already shared | No change. |

Do not reuse `fixture.js`, the Lab rows, or `leagueRegions` (it averages
cell rates; the real league store holds sums).
