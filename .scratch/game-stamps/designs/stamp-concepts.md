# Game Stamp — three design concepts (rev 2: with team marks)

Collectible commemorative mark for a game the user watched/scored. Constraints
honored by all three: 300×300 canvas (viewBox only — no width/height attributes,
so CSS controls size in a grid), single ink (`currentColor` — team-tintable or
fixed navy), score is mandatory and legible, must read tiled at ~72px and reward
a close look at 300px. Sample game throughout: **Cubs 3 at Brewers 5, American
Family Field, Aug 2 2026** (gamePk sample `778241`).

Type vocabulary is borrowed from the app's tokens (`src/tokens/typography.css`):
**IBM Plex Sans Condensed** (semibold, tracked caps) for chrome/labels,
**IBM Plex Mono** (tabular figures) for anything numeric or ledger-like. Every
SVG declares those families with generic fallbacks (`Arial Narrow`,
`ui-monospace`), so the stamps degrade sanely if rendered outside the app.

Files (all verified by rendering a Playwright contact sheet at 300/110/72/48px —
`contact-sheet.html` / `contact-sheet-2.png` alongside):

- `stamp-concept-1.svg` — The Cancellation
- `stamp-concept-2.svg` — The Stub
- `stamp-concept-3.svg` — The Tally Plate

---

## Team marks — the one-color logo system (shared by all three)

Identity is now carried by the project's precomputed mono knockout marks:
`public/data/logos/mono/{teamId}.svg` (150 clubs, built by
`scripts/gen-mono-logos.mjs`; see `src/lib/logoMono.js` and ADR-0031). Each file
is white ink on transparent — already a luminance mask — so recoloring to any
single ink is:

```svg
<mask id="c1h-{gamePk}">
  <image href="/data/logos/mono/158.svg" x="…" y="…" width="…" height="…"
         preserveAspectRatio="xMidYMid meet"/>
</mask>
<rect x="…" y="…" width="…" height="…" fill="currentColor" mask="url(#c1h-{gamePk})"/>
```

Rules the renderer must follow (all encoded in the sample files):

1. **Non-uniform viewBoxes.** Marks are not square (Brewers 157×172 portrait,
   Cubs 234×234). Every concept reserves a *square slot* and letterboxes with
   `preserveAspectRatio="xMidYMid meet"`. Never assume aspect.
2. **Instance-unique ids.** Every mask/filter/path id is suffixed with the
   gamePk (`c1a-778241`, `ink-778241`, …) so a grid of many stamps on one page
   never collides.
3. **Rendering-mode caveat.** External `href` resolves only when the stamp SVG
   is inline in the DOM (or is itself the document, e.g. in an iframe). Rendered
   via `<img>`, in an OG card, or exported to PNG, external refs are blocked and
   the mark vanishes → an **inlined-logo variant is required for export/share**
   (fetch the mono file at generation time and embed its contents in the mask).
4. **Prefer the `<image>` reference for grids.** Mono files run 1–59 KB; two
   inlined logos can push a single stamp past 100 KB, while the reference form
   lets the browser cache each club's file once across the whole collection.
