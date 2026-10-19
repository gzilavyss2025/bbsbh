# Scout redesign: visual comparison (report only)

Part of #2319. Live page against the design canvas, for Pivetta (601713) vs Chourio (694192).
No app code changed. Gary goes through the list and says OK or not OK for each id.

- **Canvas:** https://claude.ai/artifact/XFBPUYkP8Xf8VSs4dvV7rm, version `1792422723-7be5`. Boards `Main.dc.html` (390 px) and `Desktop.dc.html` (1280 px).
- **Live:** current `origin/main` (`e36ad14a`), `npm run dev`, route `/scout/nick-pivetta-601713/jackson-chourio-694192?nointro`, shot at 390 px and at 1280 x 1000.
- **Images:** `shots/V<nn>-canvas.png` (left) and `shots/V<nn>-live.png` (right) for each id. Full live pages: `live-390-full.jpg`, `live-1280-full.jpg`.
- **Tools:** `tools/` holds the scripts used (canvas server, canvas and live screenshot scripts, crop helpers).

## How the canvas was rendered (read this first)

- The canvas board files were read with the Artifact tool and rendered in the container's Chromium with the canvas runtime (`artifact-type/dc-runtime.js`). Fonts came from Google Fonts.
- **Not renderable:** the canvas images (`/_blob/<id>`: headshots, club logos, the batter figure art) cannot be downloaded from this container. I replaced them with the same pictures from MLB: silo headshots, club logos, and the Brewers `right` home jersey and pants art from Gameday. The canvas figure in the shots is therefore the real art, but I did not see the canvas's own upload.
- **The canvas animates on load.** I waited 3.5 s so it is at rest. The live page gates motion on scroll, so I walked the page first, then took the full-page shot. A full-page shot places sticky bars (jump bar, chip strip) at odd spots; ignore that.

## Data is not design (do not judge these as design)

The canvas used a frozen set of 2026 numbers ("from the app's own 2026 stores"). The live page reads today's data.

| | Canvas | Live today |
| --- | --- | --- |
| Filter | Both hands · Regular season | 2026 · Regular season + postseason · All games |
| Pitches | 263 to righties | 330 |
| Mix | Fastball 49, sweeper 23, cutter 17, curveball 9 | Fastball 52, sweeper 21, cutter 18, curveball 9 |
| Verdict | Expected .336, league .308 | Expected .337, league .310 |
| Pushes | +.009 +.009 +.009 +.000 | +.017 +.000 +.010 +.000 |
| Things to watch | 4 items (the hot-spots item is the 4th) | 3 items |
| Meetings | 0-for-3, 12 pitches, Sep 22 2025 | 0-for-5, 19 pitches, NLDS 10/6/26 and Sep 22 2025 |
| Selected map region | "Heart" is picked at load | none picked |

## KNOWN (not an item)

At 1280 px on a tall window the Pitches column sticks and overlaps Meetings. Another session fixes it. Not compared further.

## Summary

26 differences. The three largest: **V01** (the matchup card), **V02** (the pitch scene: place and frame), **V04** (the Where map: scale and frame). Phone V01–V18 and V26, desktop V19–V25. Ordered most visible first.

Cause key: **spec gap** = the plan and ADR-0118 do not describe it; **deliberate** = the plan says to do it this way; **data** = a data difference; **bug** = looks unintended.

---

## Phone (390 px)

### V01. Matchup card is not the canvas card · large · spec gap
- **Canvas:** one stamped card (hard 4 px shadow, ink border) with an ink "Matchup" name tab and a "Change pair" button on its top edge. Inside: a 56 px square headshot with a sage background and ink border on each side, the **last name** in 22 px caps, "Throws R" with the **club logo**, and a **4 px side bar** under each name (pitcher blue, hitter amber). A "Filters  Both hands · Regular season ▾" row sits inside the card.
- **Live:** no card. A small grey "Matchup" label with a rule, a "Change" button, taller rounded headshots with the **full name** under them (centred, 11 px caps), "Throws R" / "Bats R" with no logo and **no side bars**. The filters are two separate outlined chips and a button below ("2026 · Regular season + postseason", "330 pitches to righties", "Both hands · All games ▾"), not one row.
- **Note:** the side colours first appear in the live page only in the verdict card and the tags. The canvas puts them on the card too.
- Images: `V01-canvas.png`, `V01-live.png`.

