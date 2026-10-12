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
// WHERE THE OUTLINES COME FROM. Every `fence: 'seed'` outline is WALLS[seedKey]
// in ../ballparkFields.js, digitized from GeomMLBStadiums (pinned in SEED below).
// That dataset is one traced shape per TEAM, captured in 2018, with the Orioles
// retraced in 2023. It carries no dates, so a trace can show a wall the club
// later rebuilt. The rule here: a seed outline describes the CURRENT park only
// when no documented change came after it, and when it passes the CF audit in
// ./fenceAudit.js. Where a documented change came after, the current record has
// `fence: null` (the renderer draws the five posted distances) and the seed
// moves to the dated record of the configuration it shows.
//
// HOW SURE EACH OLD RECORD IS. The `from`/`to` dates come from the cited sources.
// WHICH old configuration a seed shows is an inference from its depth, and each
// such record says so in `note`. Measurements an old record does not know stay
// null; nothing here is filled in to make a record look complete.
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

// One current record per park, venue id from the Stats API teams endpoint
// (2024–2026 seasons). `park` is the ../ballparkData.js key for its posted
// distances, wall heights and facts.
const current = (venueId, park, extra = {}) => ({
  id: park,
  venueId,
  park,
  from: null,
  to: null,
  fence: 'seed',
  seedKey: park,
  sources: [STATSAPI_VENUE.replace('{id}', venueId)],
  ...extra,
})

