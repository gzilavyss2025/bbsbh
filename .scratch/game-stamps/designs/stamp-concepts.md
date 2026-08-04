# Game Stamp — three design concepts

Collectible commemorative mark for a game the user watched/scored. Constraints
honored by all three: 300×300 canvas, single ink (`currentColor` — team-tintable
or fixed navy), score is mandatory and legible, must read tiled at ~72px and
reward a close look at 300px. Sample game throughout: **Cubs 3 at Brewers 5,
American Family Field, Aug 2 2026**.

Type vocabulary is borrowed from the app's tokens (`src/tokens/typography.css`):
**IBM Plex Sans Condensed** (semibold, tracked caps) for chrome/labels,
**IBM Plex Mono** (tabular figures) for anything numeric or ledger-like. Every
SVG declares those families with generic fallbacks (`Arial Narrow`,
`ui-monospace`), so the stamps degrade sanely if rendered outside the app.

Files:

- `stamp-concept-1.svg` — The Cancellation
- `stamp-concept-2.svg` — The Stub
- `stamp-concept-3.svg` — The Tally Plate

---

## Concept 1 — "The Cancellation"

**Thesis:** the national-park-passport cancellation stamp, but the slot where a
cancellation carries its date instead carries a two-row winner-first score
ledger — the score *is* the postmark.

### Organizing geometry

A double concentric circle, centered at (150,150): outer ring r=140 at 3.5px
stroke, inner ring r=118 at 1.5px. The 22px annulus between them is the text
ring; everything score-bearing lives inside the inner circle. The stamp fills
~93% of the canvas — this is the "hero" round stamp of the set.

### Layout (precise)

| Element | Geometry | Type | Data? |
|---|---|---|---|
| Outer/inner rings | r=140 (3.5px), r=118 (1.5px) | — | fixed |
| Venue arc (top) | baseline on r=122 arc, `M 28,150 A 122,122 0 0 1 272,150`, centered | Condensed 600, 13.5px, +2.2px tracking, caps | venue |
| Date arc (bottom) | baseline on r=135 arc, `M 15,150 A 135,135 0 0 0 285,150`, centered (sweep 0 keeps glyphs upright; the larger radius makes caps grow *inward*, so both arcs occupy the same 118–140 annulus) | same as venue arc | date, long form `AUGUST 2 · 2026` |
| Diamond separators | filled 12px rotated squares at (21,150) and (279,150) — 9 and 3 o'clock, mid-annulus | — | fixed |
| Status word | `FINAL` centered, baseline y=104 | Condensed 600, 11px, +3px tracking | innings (see below) |
| Upper rule | chord y=114, x 70→230, 1.5px | — | fixed |
| **Winner row** | abbrev at x=76 baseline y=152; run total right-aligned to x=224 baseline y=153; dotted leader between (y=144, 2.5px stroke, dash `0.5 6.5`, round caps) | Plex Mono 700; abbrev 27px, numeral 31px | winner abbrev + runs |
| **Loser row** | abbrev x=76 baseline y=182; total right-aligned x=224; lighter leader (1.8px) | Plex Mono 400; abbrev 20px, numeral 22px | loser abbrev + runs |
| Lower rule | chord y=196, x 82→218, 1.5px | — | fixed |
| Orientation line | `CHC AT MIL` centered baseline y=215 | Condensed 600, 11px, +2px tracking | away/home abbrevs |

### How the score is expressed

A two-row ledger, **winner always on top**, regardless of home/away. Hierarchy
is carried three ways at once: position (top), weight (700 vs 400), and size
(27/31px vs 20/22px). Because winner-ordering destroys the away-at-home
information, the footer line `CHC AT MIL` restores it — that's why it's
non-optional chrome. The dotted leaders are doing the passport-stamp "fill the
line" job while keeping abbrev and numeral optically connected at any score
width (a 2-digit total just eats leader dots; leaders are drawn between fixed
x-endpoints minus measured text, so `12` and `5` both work).

- **Extra innings:** the status word becomes `FINAL / 10` (or `/ 11`…). Nothing
  else moves.
- **Shutout:** loser row reads `CHC 0`; optionally swap the status word to
  `SHUTOUT` — the slot is sized for ≤8 characters.
- **Walk-off / blowout:** no special treatment; margin reads directly from the
  numerals. Deliberate — the cancellation is a record, not a headline.

### Team identity in one color

