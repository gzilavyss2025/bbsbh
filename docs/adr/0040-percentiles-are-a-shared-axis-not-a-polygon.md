# Percentiles are a shared axis, not a polygon

The player page's Statcast section used to render a five-spoke radar above a
grid of flip cards holding the same percentiles again. The radar's own header
said so plainly:

> It's the same data twice on purpose: the radar is for recognising a TYPE of
> player at a glance, the cards for reading any one metric.

Both halves are now one element: a ruled strip on a single shared 0–100 axis,
one row per metric (`src/components/charts/PercentileStrip.jsx`, scale math in
`src/lib/percentileStrip.js`). The radar (`StatRadar.jsx`), its geometry
(`lib/radarGeometry.js`) and the tile it stacked above (`StatcastCard.jsx`)
are deleted.

This is not a taste call about spider charts. Each of the four reasons below is
a property of the data the old form got wrong.

## 1. It could not show every metric, and hid the ones it dropped

A pentagon holds five labels legibly. A hitter has six Statcast percentiles and
a pitcher has seven, so `RADAR_KEYS` picked five and the rest appeared only in
the card grid underneath.

That is not a neutral truncation, because the reader takes the shape as the
summary. Freddie Freeman's page drew a full, well-rounded pentagon — 95th in
xwOBA, 57th–65th on the other four — while his **9th-percentile sprint speed**,
his one genuinely bad tool, existed nowhere in the graphic. A pitcher's radar
left out chase rate and fastball velocity the same way.

Rows are independent, so the strip has no such budget. Every metric the player
qualifies for gets a line.

## 2. Area grows as the square of the quantity

A radar encodes magnitude as radius and reads as area. Doubling a percentile
quadruples the ink. A player at the 80th across the board does not look twice as
good as one at the 40th — he looks four times as good.

Position along a common scale is the encoding people decode most accurately, and
here it costs nothing to use: Savant's ranks are already on one 0–100 scale,
already pre-flipped so higher is better (see `api/savantPercentiles.js`). There
was no normalisation to invent and no axis to reconcile. The radar spent that
for free and got a nonlinear read back.

## 3. The silhouette depended on an arbitrary list order

`RADAR_KEYS`'s own comment conceded it:

> Shuffling these keys changes what every player's shape looks like — it isn't a
> cosmetic list.

That is the defect stated as a feature. The graphic's most salient property —
its outline — was a function of the order a developer typed five strings in.
Permute them and the same player draws a different shape; two players with
genuinely different profiles can be made to draw the same one. Nothing about
"power arm" versus "soft-contact specialist" is in the data as a *shape*; it was
in the key order.

The strip keeps one fixed order (the canonical `BATTER_METRICS` /
`PITCHER_METRICS` list) for every player, which is what makes a percentile rank
comparable across pages at all: row three is the same metric on everyone's.
`test/percentile-strip.test.js` pins that the row order does not depend on the
input map's key order.

## 4. Two scales in one graphic, running opposite ways

The radar plotted **percentile** as spoke length and printed the **raw rate** at
the spoke's tip. Nothing said the number and the distance were different scales.

For a lower-is-better metric they actively contradicted. On one real pitcher's
card, `HARD-HIT ↓ 23.9%` reached the rim (100th percentile) while `BB ↓ 14.4%`
collapsed to a stub (3rd) — the bigger printed number on the longer spoke, the
smaller one on the shorter, and both meaning the opposite of what that suggests.
Three of that pitcher's five spokes carried the `↓`, so the inverted case was
the majority, and the arrow itself was never explained anywhere on the page.

The strip gives the raw rate its own column beside the plotted rank, so the two
never share a visual channel. The `↓` marker stays on the metrics that need it
(unchanged from before), but it now qualifies a number in its own column rather
than annotating a length.

## What else changed, and what didn't

- **Accessibility improved rather than being preserved.** The radar was
  `aria-hidden` in full, justified by the card grid beneath carrying the same
  numbers for screen readers. With the grid gone that argument would have gone
  too, so each row now carries its own prose accessible name and only the
  track — the rule, the bar, the dot — is hidden.
- **A metric under Savant's sample floor is omitted, not plotted.** The radar
  drew such a spoke *at the league-average ring*, which reads as a real,
  exactly-average measurement rather than as missing data.
- **The definitions survive.** Tapping a row still reveals the plain-language
  gloss the flip cards carried; it is an inline disclosure now, because a
  flipping row would pull its dot off the shared axis.
- **No copy was added.** No axis caption, no legend, no footnote. The
  league-average reference is drawn as a pencilled rule down the strip and each
  row prints its own rank, so the graphic reads without prose. The radar had no
  caption either — this is parity, not a subtraction.
- **A bug went with it.** `.statradar__label` set `font-family:
  var(--font-condensed)`, a token that does not exist anywhere in
  `src/tokens/`. It was the only use of that name in the codebase, so every
  spoke label had silently been rendering in the inherited face rather than the
  condensed one the design system specifies.

## Consequences

- `src/styles/26a-percentile-strip.css` is a new partial. 26-player-page.css was
  at its file-size budget, and that guard's remedy is to split (ADR-0038); the
  lettered sibling keeps the cascade position the rules had.
- The strip is the codebase's **first `subgrid`**. It is load-bearing, not
  stylistic: every row must share one set of columns or the dots stop sharing an
  axis, which is the only thing this form promises. Per-row grids drift with the
  longest label in each row, and hard-coding a pixel width for the label column
  would make the alignment a coincidence that a future metric name breaks.
- `StatcastCard.jsx` had no other caller and is deleted with its CSS. The
  innings view and box score use the headshot `PerformerCard` tile, not this one.
