# Ballpark layouts: coverage report

This report lists each playing-field configuration the app knows, where its
fence outline comes from, who draws it, and what is still missing. Issue #1859,
slices 1 and 2.

Code: `src/lib/ballpark/layout/`. The registry is `configurations.js`. The
choice of outline is `fences.js`. The resolver is `resolveLayout.js`
(`resolveBallparkLayout({ venueId, venueName, gameDate })`). The imported store
is `fields.json`, written by `npm run gen:field-layouts`
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
- **MiLB.** Gameday SVGs exist for MiLB parks (Toledo, Lehigh Valley and Iowa
  checked), but in an older style with no named layers. Extracting them is
  slice 3. An MiLB venue resolves to `null`, and the caller shows "not on file".
- **Gap bearings of the five-point fallback.** A park with no outline draws
  its posted gap signs at ±22.5°. No source gives the bearing of a posted gap
  sign, so the accuracy note says the wall is drawn straight between them.

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