Three-letter club abbreviations in mono caps. No logos: MLB marks can't be
reproduced, and a knockout mark at one color inside a busy ring stamp turns to
mud at 72px. The abbreviation IS the identity, and the ink hue (team-tinted via
`currentColor`) does the rest when the collection tints stamps per team.

### 72px behavior

At 72px the ring text is ~3.2px — an unreadable texture band, which is exactly
what a distant cancellation looks like, so it degrades honestly. What survives:
the double-ring silhouette, `MIL 5` at ~6.5px bold (legible), `CHC 3`
marginally. If tested legibility fails on device, ship a `size="sm"` variant:
drop both arcs and the diamonds, thicken the inner ring to 2.5px, scale the two
score rows up ~20%. Same data, two renderers.

### Wear treatment

`feTurbulence` (fractalNoise, baseFrequency 0.55, 2 octaves) +
`feDisplacementMap` (scale 1.8) over the whole group — pure vector, no raster.
Gives every edge the slightly chewed look of rubber on paper. Seed the
turbulence from `gamePk` so each game's stamp is chewed *differently but
deterministically* — two stamps of the same game always match. For a stronger
"bad ink day" effect, add a second feTurbulence-driven alpha mask that drops
ink coverage in patches; omitted from the sample to keep it legible.

### Data fields

`winnerAbbrev, winnerRuns, loserAbbrev, loserRuns, awayAbbrev, homeAbbrev,
venueName, dateLong, totalInnings, gamePk (distress seed)`.

### Honest weaknesses

- Least differentiated concept: every passport/brewery/park stamp is a double
  ring with arc text. In a grid of *other apps'* stamps it's generic; in a grid
  of its own siblings only the ink hue and numerals vary.
- Long venue names (`THE BALLPARK AT AMERICA FIRST SQUARE…`) overflow the top
  arc; needs a truncation/abbreviation table above ~26 characters.
- Winner-first ordering fights the box-score instinct (away on top); the
  footer line mitigates but costs a read.

---

## Concept 2 — "The Stub"

**Thesis:** not a rubber stamp at all — a ticket stub crossed with the final
"R" column of a scorebook linescore: the score lives in ruled cells, and the
winner's cell is double-ruled the way a scorer boxes the winning total.

### Organizing geometry

A landscape rounded rectangle, 264×172, at x 18–282, y 64–236 (rx=6, 3px
stroke) — deliberately breaking the round-stamp convention. A vertical
perforation (2px dashed line, dash `1 7`, round caps, at x=222) tears off a
60px-wide stub on the right. Main panel ≈ 204px wide, stub ≈ 60px.

### Layout (precise)

**Main panel (x 18–222):**

| Element | Geometry | Type | Data? |
|---|---|---|---|
| Brand | `TALLY BASEBALL`, x=30 baseline y=86 | Condensed 600 10.5px +1.8px tracking | fixed |
| Status | `FINAL / 9` right-aligned x=210 y=86 | same | innings |
| Top rule | y=94, x 30–210, 1.25px | — | fixed |
| Column header | `R` centered on x=183, y=103 | Condensed 600 9px | fixed |
| Away row | abbrev `CHC` x=46 baseline y=134 (Mono 700 26px); run cell rect (160,106) 46×40, 1.25px hairline; numeral centered x=183 baseline y=135 (Mono 400 25px) | | away abbrev + runs |
| Row divider | y=152, x 30–210, 0.75px | — | fixed |
| Home row | abbrev `MIL` x=46 y=186; run cell (160,158) 46×40 | | home abbrev + runs |
| Winner marks | filled 11px diamond bug left of winner abbrev (center ≈ (36,178)); winner cell double-ruled — outer 2.25px + inner rect (164,162) 38×32 at 0.75px; winner numeral Mono 700 27px | | which side won |
| Bottom rule | y=210, x 30–210, 1.25px | — | fixed |
| Venue | `AMERICAN FAMILY FIELD` x=30 baseline y=226 | Condensed 600 10.5px +1.5px | venue |

**Stub (x 222–282), all text rotated −90° (reads bottom-to-top):**

| Element | Geometry | Type | Data? |
|---|---|---|---|
| Punch hole | stroke-only circle (254,84) r=8, 2.5px — an empty circle on paper reads as a punched hole, no knockout needed | — | fixed |
| Date | centered on (246,158) | Mono 600 14px +1px | date, `AUG 2, 2026` |
| Serial | centered on (269,158) | Mono 400 8.5px +2.5px | `NO. {gamePk}` |

