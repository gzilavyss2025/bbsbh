// The ballpark layout registry: which playing-field configuration each venue had
// on which dates, and where its fence outline came from (#1859).
//
// WHY A CONFIGURATION, NOT A NAME. A park's name changes with its sponsor and its
// wall changes with a renovation, and those are independent. So a layout is keyed
// by the Stats API venue id plus a date range. A sponsor rename keeps the same
// record (the names live as aliases in ../ballparkData.js). A rebuilt wall gets
// a new record. A club that moves gets the new venue's records, never the old
// park's shape because it is the same team.
//
// WHERE THE OUTLINES COME FROM. Two sources, by `fence`:
//   - 'gameday': the CURRENT record of every park. The outline is extracted from
//     MLB's Gameday field SVG and stored in ./fields.js only when it passes an
//     audit against the same season's Baseball Savant measurements (CF, the
//     deepest point, both poles, both gaps, the fair area). A park whose SVG
//     fails, or has none, draws its five posted distances instead.
//     scripts/ballpark/import-field-layouts.mjs writes that file.
//   - 'seed': an OLDER configuration, drawn from WALLS[seedKey] in
//     ../ballparkFields.js (GeomMLBStadiums, pinned in SEED below). That dataset
//     is one traced shape per team from 2018 (the Orioles retraced in 2023), so
//     each trace stands for the configuration it shows, on that configuration's
//     dates. It is audited against the posted CF (./fenceAudit.js).
//
// WHERE THE DATES COME FROM. Savant's Dimensions table flags a season whose
// configuration changed (`is_diff_configuration`, 2016 on), and its measured
// distances show what moved. Every dated record below agrees with those flags;
// the news sources say why. Which older wall a 2018 trace shows is an inference
// from its depth, and each such record says so in `note`. Measurements an old
// record does not know stay null; nothing is filled in to look complete.
//
// Every dated record covers whole seasons: `from` is Jan 1, `to` is Dec 31.
// `null` means open-ended (since the park opened, or still current).

export const SEED = {
  source: 'bdilday/GeomMLBStadiums',
  url: 'https://github.com/bdilday/GeomMLBStadiums',
  file: 'inst/extdata/mlb_stadia_paths.csv',
  // The commit the CSV was checked against for this audit (2026-10-12). The
  // CSV itself last changed at 9ef81a6 (2023-09-21, the Orioles retrace and the
  // Indians → Guardians rename); every other team is the 2018 trace.
  revision: '90b4356e0694aa8fc2452e9cd61aa8173f9785d0',
  segment: 'outfield_outer',
  license: 'MIT (Copyright 2018 Ben Dilday)',
  transform: 'x = 2.4957 × (hc_x − 125), y = 2.4957 × (199 − hc_y), Douglas-Peucker to ~1.6 ft',
}

const STATSAPI_VENUE = 'https://statsapi.mlb.com/api/v1/venues/{id}?hydrate=fieldInfo'
const SAVANT_DIMENSIONS = 'https://baseballsavant.mlb.com/leaderboard/statcast-park-factors?type=dimensions'

// One current record per park, venue id from the Stats API teams endpoint
// (2024–2026 seasons). `park` is the ../ballparkData.js key for its posted
// distances and facts.
const current = (venueId, park, extra = {}) => ({
  id: park,
  venueId,
  park,
  from: null,
  to: null,
  fence: 'gameday',
  sources: [STATSAPI_VENUE.replace('{id}', venueId), SAVANT_DIMENSIONS],
  ...extra,
})

// An older configuration drawn from a 2018 trace.
const prior = (venueId, id, seedKey, extra) => ({
  id,
  venueId,
  park: null,
  from: null,
  to: null,
  fence: 'seed',
  seedKey,
  wall: null,
  ...extra,
})