5. **Fallback is the abbreviation.** Not every club has a mono file (MiLB
   coverage is partial). Per project convention (degrade, don't crash), every
   logo slot has a defined text fallback — noted per concept below.
6. **Production URL** comes from `teamLogoUrl(teamId, 'mono')` in
   `src/lib/teams.js` (adds the `?v=` content hash). The hardcoded
   `/data/logos/mono/…` paths in these samples are for preview only.

**The logos changed the small-size calculus everywhere**: a knockout silhouette
at 8–12px is far more recognizable than 3-letter condensed type at 5px. All
three concepts are now identifiable at 48px, which none reliably was before.

---

## Concept 1 — "The Cancellation"

**Thesis:** the national-park-passport cancellation stamp, with the club marks
as the central emblem pair — away AT home — and the run totals stacked directly
beneath each mark, so the score reads as the postmark's payload.

### Organizing geometry

Double concentric circle centered (150,150): outer ring r=140 at 3.5px, inner
ring r=118 at 1.5px; text ring in the 22px annulus, everything score-bearing
inside the inner circle.

### Layout (precise)

| Element | Geometry | Type | Data? |
|---|---|---|---|
| Outer/inner rings | r=140 (3.5px), r=118 (1.5px) | — | fixed |
| Venue arc (top) | baseline on r=122 arc `M 28,150 A 122,122 0 0 1 272,150`, centered | Condensed 600, 13.5px, +2.2px tracking, caps | venue |
| Date arc (bottom) | baseline on r=135 arc `M 15,150 A 135,135 0 0 0 285,150` (sweep 0 keeps glyphs upright; larger radius makes caps grow inward so both arcs share the annulus) | same | date, `AUGUST 2 · 2026` |
| Diamond separators | filled 12px rotated squares at (21,150), (279,150) | — | fixed |
| Status word | `FINAL` centered, baseline y=97 (`FINAL / 10` in extras) | Condensed 600, 11px, +3px | innings |
| **Away mark** | square slot (84,104) 54×54, mask+rect recipe | — | away teamId |
| `AT` | centered (150,134) | Condensed 600, 10px | fixed |
| **Home mark** | slot (162,104) 54×54 | — | home teamId |
| Rule | chord y=170, x 80→220, 1.5px | — | fixed |
| Away total | `3` centered x=111, baseline y=202 | Mono 400, 24px | away runs |
| Home total (winner) | `5` centered x=189, baseline y=204, underscore x 175→203 y=211 2.5px | Mono 700, 32px | home runs + winner side |
| Abbrev captions | `CHC` / `MIL` centered under totals, baseline y=226 | Condensed 600, 8.5px, +1.5px | abbrevs |

### How the score is expressed

Per-team totals sit directly beneath each mark — the logo-to-number column
binding *is* the score statement, so away-at-home order is preserved (the old
winner-first reordering and its `CHC AT MIL` footer are gone). Winner hierarchy:
bold + 33% larger numeral + a scorer's underscore. Extras go in the status word
(`FINAL / 10`); a shutout loser column reads `0` under its mark; margin reads
numerically only — the cancellation is a record, not a headline.

### Identity, redundancy, fallback

Logo is primary; the 8.5px abbrev captions are kept deliberately — they anchor
which mark is which for unfamiliar clubs *and* they are the graceful fallback
(a missing mono file promotes the caption into the slot as 25px bold mono).
The redundancy costs one small text row and pays for itself.

### 72px behavior

Much improved: the emblem pair survives as two recognizable silhouettes
(~13px each) with the bold `5` beside a lighter `3`. At 48px the marks still
read; ring text is texture (honestly stamp-like). The simplified small variant
is now optional rather than necessary; if shipped, drop arcs/diamonds and
enlarge the emblem-and-totals block ~20%.

### Wear

`feTurbulence` fractalNoise (baseFrequency 0.55, 2 octaves) +
`feDisplacementMap` scale 1.8 over the whole group — pure vector. Seed from
gamePk for deterministic per-game chew. The displacement also roughens the
masked logo rects, which sells "one rubber die" nicely.

### Data fields

`awayTeamId, homeTeamId, awayAbbrev, homeAbbrev, awayRuns, homeRuns,
winnerSide, venueName, dateLong, totalInnings, gamePk (ids + distress seed)`.

### Honest weaknesses

- Still the most generic silhouette in a mixed grid — round with arc text.
- Long venue names (>~26 chars) overflow the top arc; needs an abbreviation
  table or font-size step-down.
- Two adjacent dark marks of similar mass (two roundel clubs) can read as one
  blob at 48px; the `AT` between them is illegibly small at that size.

---

## Concept 2 — "The Stub"

**Thesis:** a ticket stub crossed with the final "R" column of a scorebook
linescore — crest, club code, and a ruled run cell per row; the winner's cell
is double-ruled the way a scorer boxes the winning total.

### Organizing geometry

Landscape rounded rectangle 264×172 (x 18–282, y 64–236, rx 6, 3px stroke) —
deliberately not round. Vertical perforation (2px dashed, dash `1 7`, x=222)
tears off a 60px stub.

### Layout (precise)

**Main panel (x 18–222):**

| Element | Geometry | Type | Data? |
|---|---|---|---|
| Brand | `TALLY BASEBALL` x=30 baseline y=86 | Condensed 600 **9px** +1.2px | fixed |
| Status | `FINAL / 9` right-aligned x=210 y=86 | same | innings |
| Top rule | y=94, x 30–210, 1.25px | — | fixed |
| Column header | `R` centered x=183, y=103 | Condensed 600 9px | fixed |
| Away row | mark slot (30,107) 38×38; abbrev `CHC` x=78 baseline y=135 (Mono 700 22px); cell rect (160,106) 46×40 hairline 1.25px; numeral centered x=183 y=135 (Mono 400 25px) | | away teamId, abbrev, runs |
| Row divider | y=152, x 30–210, 0.75px | — | fixed |
| Home row (winner) | mark slot (30,159) 38×38; abbrev `MIL` x=78 y=187; double cell (160,158) 46×40 @2.25px + (164,162) 38×32 @0.75px; numeral Mono 700 27px | | home teamId, abbrev, runs, winner side |
| Bottom rule / venue | y=210; `AMERICAN FAMILY FIELD` x=30 y=226 | Condensed 600 10.5px +1.5px | venue |

**Stub (x 222–282), text rotated −90°:** punch-hole circle (254,84) r=8 @2.5px;
date centered on (246,158) Mono 600 14px; serial `NO. {gamePk}` on (269,158)
Mono 400 8.5px +2.5px.

Revision notes: the top band's two texts collided at 10.5px across 180px — both
dropped to 9px (brand ends ≈x 112, status starts ≈x 155; verified clear in the
render). The winner diamond bug was removed: its slot is now the logo, and the
double box + bold numeral carry the winner unambiguously.

### How the score is expressed

Scorebook convention — away over home, never reordered. Winner is *marked, not
moved*: double-ruled cell + bold numeral (the scorer's boxed total). Extras →
`FINAL / 11`; shutout → hairline `0` cell against the winner's double box;
doubleheader → serial disambiguates (optionally `· GM 2` in status).

### Identity, redundancy, fallback

The only concept that keeps **both** mark and abbreviation, deliberately: a
ticket prints a crest *and* a station code, the utilitarian register supports
it, and the abbrev doubles as the always-present fallback — a missing mono file
simply leaves the crest slot empty and the row still works (per the project's
degrade-gracefully convention). No layout shift needed.

### 72px behavior

Still best-in-set, now stronger: crest + bold code + boxed numeral per row all
survive (~9px crest, ~5.6px bold code, boxed digits), and the landscape shape
is instantly separable from round stamps in a grid. At 48px the crests and
boxed digits still read; serial/`R`/perforation collapse to texture. No
simplified variant needed.

### Wear

Same displacement recipe at scale 1.2 (the stub carries 8.5px serial type that
scale 1.8 would mangle). Tear line + punch hole do the authenticity work
structurally. Optional: gamePk-seeded ±1px corner jitter on the border path.

### Data fields

`awayTeamId, homeTeamId, awayAbbrev, homeAbbrev, awayRuns, homeRuns,
winnerSide, venueName, dateShort, totalInnings, gamePk (serial + ids + seed)`.

### Honest weaknesses

- Least "stampy" — reads as ticket ephemera, which may sit oddly on a
  passport-page collection fantasy.
- Landscape aspect wastes ~35% of the square canvas; in a mixed grid it
  renders visually smaller than the round/pentagon stamps.
- Rotated stub text illegible below ~150px; the punch hole can read as a
  printing artifact when tiny.

---

## Concept 3 — "The Tally Plate"

**Thesis:** the app is called *Tally* Baseball — the score is drawn the way a
scorer keeps it: literal four-and-a-slash tally strokes beside each club's
mark, inside a home-plate silhouette, winner's total ringed in pencil.

### Organizing geometry

Point-down home plate: `M 48,52 L 252,52 L 252,158 L 150,254 L 48,158 Z`, 5px
stroke, rounded joins. Wide upper rectangle (y 52–158) holds venue band + two
tally rows; lower triangle holds status, date, tip diamond.

### Layout (precise)

| Element | Geometry | Type | Data? |
|---|---|---|---|
| Plate outline | pentagon above, 5px | — | fixed |
| **Venue band** | `AMERICAN FAMILY FIELD` centered baseline y=72; rule y=80 x 64–236 | Condensed 600 10px +1px | venue |
| Away row | mark slot (58,92) 34×34; tallies from x=112 (9px pitch, 28px tall, 3px stroke, round caps, ±1–2px hand jitter); numeral `3` centered x=224 baseline y=122 | Mono 400 22px | away teamId, runs |
| Row divider | y=132, x 66–234, 0.75px | — | fixed |
| Home row (winner) | mark slot (58,136) 34×34; tallies @3.5px, slash (105,163)→(147,141); circle (224,151) r=16 @2.2px; numeral `5` centered baseline y=160 | Mono 700 26px | home teamId, runs, winner side |
| Zone divider | y=178, x 72–228, 1px | — | fixed |
| Status | `FINAL — 9` centered y=196 | Condensed 600 11px +3px | innings |
| Date | `AUG 2, 2026` centered baseline y=210 | Mono 600 **10.5px** +0.5px | date |
| Tip diamond | filled 9px rotated square at (150,230) | — | fixed |

Revision notes: venue moved from the narrow lower triangle (where
`AMERICAN FAMILY FIELD` visibly overflowed the plate edges) to the full-width
top band; `FINAL — 9` demoted to the triangle, which its ~75px width fits
easily. The date initially still grazed the sloping edge under the wobble
filter's ±2px displacement — reduced to 10.5px/+0.5px tracking at y=210
(~71px wide vs ~94px available); verified clear in the re-render.

**Venue truncation strategy:** the top band affords ~172px ⇒ ~28 chars at
10px. Longer names step down to 9px (~31 chars); beyond that, apply a
short-name table for known long venues (e.g. sponsor-prefix stripping), and as
a last resort middle-ellipsize. Never wrap — the band is single-line by design.

### How the score is expressed

Redundantly: pictographically (countable tally strokes — 5 is four-and-a-slash)
and numerically (the digit, guaranteed legible). Winner = circled total
(scorer's ring), heavier tallies, bold digit. Away/home order preserved. Still
the only concept where blowout vs. squeaker differ *structurally* — 12 runs is
a long fence, 1 run a lone stroke; a shutout is an empty fence line plus `0`.

### Identity, redundancy, fallback

The marks fully replace the abbreviations (the row was too crowded for both,
and the mark + tallies + digit is the concept's whole sentence). Fallback: a
missing mono file renders the abbrev in the slot as 20px Mono 700, vertically
centered — the row grid is unchanged.

### 72px behavior

The pentagon silhouette remains the most recognizable shape in any grid, and
the marks now rescue identity at small sizes (the old 5px abbrevs were the
weak point). Verified at 72px: marks and digits read, tallies become texture
(fine — "marks were made"), status/date illegible. At 48px the plate + two
marks + circled digit still just read. The simplified sub-~100px variant (drop
venue, tallies, status rule; enlarge marks and digits) is still recommended,
but no longer strictly required.

### Wear

Hand wobble, not rubber chew: feTurbulence baseFrequency 0.045 (2 octaves),
displacement scale 2 — long slow waves bend lines like pencil work — plus
per-stroke endpoint jitter baked into the tally geometry (gamePk-seeded in
production). Note the wobble displaces text too, which is why interior text
needs ≥5px of slack to the plate's sloping edges (the date bug above).

### Data fields

`awayTeamId, homeTeamId, awayAbbrev (fallback), homeAbbrev (fallback),
awayRuns, homeRuns, winnerSide, venueName, dateShort, totalInnings,
gamePk (ids + jitter seed)`.

### Honest weaknesses

- **Score capacity bounded.** Tally field is now ~96px (x 112–208 before the
  circle) ⇒ ~10 runs at 9px pitch; the renderer must shrink pitch (to ~6px ≈
  14 runs) then fall back to `卌 ×N` bundle notation. The 20-run game you'd
  most want to commemorate gets the most compromised stamp.
- Circled totals ≥10 need the circle widened to an ellipse and nudged left.
- Sloped edges + wobble filter make every lower-triangle string a clearance
  calculation; new fields can't be added there casually.
- Least "official-looking"; the charm is hand-made.

---

## Cross-cutting notes

- **One-color discipline:** every element, logos included, is `currentColor`
  (the mono files are luminance masks, not colored artwork). The
  `style="color:#1B2A3A"` on each svg root is a preview default (`--ink-1`),
  overridable per team or theme. No opacity tricks; value contrast comes from
  stroke weight, size, and mass.
- **Sizing:** viewBox-only roots — the grid sizes stamps with CSS; nothing
  fights the container.
- **Fonts:** in-app inline rendering gets the bundled Fontsource faces free.
  Standalone export must convert text to paths or subset-embed — and (see logo
  rule 3) must also inline the logo masks. The export pipeline is a distinct
  render mode, not a copy of the inline SVG.
- **Determinism:** all randomness (turbulence seeds, tally jitter) derives from
  `gamePk`. Same game → identical stamp, forever.
- **Verification:** all three were rendered via a served contact sheet
  (external logo hrefs require an HTTP origin + inline/document context) and
  screenshotted at 300/110/72/48px; the top-band collision (concept 2) and two
  plate-edge overflows (concept 3) were caught and fixed this way.
- **Ranking, revised:** the logos narrowed the gap. Concept 2 remains the
  all-scales workhorse, but Concept 1 gained the most — its emblem-pair center
  is now genuinely distinctive at thumbnail size, and it's the strongest pick
  if only one ships (official stamp feel + best small-size identity). Concept 3
  is still the most *Tally Baseball* and the best 300px close-look, weakest
  under data extremes (high scores, long venue names).