export const CONFIGURATIONS = [
  current(1, 'angelstadium'),
  current(2, 'orioleparkatcamdenyards', {
    id: 'orioleparkatcamdenyards-2025',
    from: '2025-01-01',
    fence: null,
    sources: [
      'https://www.mlb.com/news/effect-of-camden-yards-new-dimensions-for-2025',
      'https://www.cbssports.com/mlb/news/orioles-to-alter-camden-yards-left-field-dimensions-for-second-time-in-three-years/',
    ],
    note: 'The left-field wall moved in by 9 to 20 ft for 2025. The seed shows the 2022 wall.',
  }),
  {
    id: 'orioleparkatcamdenyards-2022',
    venueId: 2,
    park: null,
    from: '2022-01-01',
    to: '2024-12-31',
    fence: 'seed',
    seedKey: 'orioleparkatcamdenyards',
    dist: { lf: 333, lc: null, cf: 410, rc: null, rf: 318 },
    wall: null,
    sources: ['https://www.mlb.com/orioles/news/orioles-camden-yards-left-field-wall-modifications'],
    note:
      'Inferred: the 2023 Orioles retrace reaches 396 ft at -22.5°, which fits the 2022 ' +
      'wall (deepest point 398 ft), not the 2025 one. Gap distances and wall heights unknown.',
  },
  current(3, 'fenwaypark'),
  current(4, 'ratefield'),
  current(5, 'progressivefield'),
  current(7, 'kauffmanstadium'),
  current(12, 'tropicanafield'),
  {
    id: 'globelifeparkinarlington',
    venueId: 13,
    park: null,
    names: ['Globe Life Park in Arlington', 'Choctaw Stadium'],
    from: null,
    to: '2019-12-31',
    fence: 'seed',
    seedKey: 'globelifeparkinarlington',
    dist: { lf: 332, lc: 390, cf: 400, rc: 407, rf: 325 },
    wall: null,
    sources: [STATSAPI_VENUE.replace('{id}', 13)],
    note:
      'The Rangers seed is the 2018 trace, so it shows this park, not Globe Life Field ' +
      '(opened 2020). Distances are the venue endpoint for venue 13. Wall heights unknown.',
  },
  current(14, 'rogerscentre', {
    id: 'rogerscentre-2023',
    from: '2023-01-01',
    fence: null,
    sources: [
      STATSAPI_VENUE.replace('{id}', 14),
      'https://globalnews.ca/news/10465943/rogers-centre-renovations-changed-how-it-plays/',
    ],
    note:
      'The 2023 renovation moved left-center to 368 ft and right-center to 359 ft and ' +
      'raised most of the wall. The seed shows the earlier wall. Wall heights here are ' +
      'still the old 8 ft placeholders: open item.',
  }),
  {
    id: 'rogerscentre-1989',
    venueId: 14,
    park: null,
    from: null,
    to: '2022-12-31',
    fence: 'seed',
    seedKey: 'rogerscentre',
    dist: { lf: 328, lc: 375, cf: 404, rc: 375, rf: 328 },
    wall: null,
    sources: ['https://globalnews.ca/news/10465943/rogers-centre-renovations-changed-how-it-plays/'],
    note: 'The 2018 trace. Wall heights before 2023 unknown here.',
  },
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
    fence: null,
    sources: [
      STATSAPI_VENUE.replace('{id}', 2392),
      'https://www.mlb.com/news/astros-removing-tal-s-hill-at-minute-maid-park-c205642648',
    ],
    note: "Tal's Hill came out before 2017 and center field moved in from 436 to 409 ft.",
  }),
  {
    id: 'daikinpark-2000',
    venueId: 2392,
    park: null,
    names: ['Minute Maid Park', 'Enron Field', 'Astros Field'],
    from: null,
    to: '2016-12-31',
    fence: 'seed',
    seedKey: 'daikinpark',
    dist: { lf: 315, lc: 362, cf: 436, rc: 373, rf: 326 },
    wall: null,
    sources: ['https://www.mlb.com/news/astros-removing-tal-s-hill-at-minute-maid-park-c205642648'],
    note:
      "Inferred: the seed reaches 433 ft at straightaway, which fits Tal's Hill (436), not " +
      'the 409 posted since 2017. Only CF is sourced for this era; the other distances are ' +
      'the current ones and are an assumption.',
  },
  current(2394, 'comericapark', {
    id: 'comericapark-2023',
    from: '2023-01-01',
    fence: null,
    sources: [
      'https://ballparkdigest.com/2023/01/11/tigers-announce-new-comerica-park-outfield-dimensions/',
    ],
    note:
      'Center field moved in from 422 (measured) to 412 ft for 2023, and the LF corner was ' +
      're-measured as 342 ft. The Stats API venue endpoint still lists 345 and 420.',
  }),
  {
    id: 'comericapark-2000',
    venueId: 2394,
    park: null,
    from: null,
    to: '2022-12-31',
    fence: 'seed',
    seedKey: 'comericapark',
    dist: { lf: 345, lc: 370, cf: 420, rc: 365, rf: 330 },
    wall: null,
    sources: [
      'https://ballparkdigest.com/2023/01/11/tigers-announce-new-comerica-park-outfield-dimensions/',
    ],
    note: 'The 2018 trace. Posted CF was 420; the wall measured 422.',
  },
  current(2395, 'oraclepark'),
  current(2529, 'sutterhealthpark', {
    fence: null,
    note:
      'No traced outline. LF, CF and RF are posted. The gaps are the venue endpoint ' +
      'figures (380 ft) and wall heights are estimates.',
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
    id: 'loandepotpark-2016',
    from: '2016-01-01',
    fence: null,
    sources: [
      STATSAPI_VENUE.replace('{id}', 4169),
      'https://www.mlb.com/marlins/news/marlins-think-ballpark-new-dimensions-will-help',
    ],
    note:
      'The fences moved in for 2016 and again for 2020. Open item: 2020 reports give CF ' +
      '400 ft, while the venue endpoint still lists 407 (the 2016 figure).',
  }),
  {
    id: 'loandepotpark-2012',
    venueId: 4169,
    park: null,
    names: ['Marlins Park'],
    from: null,
    to: '2015-12-31',
    fence: 'seed',
    seedKey: 'loandepotpark',
    dist: { lf: null, lc: null, cf: 418, rc: null, rf: null },
    wall: null,
    sources: ['https://mlb.com/news/marlins-park-renovation-should-benefit-hitters-c162859126'],
    note:
      'Inferred: the seed reaches 420 ft at straightaway, which fits the 2012 wall (418), ' +
      'not the later ones.',
  },
  current(4705, 'truistpark'),
  current(5325, 'globelifefield', {
    from: '2020-01-01',
    fence: null,
    note: 'Opened 2020. No traced outline yet; the Rangers seed shows the old park.',
  }),
]
