The first of the six new sections on `/abs-challenges`. Depends on the chances denominator and on the page split.

**Design:** https://claude.ai/artifact/DdXwqNvni67o4MrJB3wkgY — artboard "Q2 - When they call for one" (phone) and the Wide page.

## What it is

- A column chart of challenges by inning with a **"Per 100 chances" / "Raw count" chip pair**. The toggle is the argument: it shows the reader what the correction is worth
- Two small multiples under it, catcher and batter, on the SAME denominator as the chart above so they add up to it
- A stat line for pitchers rather than a third panel. On the shared scale a pitcher's nine values span 0.17 to 0.32 and every bar rounds to the same 1.5px, which draws a thicker axis rule and calls it a chart. The line reads: 172 of 9,413, flat all game
- A separate line chart for the share won, on its own scale with real ticks. It falls from 60.9% in the first to 40.5% in the ninth. **Never a second axis on the first chart**
- Innings 10 and up pool into one bar drawn **hollow**, with its 683 chances stated. Clay against graphite fails the colourblind check (delta-E 4.8 under protanopia), so thin evidence is carried by an outline, not by a second colour

## Build notes

- A column-chart primitive belongs in `src/components/around-the-game/BroadcastBar.jsx`, which is already "the chart primitives every report board shares". `src/components/charts/` is past its budget and these are report charts. That directory is at 7 files, so one new sibling is also fine if the primitive outgrows the file
- Chart styles go in `src/styles/68-around-the-game.css` (one sheet for these pages, by design). `check-typography` scans stylesheets only, so every font-size, weight, line-height and letter-spacing must be a token there rather than an inline style
- Axis labels: `--text-caption`, never `--graphite-soft`. That token measures 3.10:1 on card paper and fails AA for text this size
- SVG width 100% against the viewBox. A fixed 334px SVG overflows below 375px and can widen the page

## Acceptance

- Reads the `summary` it is given, so the level chip already on the page switches it to Triple-A
- No `title=` tooltips anywhere. They are invisible on touch and are rejected outright
- Verified in a browser at 390px and at 960px on a real game day, with the local URL in the handoff
