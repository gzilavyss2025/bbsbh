# Ballpark commemorative stamps — the generation recipe

The "Every ballpark" milestone shelf (`src/screens/logbook/LogbookMilestones.jsx`)
draws each of the 30 parks as a postage stamp: a perforated cream frame around an
image, with the club's knockout mark in the roundel where a denomination sits.

Today that image is the park's **photograph** (`ballparkPhotoThumb`). The intent is
to replace it, a few parks at a time, with a **commemorative illustration** in the
manner of the real USPS *Legendary Playing Fields* pane (2001). This file is the
prompt that makes one, and the table of the 30 substitutions that make a series.

## How a finished stamp gets in

1. Generate the image (prompt below).
2. Save it to `public/ballparks/stamp/{key}.webp`, using the venue key from the
   table — the same key `venueKey()` produces.
3. Add `{key}: 'webp'` to `STAMP_KEYS` in `src/lib/ballpark/ballparkArt.js`, in the
   **same commit as the file**.

`ballparkStampArt()` returns null for anything not listed, and the shelf falls back
to the photograph, so the series can land in batches without a broken image ever
showing. There is no need to have all 30 before shipping the first.

## What the frame already draws — do not generate these

The CSS owns the stamp furniture. An illustration that includes it will double up.

| Element | Owned by | Consequence for the image |
| --- | --- | --- |
| Perforated edge | SVG mask, 13 × 11 holes | Do **not** draw perforations |
| Cream margin | `--paper-3` `#FFFDF6`, 6.5% pad | Ground should be that exact colour |
| Denomination | Club mark, 22px roundel, upper right | Leave a **quiet zone** there |
| Unfilled state | `grayscale(1)` + `opacity: .4` | Palette must survive desaturation |
| Slot size | ~110px wide, 5:4, `object-fit: cover` | Compose very coarsely |

Two of those rows are the ones people get wrong:

**Grayscale.** An unstamped park renders desaturated. Two inks of the same
*luminance* separate by hue on screen and collapse to one grey when it goes flat.
Pick inks that differ in value, not just colour.

**Aspect ratio.** ChatGPT will not emit 5:4. Ask for **1536 × 1024** (3:2) and let
`object-fit: cover` crop the sides — which it will, so keep the subject away from
the left and right tenth of the frame. Do not crop by hand; the CSS does it.

## The prompt

Attach the park's photograph, then send the prompt with the four bracketed values
filled in from the table.

```
Draw a commemorative postage-stamp illustration of [PARK], from the attached
photograph. One image, landscape 1536x1024.

It belongs to a 30-stamp series, so these hold for every park:

GROUND. Warm off-white #FFFDF6, edge to edge. Faint paper fibre, matte tooth.
No aged or stained paper, no torn edges, no drop shadow, no vignette, and no
border, frame, or margin of any kind.

NO FURNITURE. Do not draw perforations, a stamp frame, a denomination, "USA",
a year, a park name, a caption, or any lettering anywhere in the image. If the
photograph contains signage, render it as a blank shape. This matters more than
any other instruction here: text is the single most common failure.

QUIET ZONE. The upper-right corner -- about 30% of the width by 30% of the
height -- stays empty paper or one quiet ink. A badge is placed there later.

MARGIN. Keep the subject clear of the left and right tenth of the frame. The
image is cropped to 5:4 on both sides when it is used.

SKY. Unprinted paper. Not a coloured field, not a gradient. This is most of
what makes it read as a stamp rather than as a picture.

INK. Three flat spot colours and no more:
  - a near-black navy, shared by all 30 stamps
  - [CLUB INK], desaturated toward a printed ink rather than a screen colour
  - one neutral mid-tone -- ochre, taupe, slate, or muted green
Set them near 15%, 45%, and 75% luminance so all three stay distinct in
grayscale. Flat fills only: no gradients, no blends, no halftone dots, no
rosettes, no visible screen.

THIS PARK IS [MASS or LINE].
  MASS  -- built from flat shapes. Grandstand bulk, roofline, the one famous
           wall. Solid areas of colour with clean edges.
  LINE  -- built from stroked linework over flat ground. Open steelwork,
           trusses, and light towers are drawn as lines, never filled in as
           solid shapes, which destroys them.

SUBJECT. [SUBJECT]. Keep four or five shapes in total and drop everything
else -- crowds, cars, seats, window grids, parking, light poles you did not
list, background buildings. The field, if it appears, is one flat shape: no
mowing stripes, no dirt texture. If the attached photograph does not show the
subject named above, use what the photograph does show and reduce it the same
way.

PRESS. Mid-century multi-colour gravure. Each ink laid separately with about
1-2mm of misregistration, uneven coverage, dry ink starvation at the edges,
paper showing through the solids, coarse granularity, slightly ragged edges.
Ink pressed into paper -- not a vector illustration, not a photographic filter,
not a 3D render.

Quiet, printed, collectible. A stamp a collector would keep.
```