### V02. Pitch scene: place, size and frame · large · deliberate (plan) plus spec gap
- **Canvas:** the scene is the **last block of the Where section**, under the map and the hot/cold tiles. A small dark card with a hard shadow, header "Watch it · his mix, in turn" and a play button, a 354 x 150 view, and a caption "Typical shape · ⅓ speed · from behind the plate · follows the pitch above."
- **Live:** the scene is **above the jump bar**, before any section, as a tall light-green field view (about 245 px high) in the page background. No play button and no "Watch it" header. The pitch name and mph sit in a dark bar under it ("Sweeper 81.5 mph", then "His mix, in turn · typical shape · ⅓ speed"). It plays through the pitches on its own.
- **Why:** the plan (slice 3) says "the scene stays where it is, above the sections, for now". The canvas moved it. No slice moved it afterwards.
- **Also:** in the canvas the scene follows the selected pitch ("follows the pitch above"); in live it follows it too, but the live caption does not say so.
- Images: `V02-canvas.png`, `V02-live.png`.

### V03. Section headings and lead-in lines are missing · medium · spec gap
- **Canvas:** each section opens with a 15 px caps heading, a grey one-line lead-in and a 2 px ink rule: "The edge — Who this matchup favors, before any detail." / "Pitch by pitch — One tug-of-war per pitch. The centre line is the league. Tap a pitch to drive the map below." / "Where — One map, both players. Colour is Chourio's result. The black square is how often Pivetta throws there." / "Past meetings".
- **Live:** none of the four has a heading or lead-in (`#scout-pitches`, `#scout-where`, `#scout-meet` contain no heading element at all; the Edge section has only the three card headings). The first thing under the jump bar is the verdict tab, the "Pitch by pitch" column header, the chip strip, and the facts tiles.
- **Effect:** the jump bar is the only label for a section, and the lead-in lines that explain how to read the tug-of-war rows and the map are gone.
- Images: `V03-canvas.png`, `V03-live.png` (Edge shown; the other three are the same gap).

### V04. The Where map: scale, frame and figure · large · spec gap
- **Canvas:** the map sits in a **full-bleed** cream panel with ink rules above and below. Rows are 72 / 44 / 58 / 58 / 58 / 44 / 42 px, the six cell columns use the full width (104 px figure column plus five cells). The panel header has a title on the left ("Both · xwOBA (est.)") and "All · 263 pitches" on the right. The batter figure is 203 x 430 px. A thin vertical line marks the batter's box. The share squares go up to 20 px. A pitcher-side readout and key sit inside the same panel.
- **Live:** the map is a plain block in the page, about **280 px** wide with about **30 px** rows, so the cells are roughly half the canvas size. The figure is 137 x 289 px (about 0.67 of the canvas). Share squares are about 4 px (they read as dots). The "%" sign is small. There is no panel, no right-hand sub-title and no box line. An extra line "1,644 pitches seen" sits under the map.
- **Effect:** the numbers inside the cells are small and tight. The canvas gives each cell room for a large value and a small square with its share.
- Images: `V04-canvas.png`, `V04-live.png`.

### V05. Meetings: the plate-appearance card · large · spec gap
- **Canvas:** a two-column card. The left column is a scorebook cell: the inning ("1st"), a small diamond with the scoring mark inside ("6-3", "L8", "L6"), and the result under it ("Groundout"). The right column lists the pitch rows first (number, pitch mark, name and mph, "Count b-s", the call tag), then a three-column "Exit velo · Launch · xwOBA" line, then the play text.
- **Live:** a rounded card with a "1st inning" title and a tag with the result code ("FO", "GO", "LO") and "5 pitches" at the top, the play text next, then **three big stat tiles** (exit velocity, launch angle, xwOBA on contact), then the pitch rows last. No diamond or scoring mark. Order of parts is reversed (play and stats above the pitches).
- **Also:** one canvas game header per game "Sep 22, 2025 … Regular season · 3 PA" (right-aligned label). Live uses "10/6/26 [NLDS]" in a small outlined tag and no PA count.
- Images: `V05-canvas.png`, `V05-live.png`.