export const CONFIGURATIONS = [
  current(1, 'angelstadium'),
  current(2, 'orioleparkatcamdenyards', {
    id: 'orioleparkatcamdenyards-2025',
    from: '2025-01-01',
    sources: [
      SAVANT_DIMENSIONS,
      'https://www.mlb.com/news/effect-of-camden-yards-new-dimensions-for-2025',
    ],
    note: 'The left-field wall moved in by 9 to 20 ft for 2025 (Savant flags 2025).',
  }),
  prior(2, 'orioleparkatcamdenyards-2022', 'orioleparkatcamdenyards', {
    from: '2022-01-01',
    to: '2024-12-31',
    dist: { lf: 333, lc: null, cf: 410, rc: null, rf: 318 },
    sources: [SAVANT_DIMENSIONS, 'https://www.mlb.com/orioles/news/orioles-camden-yards-left-field-wall-modifications'],
    note:
      'Inferred: the 2023 Orioles retrace reaches 396 ft at -22.5°, which fits the 2022 ' +
      'wall (deepest point 398 ft). Savant flags 2022 and 2025. Gaps and heights unknown.',
  }),
  current(3, 'fenwaypark'),
  current(4, 'ratefield'),
  current(5, 'progressivefield'),
  current(7, 'kauffmanstadium', {
    id: 'kauffmanstadium-2026',
    from: '2026-01-01',
    sources: [STATSAPI_VENUE.replace('{id}', 7), SAVANT_DIMENSIONS],
    note:
      'Savant flags 2026: its measured lines are 324 ft and the fair area is 3% smaller. ' +
      'The Gameday SVG still shows the earlier wall, so this record draws posted distances. ' +
      'Open item: the Stats API still posts 347 / 344 ft lines.',
  }),
  prior(7, 'kauffmanstadium-1973', 'kauffmanstadium', {
    to: '2025-12-31',
    dist: { lf: null, lc: null, cf: 410, rc: null, rf: null },
    sources: [SAVANT_DIMENSIONS],
    note:
      'The 2018 trace. Savant shows no configuration change from 2016 through 2025 and ' +
      'measures CF 410 for those seasons. Other distances and heights unknown here.',
  }),
  current(12, 'tropicanafield'),
  prior(13, 'globelifeparkinarlington', 'globelifeparkinarlington', {
    names: ['Globe Life Park in Arlington', 'Choctaw Stadium'],
    to: '2019-12-31',
    dist: { lf: 332, lc: 390, cf: 400, rc: 407, rf: 325 },
    sources: [STATSAPI_VENUE.replace('{id}', 13)],
    note:
      'The Rangers 2018 trace shows this park, not Globe Life Field (opened 2020). ' +
      'Distances are the venue endpoint for venue 13. Wall heights unknown.',
  }),
  current(14, 'rogerscentre', {
    id: 'rogerscentre-2023',
    from: '2023-01-01',
    sources: [
      STATSAPI_VENUE.replace('{id}', 14),
      SAVANT_DIMENSIONS,
      'https://globalnews.ca/news/10465943/rogers-centre-renovations-changed-how-it-plays/',
    ],
    note:
      'The 2023 renovation moved left-center to 368 ft and right-center to 359 ft (Savant ' +
      'flags 2023). The Gameday SVG fails the audit at right-center and on area, so this ' +
      'record draws posted distances.',
  }),
  prior(14, 'rogerscentre-1989', 'rogerscentre', {
    to: '2022-12-31',
    dist: { lf: 328, lc: 375, cf: 404, rc: 375, rf: 328 },
    sources: [SAVANT_DIMENSIONS],
    note: 'The 2018 trace. Wall heights before 2023 unknown here.',
  }),
  current(15, 'chasefield'),
  current(17, 'wrigleyfield'),
  current(19, 'coorsfield'),
  current(22, 'uniqlofieldatdodgerstadium'),
  current(31, 'pncpark'),
  current(32, 'americanfamilyfield'),
  current(680, 'tmobilepark'),
  current(2392, 'daikinpark', {
    id: 'daikinpark-2017',
    from: '2017-01-01',
    sources: [
      SAVANT_DIMENSIONS,
      'https://www.mlb.com/news/astros-removing-tal-s-hill-at-minute-maid-park-c205642648',
    ],
    note: "Tal's Hill came out before 2017 and center field moved in from 436 to 409 ft (Savant flags 2017).",
  }),
  prior(2392, 'daikinpark-2000', 'daikinpark', {
    names: ['Minute Maid Park', 'Enron Field', 'Astros Field'],
    to: '2016-12-31',
    dist: { lf: 315, lc: 362, cf: 436, rc: 373, rf: 326 },
    sources: [SAVANT_DIMENSIONS],
    note:
      "Inferred: the trace reaches 433 ft at straightaway, which fits Tal's Hill (Savant " +
      'measures 434 for 2016). Only CF is sourced for this era; the other distances are ' +
      'the current ones and are an assumption.',
  }),
  current(2394, 'comericapark', {
    id: 'comericapark-2023',
    from: '2023-01-01',
    sources: [
      SAVANT_DIMENSIONS,
      'https://ballparkdigest.com/2023/01/11/tigers-announce-new-comerica-park-outfield-dimensions/',
    ],
    note:
      'Center field moved in from 422 (measured) to 412 ft for 2023 (Savant flags 2023), and ' +
      'the LF corner was re-measured as 342 ft. The Gameday SVG still shows the 422-ft wall, ' +
      'so this record draws posted distances. The Stats API still posts 345 and 420.',
  }),
  prior(2394, 'comericapark-2000', 'comericapark', {
    to: '2022-12-31',
    dist: { lf: 345, lc: 370, cf: 420, rc: 365, rf: 330 },
    sources: ['https://ballparkdigest.com/2023/01/11/tigers-announce-new-comerica-park-outfield-dimensions/'],
    note: 'The 2018 trace. Posted CF was 420; the wall measured 422.',
  }),
  current(2395, 'oraclepark'),
  current(2529, 'sutterhealthpark', {
    note: 'No usable Gameday SVG (it is a sheet of many Triple-A parks), so this record draws posted distances.',
  }),
  current(2602, 'greatamericanballpark'),
  current(2680, 'petcopark'),
  current(2681, 'citizensbankpark'),
  current(2889, 'buschstadium'),
  current(3289, 'citifield'),
  current(3309, 'nationalspark'),
  current(3312, 'targetfield'),
  current(3313, 'yankeestadium'),
  current(4169, 'loandepotpark', {
    id: 'loandepotpark-2020',
    from: '2020-01-01',
    sources: [SAVANT_DIMENSIONS, 'https://www.mlb.com/marlins/news/marlins-think-ballpark-new-dimensions-will-help'],
    note:
      'The fences moved in again for 2020 (Savant flags 2020; it measures CF 396). Open ' +
      'item: the Stats API still posts CF 407, the 2016 figure.',
  }),
  {
    id: 'loandepotpark-2016',
    venueId: 4169,
    park: null,
    names: ['Marlins Park'],
    from: '2016-01-01',
    to: '2019-12-31',
    fence: null,
    dist: { lf: 344, lc: 386, cf: 407, rc: 392, rf: 335 },
    wall: null,
    sources: [SAVANT_DIMENSIONS, 'https://mlb.com/news/marlins-park-renovation-should-benefit-hitters-c162859126'],
    note: 'Savant flags 2016 and 2020. No outline for this configuration; posted distances only.',
  },
  prior(4169, 'loandepotpark-2012', 'loandepotpark', {
    names: ['Marlins Park'],
    to: '2015-12-31',
    dist: { lf: null, lc: null, cf: 418, rc: null, rf: null },
    sources: ['https://mlb.com/news/marlins-park-renovation-should-benefit-hitters-c162859126'],
    note:
      'Inferred: the trace reaches 420 ft at straightaway, which fits the 2012 wall (418), ' +
      'not the later ones.',
  }),
  current(4705, 'truistpark'),
  current(5325, 'globelifefield', {
    from: '2020-01-01',
    note: 'Opened 2020.',
  }),
]
