# Ballpark layouts: coverage report

This report lists each playing-field configuration the app knows, where its
fence outline comes from, who draws it, and what is still missing. Issue #1859,
slices 1 to 5.

Code: `src/lib/ballpark/layout/`. The registry is `configurations.js`. The
choice of outline is `fences.js`. The resolver is `resolveLayout.js`
(`resolveBallparkLayout({ venueId, venueName, gameDate })`). The imported store
is `fields.js`, written by `npm run gen:field-layouts`
(`scripts/ballpark/import-field-layouts.mjs`). Tests:
`test/ballpark-layouts.test.js` and `test/field-svg.test.js`. Audit date:
2026-10-12, Savant season 2026.

## Sources

| Source | Gives | Used for |
| --- | --- | --- |
| [Baseball Savant Dimensions](https://baseballsavant.mlb.com/leaderboard/statcast-park-factors?type=dimensions&year=2026) | Measured distances and wall heights at five bearings, deepest point, fair area, per venue id and season. Flags a season whose configuration changed. | The audit targets. Wall heights. The change dates. |
| MLB Gameday field SVG, `prod-gameday.mlbstatic.com/…/images/fields/{venueId}.svg` | A vector drawing of the field in a 250×250 frame, with named layers. | The current fence outline of each MLB park. |
| [GeomMLBStadiums](https://github.com/bdilday/GeomMLBStadiums) at `90b4356e` (MIT, Copyright 2018 Ben Dilday) | One traced outline per team, 2018 (Orioles 2023). | Older configurations only. |
| Stats API venue endpoint | Posted distance signs. | The distance labels. |

The app stores numbers derived from the Savant table and the Gameday drawings,
never the drawings. Neither MLB source publishes a license. The app already
reads both hosts for other data (`scripts/lib/savant.mjs`, logos on mlbstatic).

## How the Gameday outlines are extracted and checked

- Home plate is where the two drawn foul lines meet.
- One scale for every park: 2.40 ft per unit. The median of a per-park fit to
  Savant's pole distances is 2.400. A per-park fit would hide a wrong drawing,
  so it is only logged.
- The wall is sampled every 0.25° from pole to pole and simplified to 1 ft.
  Each pole sits on its foul line, at the wall distance 0.5° inside it.
- The outline is stored only when it agrees with the same season's Savant row:
  CF and deepest point within 5 ft, poles within 10 ft, the gaps within 8 ft,
  and the fair area within 2.5%.

Savant does not publish the bearing of its gap measurements. The ±18° used
for the gap check is where Savant's gap distances fall on the outlines that
agree everywhere else. That is an inference from the 2026 rows.

The 2018 traces used a fixed transform (2.4957 ft per unit, home at y = 199).
Against Savant it runs a few percent large. That is why the first version of
this report showed Yankee Stadium and Oracle Park 12–18 ft too deep.

## Quality levels

| Fence quality | Meaning |
| --- | --- |
| `audited` | An outline that passed its audit: Gameday against Savant, or a 2018 trace against the posted CF (within 10 ft). |
| `estimated` | A 2018 trace that misses the posted CF. None is drawn today. |
| `dimensions-only` | No usable outline. The renderer draws straight runs through the five posted distances. |
| `missing` | Not even five posted distances. |

No outline is `verified` by a person yet. That level is for a future check
against a diagram or an aerial photo.

## Current configurations

| Venue id | Park | Fence | Worst audit error |
| --- | --- | --- | --- |
| 1 | Angel Stadium | audited (Gameday) | RF pole +4.4 ft |
| 2 | Oriole Park at Camden Yards (2025–) | audited (Gameday) | area −1.8% |
| 3 | Fenway Park | audited (Gameday) | RF pole +9.0 ft (Pesky's Pole) |
| 4 | Rate Field | audited (Gameday) | CF −1.0 ft |
| 5 | Progressive Field | audited (Gameday) | CF −1.1 ft |
| 7 | Kauffman Stadium (2026–) | dimensions-only | SVG shows the earlier wall: poles +10 ft, area +2.8% |
| 12 | Tropicana Field | audited (Gameday) | LF pole +5.2 ft |
| 14 | Rogers Centre (2023–) | dimensions-only | SVG shows the earlier wall: right gap +10.3 ft, area +3.1% |
| 15 | Chase Field | audited (Gameday) | LF pole +4.4 ft |
| 17 | Wrigley Field | audited (Gameday) | LF pole −2.3 ft |
| 19 | Coors Field | audited (Gameday) | deepest +1.4 ft |
| 22 | UNIQLO Field at Dodger Stadium | audited (Gameday) | LF pole +3.6 ft |
| 31 | PNC Park | audited (Gameday) | LF pole +2.5 ft |
| 32 | American Family Field | audited (Gameday) | LF pole +2.4 ft |
| 680 | T-Mobile Park | audited (Gameday) | LF pole +4.2 ft |
| 2392 | Daikin Park (2017–) | audited (Gameday) | left gap +2.5 ft |
| 2394 | Comerica Park (2023–) | dimensions-only | SVG shows the 422-ft wall: CF +9.5 ft, deepest +12.4 ft |
| 2395 | Oracle Park | audited (Gameday) | RF pole +3.7 ft |
| 2529 | Sutter Health Park | dimensions-only | no usable SVG (a sheet of many parks) |
| 2602 | Great American Ball Park | audited (Gameday) | LF pole +2.3 ft |
| 2680 | Petco Park | audited (Gameday) | right gap −1.8 ft |
| 2681 | Citizens Bank Park | audited (Gameday) | LF pole +3.7 ft |
| 2889 | Busch Stadium | audited (Gameday) | LF pole +5.9 ft |
| 3289 | Citi Field | audited (Gameday) | area +0.7% |
| 3309 | Nationals Park | audited (Gameday) | deepest −0.9 ft |
| 3312 | Target Field | audited (Gameday) | right gap −1.0 ft |
| 3313 | Yankee Stadium | audited (Gameday) | LF pole +3.6 ft |
| 4169 | loanDepot park (2020–) | audited (Gameday) | LF pole +2.1 ft |
| 4705 | Truist Park | audited (Gameday) | LF pole +1.2 ft |
| 5325 | Globe Life Field (2020–) | audited (Gameday) | left gap −7.9 ft, area −2.1% |

Wall heights for every park above come from Savant's measured line, CF and
line heights. Sutter Health Park is now 8 / 8 / 13 ft (it was a flat 8).

## Earlier configurations

Each date below agrees with a Savant configuration flag (2016 on). Which wall
a 2018 trace shows is an inference from its depth; each record's `note` says so.

| Configuration | Dates | Fence | Why |
| --- | --- | --- | --- |
| Globe Life Park in Arlington (venue 13) | to 2019 | 2018 trace | The Rangers trace predates Globe Life Field. |
| Camden Yards | 2022–2024 | 2023 retrace | Fits the 2022 "Walltimore" wall. Savant flags 2022 and 2025. |
| Kauffman Stadium | to 2025 | 2018 trace | Savant shows no change 2016–2025, then flags 2026. |
| Rogers Centre | to 2022 | 2018 trace | Both alleys moved in for 2023 ([Global News](https://globalnews.ca/news/10465943/rogers-centre-renovations-changed-how-it-plays/)). |
| Comerica Park | to 2022 | 2018 trace | CF moved in from 422 to 412 ft for 2023 ([Ballpark Digest](https://ballparkdigest.com/2023/01/11/tigers-announce-new-comerica-park-outfield-dimensions/)). |
| Minute Maid Park | to 2016 | 2018 trace | Reaches 433 ft: Tal's Hill (Savant 2016: 434). |
| Marlins Park | 2016–2019 | none | Savant flags 2016 and 2020. No outline for this wall. |
| Marlins Park | to 2015 | 2018 trace | Reaches 420 ft: the 2012 wall (418). |

## Open items

- **Posted signs that disagree with Savant.** The Stats API still posts
  Kauffman's lines as 347 / 344 ft (Savant 2026: 324), loanDepot's CF as 407
  (Savant: 396), and Comerica's as 420 (the club announced 412; this repo now
  uses 412). Labels still use the posted signs. Confirm the current signs before
  changing them.
- **New outlines needed:** Comerica Park, Rogers Centre, Kauffman Stadium (all
  three SVGs show an earlier wall), and Sutter Health Park. A re-import picks
  up a corrected SVG on its own.
- **MiLB parks without a drawing (43 of 119).** These have no Gameday SVG (a
  403) or an SVG with no foul-line template, and fewer than five posted
  distances. They stay "not on file". A hand trace is the way to add one (see
  "Adding a park" below).
- **MiLB date history.** A minor-league record covers the imported season
  onward. A game from an earlier season at the same park resolves to nothing.
- **Gap bearings of the five-point fallback.** A park with no outline draws
  its posted gap signs at ±22.5°. No source gives the bearing of a posted gap
  sign, so the accuracy note says the wall is drawn straight between them.

## Minor-league parks (slice 3)

The importer also reads the home park of every MiLB club in
`public/data/teams.json` (119 venues, sportIds 11–14). For each:

1. **Posted distances** from the Stats API venue endpoint (`fieldInfo`).
   Savant does not measure minor-league parks.
2. **The outline**, from the park's Gameday SVG. Most are an older style with
   no named layers (`legacyFenceFromSvg`): home plate is the lowest point of
   the three-point foul-line template, and the wall is the outer edge of every
   track- or grass-coloured shape (the grey compass glyph never counts).
3. **One scale for the older art: 2.333 ft per unit.** It is the median fit of
   the drawn LF, CF and RF to the posted signs over the 68 parks that parse.
   The named-layer MLB art is 2.40.
4. **The audit**: LF line, CF (at straightaway or the deepest point) and RF
   line, each within 10 ft of its posted sign. Only a passing outline is
   stored.

| Level | Drawable | With an outline |
| --- | --- | --- |
| Triple-A | 24 of 30 | 13 |
| Double-A | 24 of 30 | 12 |
| High-A | 16 of 30 | 12 |
| Single-A | 12 of 29 | 6 |
| **All** | **76 of 119** | **43** |

A minor-league outline is `estimated`, never `audited`: the art is stylized
(Principal Park is a flat-topped box) and the only check is three posted
signs. Its drawing prints no note: the old "Wall from MLB's drawing of this park,
checked against its posted distances" told the reader nothing, so it went
(2026-10-21). A park with no passing outline but five posted signs draws the
straight five-point wall with its note. Minor-league walls have
no known heights, so no height is printed.

On the screens, a drawable minor-league park gets the drawing on the team
hub's Ballpark card and in the lineup page's Ballpark sheet, without league
ranks. The hit charts and the ball-flight card draw it for a game that sends
hit coordinates.

## Foul ground, warning track and infield (slice 5)

Each layer has its own quality (`layout.quality.foul`, `.track`, `.infield`):
a checked fence does not make its foul ground checked.

| Layer | Source | Check | Coverage |
| --- | --- | --- | --- |
| Foul ground (`geometry.surface`) | The Gameday SVG's `Outfield` layer: the playing surface, fair and foul, out to the wall and the stands | Holds the fence (within 5 ft); backstop 35–90 ft; larger than fair territory | 26 current MLB parks |
| Warning track (`geometry.trackInner`) | The Gameday SVG's `grass` layer: its outer edge is the track's inner edge | 8–40 ft wide at every 5° across fair territory | 25 (not Fenway: 46–52 ft at the triangle and the RF bend) |
| Infield | None | — | The regulation drawing everywhere (90-ft bases, the 95-ft arc). Gameday's infield is one stamp in every SVG, so it measures nothing. |

Both Gameday layers are estimates of a drawing, not measurements, and the
drawing shows no note for them (the owner's call, 2026-10-12). Two published
anchors back the foul ground's size: SABR (via
[WBUR](https://www.wbur.org/news/2015/06/09/fenway-park-safety-tonya-carpenter))
puts Fenway under 20,000 sq ft of foul territory and the Oakland Coliseum over
35,000; the drawings give 16,825 and 38,032. Two things look off: the drawn
backstops (41–57 ft) sit short of the 60 ft or more most parks have, and the
drawn tracks (17–24 ft) look wide. A park with no stored layer, an older wall
or a minor-league park draws the stylized foul ground and track.

## Overlay alignment

The marks and the park use separate calibrations, on purpose: hit coordinates
go through `hitCoordToSvg` (2.51 ft per unit, fitted to the feed's own
distances), and the outlines are 2.40 ft per unit (fitted to Savant's walls).
`test/overlay-alignment.test.js` checks that they agree:

- a ball d feet out at a bearing plots on the drawing's own d-foot point, and a
  ball at the pole on the end of the drawn foul line;
- on 24 real June 2026 games at eight parks
  (`test/fixtures/overlay-alignment-2026.json`, built by
  `.scratch/overlay-alignment/build.mjs`), every home run lands beyond the
  wall its park draws (measured: 12 to 104 ft beyond), and no more than 2% of
  caught balls land more than 10 ft past it (measured: 3 of 292, the farthest
  21 ft). Drawing the walls 4% too large, as the 2018 traces did, fails it;
- an HTML label laid over the cropped plot window (`plotPercent`) lands where
  the SVG puts its mark.

## Park names and renames

Sponsors rename parks, mostly over the winter. Everything here resolves by
Stats API venue id first, and a rename never changes the id:

- `resolveBallparkLayout` and `ballparkFor` / `rankedDimensions` take the
  venue id, so a renamed park keeps its wall, its facts and its ranks the day
  the new name ships. The name (with the aliases in `ballparkData.js`) is only
  the fallback for a caller with no id.
- A game's drawing is labelled with the name the park had that day (the
  feed's own name), not today's sponsor name.
- The importer reads every club's park name for the imported season and the
  next one. It logs an MLB name that no alias resolves (`RENAME?`) and an MLB
  venue with no layout record (`NEW PARK?`), and it stores both names of a
  renamed minor-league park. On 2026-10-12 it found no MLB rename, and one
  minor-league rename: Lehigh Valley's Coca-Cola Park (venue 3230) is Jefferson
  Park in the 2027 data.

Re-run the import once next season's names are posted (the offseason), and
again before Opening Day.

## Season spray maps (slice 4)

A season is many parks, so the player page's spray map keeps its generic field
for "All parks". Its park picker draws one park's real wall and only the balls
hit there.

- **The store keeps each ball's park** as runs beside the rows
  (`g: [[count, venueId], …]`, schema version 2, `scripts/gen-spray.mjs`). The
  season is the folder's. Venue and season pick the wall because every
  configuration covers whole seasons; `test/spray-parks.test.js` holds the
  registry to that.
- **Grouped by wall, not by venue.** An All-seasons view across a renovation
  lists each wall on its own, with its seasons in the label.
- **Counts come from the balls hit there.** The stored season totals have no
  park, so a park view counts the balls with a landing point at that park
  (the chips, the facts and the foot), and its foot says so.
- **Coverage.** A ball with no park on record (stored before version 2), or at
  a park with no layout, stays in the All-parks field and in no park's count.
  The All-parks foot says how many.
- **Migration.** The committed 2026 store is version 1. The first nightly run
  after this merges rebuilds 2026 with parks (about a minute). Until then the
  picker does not show.

## Adding a park

1. **A park the importer already reads** (an MLB park, or the home park of an
   MiLB club in `teams.json`): run `npm run gen:field-layouts`. A corrected
   Gameday SVG or a new posted sign is picked up on its own. Review the
   `fields.js` diff and the import log; a park whose outline fails its
   audit is logged with its errors.
2. **A wall change with dates** (a renovation): add a dated record to
   `src/lib/ballpark/layout/configurations.js` and close the old one with
   `to`. Cite the change (a club announcement, or Savant's configuration
   flag). Never fill a value a source does not give; leave it `null`.
3. **A park with no usable drawing** (a neutral site, or an MiLB park the
   importer cannot draw): trace the wall by hand, in feet from home plate
   (+x toward right field, +y toward center field, LF pole to RF pole), from
   a licensed diagram or an aerial photo checked for scale (home plate, both
   poles, the visible fence corners). Add it to `WALLS` in
   `src/lib/ballpark/ballparkFields.js` and point a `fence: 'seed'` record at
   it. Its CF must pass the audit in `fenceAudit.js`, and
   `test/ballpark-layouts.test.js` checks it for foul ground and crossings.
   Record the source and the method in the record's `sources` and `note`.
4. Update the tables in this report.

## Who draws what (slice 2)

Every drawing goes through `resolveBallparkLayout` with the venue id and the
date, so the same game draws the same wall on every card:

| Surface | Venue id from | Date from |
| --- | --- | --- |
| Innings hit chart (`HalfInning.jsx`) | `feed.gameData.venue.id` | `feed.gameData.datetime.officialDate` |
| Box score hit chart (`BoxScore.jsx` → `HitChartCard`) | `feed.gameData.venue.id` | `feed.gameData.datetime.officialDate` |
| Ball-flight card (`halfInningFeed.js` puts both on the batted ball) | `feed.gameData.venue.id` | `feed.gameData.datetime.officialDate` |
| Lineup page Ballpark sheet (`TeamInfo.jsx` → `BallparkModal`) | `selectGameInfo(feed).venueId` | `selectGameInfo(feed).officialDate` |
| All-Star page Ballpark sheet | the game card's `venue.id` | the game card's date, else mid-July of the year |
| Team hub Ballpark card | `team.venue.id` | none: today's wall |

The Ballpark sheet's facts and league ranks stay today's park. When the
drawing is an older wall, the sheet's foot says so.

The renderer cuts each outline at the foul lines with segment intersections
(`layout/fenceShape.js`), and the tests check every stored outline for point
order, foul ground and crossings. The stroke weight follows Savant's five
measured heights where the park has them. Only measured or posted heights are
printed. A wall that is not a checked outline carries a one-line accuracy note
in the drawing's corner.