The gamePk-as-serial-number is the concept's best authenticity move: it's real
data pretending to be ticket chrome, unique per game, and it gives the
collector something to squint at.

### How the score is expressed

Scorebook convention: **away on top, home below** — no reordering, so the
matchup reads naturally. Winner is marked, not moved: the filled diamond bug,
the double-ruled cell, and the bold numeral all point at the same row. This is
the scorer's own habit (boxing the winning total) made into system.

- **Extra innings:** `FINAL / 11` in the status slot.
- **Shutout:** loser cell shows `0`; the empty-feeling hairline cell against
  the winner's double box is itself expressive.
- **Doubleheader:** the serial line naturally disambiguates; optionally append
  `· GM 2` to the status slot.
- **Blowout vs one-run:** carried numerically only; the double box is binary.

### Team identity in one color

Abbreviations again, but here the *rows* give each team a place, so identity
is positional as well as textual. City/nickname text was cut deliberately —
at 26px mono bold the abbrevs are the strongest identity signal the panel can
afford.

### 72px behavior

Best-in-set. The landscape rectangle is instantly differentiable from round
stamps in a grid; the two 26px abbrevs and boxed numerals scale to ~6.2px bold
and stay legible; the double-box winner cell survives as a visibly heavier
square. Casualties: serial, `R` header, tracking nuance — all texture. The
perforation dash collapses to a faint line, still enough to say "ticket."
No simplified variant needed; ship one renderer.

### Wear treatment

Same feTurbulence/feDisplacementMap recipe at reduced scale (1.2 — the stub
carries 8.5px type that a 1.8 displacement would mangle). The tear line and
punch hole do most of the authenticity work structurally rather than
texturally. Optional upgrade: jitter the rect corners by drawing the border as
a path with gamePk-seeded ±1px vertex offsets — "cut slightly off square."

### Data fields

`awayAbbrev, awayRuns, homeAbbrev, homeRuns, winnerSide, venueName, dateShort,
totalInnings, gamePk (serial + distress seed)`.

### Honest weaknesses

- Least "stampy": it reads as a ticket, which slightly betrays the
  rubber-stamp brief even as it wins the differentiability battle. In a
  passport-page collection it may look like it wandered in from a scrapbook.
- Landscape aspect inside a square canvas wastes ~35% of the vertical box;
  tiled grids of mixed concepts will show it smaller than the round stamps.
- The rotated stub text is illegible below ~150px render size and the punch
  hole can read as a printing error at small sizes.

---

## Concept 3 — "The Tally Plate"

**Thesis:** the app is called *Tally* Baseball — so the score is drawn the way
a scorer actually keeps it: literal tally strokes, four-and-a-slash, inside a
home-plate silhouette, with the winning total ringed in pencil.

### Organizing geometry

A point-down home plate pentagon: `M 48,52 L 252,52 L 252,158 L 150,254 L
48,158 Z`, 5px stroke, rounded joins. The rectangular upper zone (y 52–158)
holds the two team/tally rows; the triangular lower zone holds venue, date, and
a plate-tip diamond ornament at (150,232). No shape in stampdom looks like
this; it's the concept a Tally Baseball user would recognize as *theirs*.

### Layout (precise)

| Element | Geometry | Type | Data? |
|---|---|---|---|
| Plate outline | pentagon above, 5px | — | fixed |
| Status | `FINAL — 9` centered baseline y=72; rule y=80, x 64–236, 1px | Condensed 600 11px +3px | innings |
| Away row | abbrev x=62 baseline y=122 (Mono 700 21px); tally strokes from x=123, 9px pitch, 28px tall, 3px stroke, round caps, each with ±1–2px endpoint jitter; numeral centered x=224 (Mono 400 22px) | | away abbrev + runs |
| Row divider | y=132, x 66–234, 0.75px | — | fixed |
| Home row (winner) | abbrev x=62 y=165; tallies same grid at 3.5px stroke, fifth stroke a slash (115,163)→(157,141); numeral Mono 700 26px centered in a 2.2px circle r=16 at (224,151) | | home abbrev + runs |
| Zone divider | y=178, x 72–228, 1px | — | fixed |
| Venue | centered y=198 | Condensed 600 9px +0.8px | venue |
| Date | centered y=214 | Mono 600 11.5px +1px | `AUG 2, 2026` |
| Tip diamond | filled 9px rotated square at (150,232) | — | fixed |

