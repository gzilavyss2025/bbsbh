# Matchup Scout: design spec

**Issue:** #1408 (parent). Phase 1 is #1410. Phase 2 is #1411.
**Status:** Design pass, 2026-10-02, then a polish pass the same day (section
E). No real page exists yet.
**Prototype:** `/design-lab?nointro#prototypes` (band "Five — prototypes"),
code in `src/screens/designlab/scout/`. It uses invented data only.

This spec settles four questions: A (the 13 regions), B (the two maps and the
pitch type), C (controls and states) and D (the head-to-head list). Section E
records the polish pass: ease of use, visual aids, headshots and motion. Each
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
in it. Four did not at normal letter spacing: ".381" touched the next cell in
the first screenshot. With `--ls-tight-score` letter spacing, ".381" is 23.6
units wide in a 27.1-unit cell (measured). So a cell prints ".381", the same
form as the expected line (Gary, item 2).

## B. The two maps and the pitch type

### Decision

```
PHONE (375 px)                              TABLET / DESKTOP (≥ 740 px, screen 960 px)
┌──────────────────────────────┐            ┌──────────────────────────────┬───────────────┐
│ MATCHUP             (Change) │            │ MATCHUP                               (Change)│
│ [shot]      vs      [shot]   │            │ [shot] Pitcher A   vs   [shot] Hitter B       │
│ Pitcher A        Hitter B    │            ├──────────────────────────────┬───────────────┤
│ Throws R         Bats L      │            │ Pitch (All)(Fastball 44%)…   │ HEAD TO HEAD  │
│ Pitch (All)(Fastball 44%)(Sl→│ scrolls    │ ┌ Expected xwOBA (est.) ───┐ │ As-of banner  │
│ ┌ Expected xwOBA (est.) ───┐ │            │ │ .265   ▢ League .259     │ │ PA  slash     │
│ │ .265   ▢ League .259     │ │            │ └──────────────────────────┘ │ K   BB        │
│ └──────────────────────────┘ │            │ View / Metric                │ date round …  │
│ View  Metric                 │            │ ┌────────── scene ─────────┐ │ date round …  │
│ ┌──────────────────────────┐ │            │ └──────────────────────────┘ │               │
│ │ scene (Hitter's view)    │ │            │  PITCHER map    HITTER map   │               │
│ └──────────────────────────┘ │            │  1B side 3B side  1B side 3B │               │
│  PITCHER map  │  HITTER map  │            │  readout: tapped region      │               │
│  1B side  3B  │ 1B side  3B  │            │  colour key                  │               │
│  readout: tapped region      │            │  Hand / Scope                │               │
│  colour key                  │            └──────────────────────────────┴───────────────┘
│  Hand  Scope                 │
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
5. **Expected line.** "Expected {metric} · {pitch} · {mph}" in the answer
   strip above the maps (section E moved it there). For one type: the sum
   over regions of (pitcher share × hitter value). A thin region uses the
   hitter's whole-type value. For All: the usage-weighted mean of the pilled
   types, with "{n}% of pitches" beside it. It shows "—" when the pitcher map
   or the hitter's whole-type value is under its floor. Beside it: the
   league's expected value on the same locations, with a swatch of the
   diverging scale for the gap.
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
  10 pitches for swing % (Gary, item 3). The pitcher map uses
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

| Control | Where | Options | Default | One line at 375 px? |
| --- | --- | --- | --- | --- |
| Pitch | Above the answer strip | All, then each type ≥ 5% | All | One line that scrolls sideways |
| View | Above the maps (it changes the drawing) | Pitcher's / Hitter's | Pitcher's (ADR-0077) | Yes |
| Metric | Above the maps (it changes the hitter map's meaning) | xwOBA (est.) / Whiff % / Swing % | xwOBA (est.) | **No**: "Swing %" wraps to a second line |
| Hand | Below the key (it changes the data pool) | All / vs R / vs L | All | Yes |
| Scope | Below the key (it changes the data pool, and the list) | Regular / Postseason / All | All | Yes |

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
  Gary, item 1.
- **Persistence (Phase 1).** View, Scope, Hand, Metric and Pitch go in the URL
  (`?view=hitter&scope=post&hand=r&metric=whiff&pitch=SL`) and in
  `localStorage`. Not in My Tally: its set is closed at four fields
  (ADR-0039).

### States

| State | What shows |
| --- | --- |
| Empty | Two empty search fields and "Pick a pitcher and a hitter". No controls. The prototype adds a "Use the invented pair" pill, which stands in for a pick. |
| Loading | The pair, then the house `Loader` (`AsyncStatus`). |
| No head-to-head on file | The maps as usual. The list shows "No head-to-head on file". The same label shows for a Savant failure (fail soft). |
| Not posted | The pitcher map as usual. The hitter map is replaced by "Not posted yet · Pitcher map only · nightly". The expected line shows "—". |
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

## E. The polish pass

Gary asked for ease of use, visual aids, the players' headshots, and
animation. Each change below gives the reason and the alternative it beat.
The decisions in A-D stand.

### Ease of use

1. **The order is the hierarchy.** Who (the pair), then the answer (the
   expected line), then the maps that explain it, then the readout for a
   tapped region, then the controls that change the data pool, then the
   list. Before, the answer sat under the maps and the key. A reader on a
   phone now sees the pair and the number on the first screen.
   *Rejected:* the answer under the maps (the first draft). The number is
   what the reader came for, and it was two screens down.
2. **A matchup header** (`Matchup.jsx`): two headshots, a name and a hand
   each, "vs" between, and a "Change" pill that goes back to the pickers.
   *Rejected:* keeping the two search fields on screen with the names in
   them. The names printed twice, and a field reads as a thing to type in.
3. **The controls split by what they change.** View and Metric sit above the
   maps: one changes the drawing, the other the hitter map's meaning. Hand
   and Scope sit below the key: they change the data pool. Every control is
   still a `Pill role="control"` row with a label.
   *Rejected:* one block of four rows under the maps. A thumb on a phone had
   to scroll past the maps to flip the view, then back up to see it.
4. **Tap a region for its exact figures.** Each region on both maps is a
   button (`role="button"`, `aria-pressed`, keyboard Enter/Space). A tap
   picks the region on both maps (a navy frame) and the readout line under
   the maps prints its name, the pitcher's share with its count ("6% · 75 of
   1,272 pitches") and the hitter's value with its count (".404 · 74
   PA-ending pitches"). Under the floor it prints "—" and "3 of 10
   PA-ending pitches". A second tap clears it. The line keeps its height when
   nothing is picked ("Tap a region for its numbers"), so a tap never moves
   the maps. No `title=` tooltip, no SVG `<title>`.
   *Rejected:* a hover tooltip. A phone has no hover, and a native tooltip
   cannot be styled or read by a screen reader.
5. **Region names** (`regionLabel`): "Up · inside · 3B side", "Heart", "Off
   the plate · away · 1B side", "High · above the zone". Inside and away
   follow the hitter's stance (a right-handed hitter's inside is the
   third-base side); the field side is always printed, so the name stays
   true in both views. Never "left" or "right". A test pins the words.
   *Rejected:* a bare cell id ("r1c3"). Nobody scores a game in cell ids.
6. **The empty state has a next step.** "Pick a pitcher and a hitter" plus,
   in the prototype, a pill that loads the invented pair. "Not posted" says
   what shows instead and when the rest arrives ("Pitcher map only ·
   nightly").

### Visual aids

7. **Side-of-field labels** under each map ("1B side" / "3B side"), in the
   order that view draws them (`sidesInOrder`). They turn with the mirror.
   *Rejected:* labels inside the SVG. They cost viewBox height on a 150 px
   map, and HTML text takes the typography tokens directly.
8. **Home plate** under the low band, the zone's width (`platePoints`).
   It is symmetric about the zone's centre, so the mirror never moves it,
   and a test checks that both views draw the same shape.
9. **The batter's box is wider and filled** (0.42 ft, `--surface-inset`),
   with the stance letter in heading ink. Before, a 0.25 ft dashed strip
   with a caption-grey letter read as a margin.
10. **A usage bar on each pitch pill**, along its foot, in the family's
    arsenal colour (the tokens the Now Pitching tiles and the scene's arcs
    use). The arsenal reads before any number does, and the bar links the
    pill to its arc in the scene. Selected, the bar goes paper, so the
    breaking-ball navy does not vanish on the navy fill. The pill's own skin
    is untouched (`test/pill-cascade.test.js` holds that).
    *Rejected:* a separate arsenal strip above the pills. A second row of
    the same five names.
11. **Velocity** moves into the answer strip's label ("Slider · 86.4 mph")
    and stays in the scene's bar. It left the pitcher map's caption.
12. **The answer against the league.** Beside the expected value: the
    league's expected value on the same locations (the pitcher's shares ×
    the league rate per region, the same `expected` sum) and a swatch of the
    diverging scale for the gap. The reader sees at once whether .265 is
    good for the pitcher or for the hitter, in the key's own colours.
    *Rejected:* colouring the big figure itself. A navy or amber number
    would read as a link or a warning.

### Headshots

13. **The house `Headshot` component**, twice, in the matchup header, at the
    `--shot-md-*` frame, with the compound `.shot.scout__shot` override every
    headshot host uses. The prototype's players are invented, so `personId`
    is `null` on purpose: the component walks straight to its monogram
    fallback with no photo request and no club mark, in the dev server and
    in the review build (which blocks every network image) alike. No fixture
    id was added, because the component needs none. **Phase 1 passes each
    person's real id and club**, and the same markup shows his silo cutout
    on his club's tint.
    *Rejected:* a drawn silhouette of our own. The app has one portrait, and
    its fallback chain is the point.

### Motion (`scout.css`, the "motion" block; `docs/motion.md` rules apply)

14. **One moment per tap.** A Pitch, Metric, Hand or Scope tap tweens every
    region's fill to its new tone (`--dur-med`, `--ease-standard`; SVG fill
    is animatable) and inks in the figures whose value changed from quarter
    ink (`scout-ink`, `--dur-med`; `ZoneMap` keys each figure on its value,
    so an unchanged number stays still and the eye lands on what moved).
    The usage bars settle on `--dur-slow`. The answer's big figure inks in
    the same way.
15. **A View tap turns the maps over.** The maps remount drawn in the new
    view, start turned 180° about their vertical axis — which is the old
    view's picture, since the mirror is a reflection — and turn to face the
    reader (`scout-turn`, the FlipCard's `--dur-flip` and `--ease-flip`).
    Keyed on the tap count, so a cold load, a return visit and a fixture
    change never turn. **Verified** in Chromium: the container's transform
    is the 180° matrix on the first frame after the tap and `none` at rest.
16. **The scene stays in sync.** It remounts on the selected pitch
    (`key={sel}`), and in the Hitter's view the pitch in flight lights its
    pill (`.is-inflight`, a navy edge through `--pill-edge`). With one pitch
    selected that is the selected pill; with All it walks the arsenal with
    the scene.
17. **Reduced motion: nothing moves.** The whole block sits under
    `@media (prefers-reduced-motion: no-preference)`. **Verified** in
    Chromium with `reduce`: every animation name is `none`, no transition is
    declared, and the scene shows its first pitch at full length
    (`PitchScene`'s own gate). Nothing rests under full opacity in either
    mode.
    *Rejected:* a cross-fade of the whole board on every tap. One effect for
    every change says nothing about which change it was.

### Not done, and why

- **A sentence under the answer** ("He throws the slider away, where the
  hitter is cold"). The page prints numbers, maps and labels, and generates
  no sentences.
- **Collapsing the Lab rows.** They are prototype-only and leave in Phase 1.
- **A sixth file for the readout.** It is one small function in
  `ScoutLab.jsx`; the directory holds six files of a ten-file budget.

## Decided by Gary (2026-10-02)

Gary answered every open item on 2026-10-02. These answers are the design.

| # | Item | Decision |
| --- | --- | --- |
| 1 | Switch hitter and "All" hands | "All" is off. Hand opens on this pitcher's hand. |
| 2 | xwOBA in a map cell | Print ".381" with its point, at 11 px, with `--ls-tight-score` letter spacing. The type scale stops at 11 px, so the font does not shrink. |
| 3 | Swing % floor | 10 pitches. |
| 4 | The expected line | It follows the Metric control (xwOBA (est.), whiff %, swing %). |
| 5 | The hand that feeds the expected line | The Hand control, the same data as the hitter map on screen. |
| 6 | The Now Pitching scene | Hitter's view only. |
| 7 | The date picker's floor | No change. `?d=` in the URL still reaches an earlier season. |
| 8 | Two different stance boxes | Keep. Each map draws the stance of its own data. |
| 9 | Phase 1 scope | The maps carry a "Regular season" tag. Scope changes only the head-to-head list until #1411. |
| 10 | The View flip | A half turn, -90° to 0. No mirrored digit shows. |
| 11 | Region names when the stances differ | The readout names only the side of the field ("Up · 3B side"). It drops inside and away. |
| 12 | The league value beside the answer | The league's flat rate for the pitch type, wherever it was thrown. The colour scale still compares each region with the league in that region. |
| 13 | "Change" in Phase 1 | It reopens the search fields with the pair filled in. |
| 14 | The in-flight pill | Keep. |
| 15 | The label of the Phase 1 hitter line | "xwOBA · Regular season". "xwOBA (est.)" stays for the #1411 estimate. |

## The Phase 1 data boundary

Gary approved this design on 2026-10-02. The data work for #1410 runs in
other sessions (Package A: #1417, Package B: #1415). I sent them the notes
below on 2026-10-02.

- **Until #1411 ships, there are no hitter region counts.** So Phase 1 draws
  the hitter map in its "Not posted" state. The right column shows the
  hitter's line for the pitch type from `estWoba` (#1415), tagged "Regular
  season".
- **Phase 1 shows no expected line.** With no hitter regions, the sum gives
  the hitter's whole-type value for every pitcher, which says nothing about
  the pitcher.
- **The head-to-head rows (#1417) need two more fields:** `pitchType` (the
  last pitch's `pitch_type`) for the Pitch column, and `bbType` (`bb_type`)
  for GO / FO / LO / PO. The list prints no Savant `des` sentence.
- **Inference, not tested:** a plate appearance that ends on a pitch-clock
  call has its `events` on a row with no `plate_x`. A parser that drops those
  rows first loses that plate appearance. The plate_x filter must apply only
  to the pitch count.
- **The #1411 shape the maps read:** for each season, hitter, pitch type,
  pitcher hand and scope (regular season or postseason), 25-cell sums of
  pitches, swings, whiffs, PA-ending pitches and wOBA value. The colour scale
  needs league sums of the same counters for each pitch type.

## What Phase 1 (#1410) can reuse

| Prototype part | Phase 1 home | Notes |
| --- | --- | --- |
| `REGION_OF`, `rollUp`, `projX`, `drawCol`, `regionRect`, `stanceRect`, `platePoints`, `mapBox`, `sidesInOrder`, `regionLabel` (`model.js`) | `src/lib/zone/` beside `zoneGeometry.js` | Move `test/scout-design.test.js` with them. |
| `hitterRegions`, `typeValue`, `band`, `expected`, `METRICS` | `src/api/scout/` | Spoiler-free: add manifest entries. |
| `h2hBefore`, `h2hTotals`, `ROUND`, `resultShort` | `src/api/scout/` | Feed them Savant rows; keep the cutoff test. |
| `ZoneMap.jsx` | `src/components/charts/` | Pure: takes cells, view, stance, the picked region and `onSelect`. |
| `Matchup.jsx` | `src/screens/scout/` | Pass real `personId`s and club ids to `Headshot`; keep the `.shot.scout__shot` size override. |
| `HeadToHead.jsx` | `src/screens/scout/` | Already on `FactGrid`, `Table`, `Pill`, `AsOfBanner`. |
| `styles/designlab/scout.css` | a per-route partial in a subdirectory | `src/styles` is at its file budget. Drop the `.scout__lab` and `.scout__pickbtn` rules. The motion block could move to `styles/motion/` (`docs/motion.md`); add the flip and the ink-in to `/animation-lab`. |
| `PitchScene` + `pitchTiles` + `scenePitches` | already shared | No change. |

Do not reuse `fixture.js`, the Lab rows, or `leagueRegions` (it averages
cell rates; the real league store holds sums).