## The 30

`INK` is a starting point from the club's identity, not a rule — if the photograph
carries a stronger colour, use it. `MODE` is which of the two build methods the park
wants. Parks marked **LINE** are the ones that fail as flat shapes.

| Key | Park | Ink | Mode | Subject |
| --- | --- | --- | --- | --- |
| `americanfamilyfield` | American Family Field | navy + gold | LINE | Fan-shaped retractable roof arcs over a brick arcade |
| `angelstadium` | Angel Stadium | scarlet | MASS | The halo sign, the outfield rock formation |
| `buschstadium` | Busch Stadium | brick red | MASS | The Gateway Arch on the skyline past the outfield |
| `chasefield` | Chase Field | sedona red + teal | LINE | Retractable roof trusses over a boxy brick shell |
| `citifield` | Citi Field | blue + orange | MASS | The rotunda's brick facade and arched windows |
| `citizensbankpark` | Citizens Bank Park | red | MASS | The Liberty Bell sign, the outfield bowl |
| `comericapark` | Comerica Park | navy + orange | MASS | The Detroit skyline over the outfield |
| `coorsfield` | Coors Field | purple + brick | MASS | Brick facade, the mountains beyond |
| `daikinpark` | Daikin Park | navy + orange | LINE | Retractable roof frame, the train along the wall |
| `uniqlofieldatdodgerstadium` | Dodger Stadium | dodger blue | MASS | Zigzag pavilion canopies, palms, terraced decks |
| `fenwaypark` | Fenway Park | green + red | MASS | The Green Monster and its manual scoreboard |
| `globelifefield` | Globe Life Field | royal + red | LINE | The roof's steel frame and glass end wall |
| `greatamericanballpark` | Great American Ball Park | red | MASS | The riverboat smokestacks in centre |
| `kauffmanstadium` | Kauffman Stadium | royal blue | MASS | The crown scoreboard and the outfield fountains |
| `loandepotpark` | loanDepot park | blue + red | LINE | Retractable roof, the glass wall to the skyline |
| `nationalspark` | Nationals Park | navy + red | MASS | Pale concrete decks, the Capitol dome sightline |
| `oraclepark` | Oracle Park | orange + black | MASS | Brick arcade and the right-field wall over the water |
| `orioleparkatcamdenyards` | Oriole Park at Camden Yards | orange + black | MASS | The B&O Warehouse brick wall |
| `petcopark` | Petco Park | sand + navy | MASS | The Western Metal Supply brick building in left |
| `pncpark` | PNC Park | black + gold | MASS | The Clemente Bridge and the Pittsburgh skyline |
| `progressivefield` | Progressive Field | navy + red | LINE | The white toothbrush light towers |
| `ratefield` | Rate Field | black + silver | MASS | The scoreboard's pinwheel crown |
| `rogerscentre` | Rogers Centre | royal blue | LINE | The domed roof with the CN Tower alongside |
| `sutterhealthpark` | Sutter Health Park | green + gold | MASS | A small park: low decks, outfield berm, trees |
| `tmobilepark` | T-Mobile Park | navy + teal | LINE | The retractable roof rails, the Seattle skyline |
| `targetfield` | Target Field | navy + red | MASS | Limestone facade, the shaking-hands sign |
| `tropicanafield` | Tropicana Field | navy + light blue | LINE | The tilted white dome and its catwalks |
| `truistpark` | Truist Park | navy + red | MASS | The open bowl and the buildings past the outfield |
| `wrigleyfield` | Wrigley Field | blue + red | MASS | The ivy wall and the hand-turned scoreboard |
| `yankeestadium` | Yankee Stadium | navy | MASS | The white frieze arcade along the roofline |

**Wrigley is the trap.** Its most familiar object is the marquee, which is mostly
lettering, and lettering is the one thing this prompt forbids. Use the ivy and the
scoreboard instead — the scoreboard reduces to a shape, the marquee does not.