Tally construction rule for the renderer: runs `n` → `floor(n/5)` complete
five-bundles (4 verticals + slash) plus `n mod 5` verticals, on a 9px pitch
with a 6px gap between bundles. Winner's tallies at 3.5px, loser's at 3px.
The numeral always accompanies the tallies — the strokes are texture and
delight, the digit is the guarantee of legibility.

### How the score is expressed

Twice, redundantly: pictographically (the tallies — you can *count* the runs)
and numerically (the digit). Winner hierarchy comes from the scorer's-pencil
gesture: the winning total is **circled**, its tallies are heavier, its digit
bold. Home/away keeps scorebook order (away top). This is the only concept
where a blowout and a squeaker *look* structurally different at a glance — 12
runs is a visibly long fence of strokes, 1 run is a lone mark. That's the
concept's emotional payload.

- **Extra innings:** `FINAL — 11`; nothing else moves.
- **Shutout:** the loser row has an empty tally field — a blank fence line —
  plus the digit `0`. Genuinely evocative.
- **High-scoring games:** see weaknesses.

### Team identity in one color

Abbreviations, same rationale as the others — but the plate silhouette itself
is a *shared* identity (baseball, this app), which frees the ink hue to do
per-team work in a tinted collection.

### 72px behavior

The pentagon silhouette is the most recognizable shape in the set at thumbnail
size — nothing else in a stamp grid is plate-shaped. The tallies collapse into
a texture bar (fine — they read as "marks were made"), and legibility falls to
the abbrevs (~5px bold, marginal) and digits (~5.3–6.2px, the circled winner
digit survives best). Recommendation: ship a simplified small variant below
~110px — drop venue, tallies, and the status rule; keep plate, `CHC 3 / MIL 5`
in two enlarged rows, and the winner circle. This concept genuinely needs the
two-renderer split; the other two can get away without it.

### Wear treatment

Different register from concepts 1–2: not rubber-stamp chew but **hand
wobble** — feTurbulence at low frequency (0.045, 2 octaves) with displacement
scale 2, so long slow waves bend the straight lines the way a pencil does,
rather than roughening edges. Plus structural jitter: the tally endpoints are
individually offset ±1–2px in the geometry itself (in production, seeded from
gamePk so it's deterministic). The result should look drawn, not stamped —
matching the app's "you keep score on paper" soul.

### Data fields

`awayAbbrev, awayRuns, homeAbbrev, homeRuns, winnerSide, venueName, dateShort,
totalInnings, gamePk (jitter seed)`.

### Honest weaknesses

- **Score capacity is bounded.** The tally field is ~120px wide; at 9px pitch
  + bundle gaps that's ~12 runs before overflow. Beyond that the renderer must
  shrink pitch (down to ~6px ≈ 17 runs) and then fall back to bundles-count
  notation (`卌 ×3 + ||`) — added renderer complexity for rare games, and the
  rare 20-run game (the one you'd most want to commemorate) gets the most
  compromised stamp.
- Weakest small-size legibility of the three; requires the simplified variant.
- The circled winner digit crowds the plate's right edge (circle edge at
  x=240 vs. plate edge sloping in below y=158); a 2-digit circled total needs
  the circle widened to an ellipse and nudged left — fiddly.
- Least "official-looking": the charm is hand-made, which may undercut the
  passport-validation fantasy for collectors who want the ranger-desk moment.

---

## Cross-cutting notes

- **One-color discipline:** every element is `fill="currentColor"` /
  `stroke="currentColor"`; the `style="color:#1B2A3A"` on each svg root is a
  preview default (the app's `--ink-1`), overridable per team or theme. No
  opacity tricks were used — value contrast comes from stroke weight, size,
  and (available if wanted) hatch patterns.
- **Fonts:** rendering these as in-app SVG gets the bundled Fontsource faces
  for free. If stamps must ever be exported standalone (share images), either
  convert text to paths at generation time or subset-embed the two faces —
  arc text especially shifts if a fallback face has different metrics.
- **Determinism:** all randomness (turbulence seed, jitter) derives from
  `gamePk`. Same game → identical stamp, forever. That's what makes it a
  collectible rather than a render.
- **As a set:** the three are complementary, not competing skins — round
  cancellation (official), rectangular stub (ephemera), plate tally
  (hand-made). If only one ships, Concept 2 is the safest all-scales workhorse,
  Concept 3 is the most *Tally Baseball*, Concept 1 is the most conventionally
  collectible.
