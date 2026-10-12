# Ballpark layouts: coverage report

This report lists each playing-field configuration the app knows, where its
fence outline comes from, and what is still missing. Issue #1859, slice 1.

Code: `src/lib/ballpark/layout/`. The registry is `configurations.js`. The CF
audit is `fenceAudit.js`. The resolver is `resolveLayout.js`
(`resolveBallparkLayout({ venueId, venueName, gameDate })`). The tests are
`test/ballpark-layouts.test.js`. Audit date: 2026-10-12.

## Quality levels

| Fence quality | Meaning |
| --- | --- |
| `audited` | A traced outline. The fence distance at the CF sign is within 10 ft of the posted CF. |
| `estimated` | A traced outline that misses the posted CF by more than 10 ft. It is drawn, but it is not a measurement. |
| `dimensions-only` | No usable outline. The renderer draws straight runs through the five posted distances. |
| `missing` | Not even five posted distances. |

The audit checks only the CF sign. The renderer pins the two pole ends to the
posted pole distances, so the poles need no check. The gap signs stand where
each club put them, not at a fixed angle, so a fixed-angle check proves nothing.
The CF sign is read at straightaway, or at the deepest point within 20° of
center when that is closer to the posted number. Fenway's 420 is the second
kind: the triangle, about 10° right of center.

No outline is `verified` by a person yet. That level is for a future trace that
someone checks against a diagram or an aerial photo.

## Source

All traced outlines come from [GeomMLBStadiums](https://github.com/bdilday/GeomMLBStadiums)
(MIT, Copyright 2018 Ben Dilday), segment `outfield_outer`, checked at commit
`90b4356e`. The CSV is one trace per team. Most traces date from 2018. The
Orioles trace dates from 2023. The data carries no configuration dates.

Posted distances come from the Stats API venue endpoint
(`/api/v1/venues/{id}?hydrate=fieldInfo`), except where a row below says so.

## Current configurations

| Venue id | Park | Fence | CF error (ft) |
| --- | --- | --- | --- |
| 1 | Angel Stadium | audited | +9.7 |
| 2 | Oriole Park at Camden Yards (2025–) | dimensions-only | — |
| 3 | Fenway Park | audited (CF sign at the triangle) | −2.7 |
| 4 | Rate Field | audited | +6.3 |
| 5 | Progressive Field | audited | +0.8 |
| 7 | Kauffman Stadium | audited | +5.5 |
| 12 | Tropicana Field | audited | +8.2 |
| 14 | Rogers Centre (2023–) | dimensions-only | — |
| 15 | Chase Field | audited | +0.3 |
| 17 | Wrigley Field | audited | −0.2 |
| 19 | Coors Field | audited | +0.6 |
| 22 | UNIQLO Field at Dodger Stadium | audited | +3.4 |
| 31 | PNC Park | audited | +1.5 |
| 32 | American Family Field | audited | +1.1 |
| 680 | T-Mobile Park | audited | −2.1 |
| 2392 | Daikin Park (2017–) | dimensions-only | — |
| 2394 | Comerica Park (2023–) | dimensions-only | — |
| 2395 | Oracle Park | **estimated** | +11.7 |
| 2529 | Sutter Health Park | dimensions-only | — |
| 2602 | Great American Ball Park | audited | +4.9 |
| 2680 | Petco Park | audited | +1.2 |
| 2681 | Citizens Bank Park | audited | +7.2 |
| 2889 | Busch Stadium | audited | +2.0 |
| 3289 | Citi Field | audited | +8.5 |
| 3309 | Nationals Park | audited | +3.0 |
| 3312 | Target Field | audited | +1.2 |
| 3313 | Yankee Stadium | **estimated** | +17.8 |
| 4169 | loanDepot park (2016–) | dimensions-only | — |
| 4705 | Truist Park | audited | +3.9 |
| 5325 | Globe Life Field (2020–) | dimensions-only | — |

## Earlier configurations

These records hold a trace that shows an earlier wall. The dates come from the
cited sources. Which configuration a trace shows is an inference from its depth.
Each record's `note` says so.

| Configuration | Dates | Why the trace belongs here |
| --- | --- | --- |
| Globe Life Park in Arlington (venue 13) | to 2019 | The 2018 Rangers trace predates Globe Life Field (opened 2020). CF error +5.8. |
| Rogers Centre | to 2022 | The 2023 renovation moved both alleys in ([Global News](https://globalnews.ca/news/10465943/rogers-centre-renovations-changed-how-it-plays/)). |
| Comerica Park | to 2022 | CF moved in from 422 to 412 ft for 2023 ([Ballpark Digest](https://ballparkdigest.com/2023/01/11/tigers-announce-new-comerica-park-outfield-dimensions/)). |
| Minute Maid Park | to 2016 | The trace reaches 433 ft at straightaway: Tal's Hill (436 ft), removed before 2017. |
| Marlins Park | to 2015 | The trace reaches 420 ft: the 2012 wall (418 ft). The fences moved in for 2016 and 2020. |
| Camden Yards | 2022–2024 | The 2023 retrace fits the 2022 "Walltimore" wall. The wall moved in again for 2025. |

## Corrections in this change

- Globe Life Field, Daikin Park, Comerica Park, Rogers Centre, Camden Yards and
  loanDepot park no longer draw a trace of an older wall.
- Comerica Park: CF 412 (was 420), LF 342 (was 345, a re-measure, not a move),
  CF wall 7 ft.
- Rogers Centre: left-center 368 (was 375), right-center 359 (was 375).
- Sutter Health Park: both gaps 380, the venue endpoint figure (was an
  estimated 372).
- The CF distance label now sits at the CF sign, not at the fence's deepest
  vertex.

## Open items

- **Yankee Stadium and Oracle Park** traces have the right shape at a scale
  about 3–5% too large: the poles and CF all run long by the same ratio. A
  retrace or a per-park scale fit can fix them. No documented wall change
  explains the miss.
- **loanDepot park:** 2020 reports give CF 400 ft. The venue endpoint still
  lists 407, the 2016 figure. Confirm before changing.
- **Rogers Centre wall heights** are the old 8 ft placeholders. The 2023 walls
  are taller (11 ft 2 in at left-center, 14 ft 4 in at right-center).
- **New traces needed:** Globe Life Field, Daikin Park, Comerica Park, Rogers
  Centre, Camden Yards (2025), loanDepot park, Sutter Health Park.
- **No MiLB coverage** besides Sutter Health Park. An MiLB venue resolves to
  `null`, and the caller shows "not on file".
- **Callers still resolve by name, for the current configuration.** Passing the
  venue id and game date from the live feed into the hit chart, the ball-flight
  card and the box score is slice 2.
- **Wall heights** are three values per park, interpolated between them. Per
  segment heights are slice 2.