### V06. Meetings: pitch colours and the mix bars do not match the Pitches section · medium · bug or spec gap
- **Canvas:** the same pitch colours everywhere: fastball red, sweeper blue diamond, cutter purple, curveball pink diamond (the app's `pitchMark`). The "What Chourio saw" bars use them.
- **Live:** the Pitches section and the chip strip use the red/blue/purple/pink marks. The Meetings section uses **green fastball, ink-black sweeper, hatched cutter and curveball** in the mix bars, the legend and the pitch rows (small round dots, all circles). The same pitch has two colours on one page.
- **Also:** the mix labels are "In the meetings" / "2026 to RHH" with the share written inside the bar; the canvas writes "Meetings" / "2026 to RHH" with no numbers in the bar and puts the numbers in a sentence under it. The canvas sentence ("He has never seen the cutter.") reads "Chourio saw no cutters in their meetings. Pivetta now throws it 18% of the time to righties." in live (better copy; just different).
- Images: `V06-canvas.png`, `V06-live.png`.

### V07. Jump bar · medium · spec gap (partly bug)
- **Canvas:** four equal 44 px tabs that fit the width, the active tab filled ink, counts only on Pitches (4) and Meetings (3) as small **green-filled chips**.
- **Live:** the tabs are wider and the bar **scrolls sideways** at 390 px (`scrollWidth` 496 against 358): the "Meetings" tab is cut off at the right edge. Edge and Where show an **empty placeholder box with a dot** where the canvas shows nothing. Counts are in an outlined box, not a green chip (the active tab has a green fill). The tab text looks larger than the canvas's 14 px (I did not measure it).
- Images: `V07-canvas.png`, `V07-live.png`.

### V08. Verdict card type sizes and details · medium · spec gap
- **Canvas:** headline "Even" **44 px**, sub-line 14 px caps, label "The verdict" in a tab with a cream border, 4 px grey shadow, scale labels Clear / Slight / Even / Slight / Clear in 11 px, side labels "◀ Pivetta" blue-tint and "Chourio ▶" amber-tint, no underline, a padded card (18 px top).
- **Live:** headline **32 px**, sub-line 12 px, the side labels **have an underline in the side colour**, the card is tighter. The scale and the marker are the same idea and read the same.
- Same: the five-segment scale, the marker with its signed value ("+.027"), the league line, the expected line.
- Images: `V08-canvas.png`, `V08-live.png`.

### V09. Readout, key and hot/cold tiles · medium · spec gap
- **Canvas:** under the map: (1) a readout box for the picked region (name, "Pivetta 6% · 15 of 263 pitches", "Chourio .604 · 31 PA-ending pitches · Chourio's side"), shown from the start with "Heart" picked; (2) a five-swatch key bar with "◀ Pivetta's side · league · Chourio's side ▶"; (3) two **tiles side by side**: "Into his hot spots 14%" and "Into his cold spots 26%", each with a one-line list of the regions.
- **Live:** "Tap a region for its numbers" (nothing picked), then one **cream paragraph with an amber left rule**: "Chourio's three hottest spots (up · inside · 3B side; …) get 13% of Pivetta's pitches. His most common spot is above the zone (30%), where Chourio is at league level." Then a text key ("Square: how often he throws there", "xwOBA (est.) vs league: below [swatches] above", "Under 50 pitches …"). **No cold-spot figure and no tiles.**
- Images: `V09-canvas.png`, `V09-live.png`.

### V10. Meetings facts block · medium · spec gap
- **Canvas:** a square 3 x 2 grid with six facts: Line, Pitches, K · BB, Slash, Avg EV, xwOBA con (label caps, value 15 px bold).
- **Live:** four rounded tiles (hits, pitches, average exit velocity, xwOBA on contact), then a grey line "AVG/OBP/SLG … · 0 HR · 0 K · 0 BB" that wraps onto two lines. No "Past meetings" title.
- Images: `V10-canvas.png`, `V10-live.png`.

### V11. Things to watch · medium · data plus spec gap
- **Canvas:** the heading is "Four things to watch". Each item is a numbered row: the number (20 px), a **56 px square headshot with a sage background and ink border**, the side tag, then 12 px text. Rows are separated by hairlines.
- **Live:** "Things to watch", numbers the same, a **rounded headshot with a transparent background** and a dark rim, the sentence in 13 px. Rows have hairlines. Three items, not four (data: the "danger is middle-in and the heart" item is not produced, and the other texts are the live sentences, for example "Chourio beats the league on 3 of Pivetta's 4 pitches …").
- Images: `V11-canvas.png`, `V11-live.png`.

### V12. Pitch rows: text case, bar strokes and shadow · medium · spec gap
- **Canvas:** the verdict words are sentence case ("Slight · Chourio", ".391 vs .330", "Swings at 48% · league 50% · favors neither") with a **dashed rule** above the swing line. The bar fills have no outline. Row cards have a **2 px** ink border.
- **Live:** the verdict words and the "vs" lines and the swing line are **UPPERCASE** ("CLEAR · CHOURIO", ".405 VS .329", "SWINGS AT 48% · LEAGUE 50% · FAVORS NEITHER"), the swing line has a solid hairline, the **bar fills have a dark outline**, and the row borders are **1 px** (measured; the canvas uses 2 px). The usage bar and the layout of the rows (mark, name, "49% · 93.9 mph", usage bar, Contact, Whiff, swing line) match.
- Probe: live tag is JetBrains Mono 11 px bold, `text-transform: uppercase`.
- Images: `V12-canvas.png`, `V12-live.png`.

### V13. "All pitches" and selected-row states · medium · spec gap
- **Canvas:** "All pitches" at load is an **ink-filled** button (cream text) with "263 to righties". A selected row keeps its **2 px ink border** and gets a **4 px hard ink shadow** (offset down and right). The chip and "All" invert to ink.
- **Live (measured):** "All pitches" at load is a light card with a **1 px** border and a **3 px green ring** (`box-shadow: 0 0 0 3px rgba(47,110,79,.35)`) and "330 pitches". A selected row (Sweeper) gets the same green ring and a slightly whiter fill; its border stays **1 px**, with **no hard shadow**. The chip strip in Where uses an ink fill plus an amber underline for the selected chip.
- **Effect:** the green accent is not in the canvas, and the selected state of the rows is much weaker than the canvas's ink inversion and shadow.
- Images: `V13-canvas.png`, `V13-live.png` (top: default "All pitches"; below: Sweeper selected).

### V14. "What pushes it" card · small to medium · spec gap
- **Canvas:** the card title is a plain 13 px caps heading inside the card; the lead-in is 11 px dark; the push name and "49% of pitches" are in sentence case; the track is paper-tinted; the closing note (5 lines) names the types too few for a map.
- **Live:** the title is an **ink name tab** on the card edge ("What pushes it"); the lead-in is 13 px grey; the share line is uppercase ("52% OF PITCHES"); the track is white; the closing note is shorter. Same bars and values layout.
- Images: `V14-canvas.png`, `V14-live.png`.

### V15. Where controls: answer strip, chip strip, Show / Metric · medium · spec gap
- **Canvas:** the chip strip is 44 px high with the pitch mark in each chip, pinned under the jump bar. Below it the **answer strip**: a sharp 2 px ink box with "Expected xwOBA (est.)" and "All pitches · 72% of pitches mapped" on the left and the number at 30 px, right-aligned, with "league .308" under it. Show and Metric are two **full-width segmented rows**: a 58 px label and three 44 px buttons.
- **Live:** the answer card has **rounded corners and a white fill**, and holds a 28 px number on the left, a "League .315" swatch, and a line "Leaves out curveball (30): too few for a map". Show and Metric are compact buttons with an amber underline for the selected one, left-aligned, not full width. The chips look a little shorter than the canvas's 44 px (by eye).
- Images: `V15-canvas.png`, `V15-live.png`.

### V16. Locations mode: tint colour and counts · medium · spec gap
- **Canvas:** "Locations" paints each cell with a neutral **ink-grey tint** that grows with the pitcher's share, shows the share (6%) and the **pitch count** under it (17). The title is "Where Pivetta throws" with "All · 263 pitches" at the right.
- **Live:** "Locations" paints a **salmon / clay-red tint**, shows only the share, **no counts**. The title is "Where Pivetta throws to righties · % of pitches". This red is not in the canvas; the plan says never to use clay for a side (I did not check whether this red is the clay token).
- Images: `V16-canvas.png`, `V16-live.png`. (Metric Swing % was on, as the 2 shots show.)

### V17. Whiff % with a pitch selected · small · data and spec gap
- **Same:** the tone flip works as the canvas has it (high whiff is the pitcher's blue, low is amber), hatching for thin cells, the chip selection.
- **Differs:** the canvas answer strip reads "29% league 19% · Fastball · 93.9 mph · on his spots"; live reads "28% · League 22%" with no "on his spots". The two compare different leagues (canvas: league on the same locations; live: league for the pitch, I did not trace it). In the canvas a map cell is picked at load (the 3 px ring and a readout); in live none is.
- Images: `V17-canvas.png`, `V17-live.png`.

### V18. No note under the pitch rows · small · spec gap
- **Canvas:** under the rows: "Whole-pitch rates, 2026 regular season, both pitcher hands. Even is within ±.030 xwOBA or ±4 whiff points; Slight to ±.070 or ±10; Clear past that."
- **Live:** nothing. The rows are followed by the chip strip. This is the only place the thresholds are explained.
- Images: `V18-canvas.png`, `V18-live.png`.

### V26. Page header · small · deliberate (the canvas leaves out site chrome)
- **Canvas:** a plain "Matchup Scout / Scouting report" bar with a 2 px rule. **Live:** the real site header (Tally logo, search, Game Log, menu), then a "Matchup Scout" title with no rule and no "Scouting report" label. Probably fine; listed so Gary can say so.
- Images: `V26-canvas.png`, `V26-live.png`.

---

## Desktop (1280 px)

### V19. Pitches beside Where: layout and where the scene goes · large · spec gap
- **Canvas:** two columns. A narrow left column holds the tug-of-war rows. The right column is one stamped **map card**. Under the map card, the hot and cold tiles sit at the left and the scene card at the right, so the page reads left to right. The Edge and Meetings sections are full width around it.
- **Live:** two columns too, but the **scene sits at the top of the right column** (large, about 500 px wide), then the answer card, the controls and a small map, then the callout. The scene pushes the map down by about 300 px. The right column is left with a lot of empty space beside the small map.
- Images: `V19-canvas.png`, `V19-live.png`.

### V20. Map size on desktop · large · spec gap
- **Canvas:** the map is a big panel with a 700 px-wide grid, a large figure, a readout box and a key row inside the card.
- **Live:** the map keeps its phone proportions: a small grid (about 190 px of cells) next to the figure inside a 590 px column, so most of the column is empty. The readout, key and callout are outside any card.
- Images: `V20-canvas.png`, `V20-live.png`.

### V21. Edge row: verdict and pushes · medium · spec gap
- **Canvas:** the verdict card is wide and short with "Even" beside its sub-line on one row, the scale below; "What pushes it" is a narrower card on the right; the long note ("xwOBA (est.) counts every plate appearance …") **runs across the full width under both**.
- **Live:** the two cards are equal height, so the verdict card has a **large empty dark area** under its last line. The note sits inside the pushes card.
- Images: `V21-canvas.png`, `V21-live.png`.

### V22. Matchup card on desktop · medium · spec gap
- **Canvas:** one wide stamped card. Pivetta at the left, the large "Nick Pivetta" and "Jackson Chourio" names (about 34 px) next to 56 px headshots, "vs" in the middle, side bars under each name, the filters row along the bottom with "Change pair" at its right end.
- **Live:** no card; small centred headshots with the full names under them, "Change" at the far right, the filter chips below.
- The plan (slice 8) says 96 px headshots; the live headshots are about 60 px wide.
- Images: `V22-canvas.png`, `V22-live.png`.

### V23. Jump bar on desktop · small to medium · spec gap
- **Canvas:** three small tabs: Edge, **Pitches & Where (4)**, Meetings (3), no frame.
- **Live:** four tabs (Pitches and Where are separate), inside a **thick full-width ink frame** with a hard shadow. In the canvas, Pitches and Where are one tab because they are one block on the page.
- Images: `V23-canvas.png`, `V23-live.png`.

### V24. Things to watch: grid on desktop · small · data
- **Canvas:** four items fill a 2 x 2 grid. **Live:** three items in two columns leave an empty slot at the right. Item style as in V11.
- Images: `V24-canvas.png`, `V24-live.png`.

### V25. Meetings on desktop · medium · spec gap
- **Canvas:** a facts grid and the "What Chourio saw" bars at the left, and the PA cards in a three-column row at the right of them. **Live:** facts as four wide tiles across the full width, the bars full width, then the PA cards in a three-column grid, one row per game. Card content is the V05 difference. The live section is much taller (about 1000 px against about 600 px).
- Images: `V25-canvas.png`, `V25-live.png`.

---

## Not compared

- The canvas Results mode, and Swing % with a pitch selected (the tones match V16's Swing % ink tints).
- A retired pair (slice 7b) and the left-handed figure (slice 6b): not in the canvas.
- Motion: stills only.
