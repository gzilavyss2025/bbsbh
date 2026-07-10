// Static ballpark reference data — outfield dimensions, wall heights, and the
// facts that drive the Ballpark modal (the to-scale field drawing + the
// "how does this park rank in the league" dimension list).
//
// SELF-CONTAINED ON PURPOSE. This is static reference data baked into the repo,
// like the CF-bearing table in ./ballparks.js — the modal makes NO network call
// and depends on no third-party site at runtime. Every value here is a public
// fact:
//   - Outfield distances (lf/lc/cf/rc/rf, feet) come straight from the MLB Stats
//     API venue endpoint (/api/v1/venues/{id}?hydrate=fieldInfo) — the same host
//     the whole app already uses — snapshotted here so the modal needs no fetch.
//   - Wall heights (lf/cf/rf, feet) are NOT in statsapi; they're public
//     measurements (the 37' Green Monster, PNC's 21' Clemente Wall, etc.).
//   - built / roof / capacity round out the facts strip.
//
// Covers the 30 current MLB parks (the Athletics' temporary Sutter Health Park is
// the one gap — small Triple-A footprint, distances not yet snapshotted; it
// degrades gracefully to "not on file" via ballparkFor() returning null, per the
// app's MiLB-degradation convention). MiLB venues are intentionally absent.
//
// Keyed by the SAME normalized venue name as ./ballparks.js (lowercase, accents
// and non-alphanumerics stripped), which the live game feed always provides — so
// a park with more than one recent name would carry a key per name, exactly like
// the bearing table. To add/refresh a park: re-pull fieldInfo from statsapi for
// the distances and drop the verified wall heights in alongside.

// Normalize a venue name to a stable lookup key (mirrors ballparks.js).
// "Oriole Park at Camden Yards" → "orioleparkatcamdenyards".
function normalizeVenue(name) {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// dist: outfield distances in feet (lf line, lf-center gap, straightaway center,
//   rf-center gap, rf line). wall: wall heights in feet (lf, cf, rf).
export const BALLPARKS = {
  americanfamilyfield: { name: 'American Family Field', dist: { lf: 344, lc: 371, cf: 400, rc: 374, rf: 345 }, wall: { lf: 8, cf: 8, rf: 8 }, built: 2001, roof: 'Retractable', capacity: 41700 },
  angelstadium: { name: 'Angel Stadium', dist: { lf: 330, lc: 389, cf: 396, rc: 365, rf: 330 }, wall: { lf: 5, cf: 8, rf: 8 }, built: 1966, roof: 'Open', capacity: 45517 },
  buschstadium: { name: 'Busch Stadium', dist: { lf: 336, lc: 375, cf: 400, rc: 375, rf: 335 }, wall: { lf: 8, cf: 8, rf: 8 }, built: 2006, roof: 'Open', capacity: 44494 },
  chasefield: { name: 'Chase Field', dist: { lf: 328, lc: 412, cf: 407, rc: 414, rf: 335 }, wall: { lf: 8, cf: 25, rf: 8 }, built: 1998, roof: 'Retractable', capacity: 48359 },
  citifield: { name: 'Citi Field', dist: { lf: 335, lc: 370, cf: 408, rc: 380, rf: 330 }, wall: { lf: 8, cf: 8, rf: 8 }, built: 2009, roof: 'Open', capacity: 42136 },
  citizensbankpark: { name: 'Citizens Bank Park', dist: { lf: 329, lc: 381, cf: 401, rc: 398, rf: 330 }, wall: { lf: 6, cf: 6, rf: 13 }, built: 2004, roof: 'Open', capacity: 42901 },
  comericapark: { name: 'Comerica Park', dist: { lf: 345, lc: 370, cf: 420, rc: 365, rf: 330 }, wall: { lf: 7, cf: 9, rf: 9 }, built: 2000, roof: 'Open', capacity: 41083 },
  coorsfield: { name: 'Coors Field', dist: { lf: 347, lc: 420, cf: 415, rc: 424, rf: 350 }, wall: { lf: 8, cf: 8, rf: 17 }, built: 1995, roof: 'Open', capacity: 50144 },
  daikinpark: { name: 'Daikin Park', dist: { lf: 315, lc: 362, cf: 409, rc: 373, rf: 326 }, wall: { lf: 21, cf: 9, rf: 7 }, built: 2000, roof: 'Retractable', capacity: 41000 },
  fenwaypark: { name: 'Fenway Park', dist: { lf: 310, lc: 390, cf: 420, rc: 380, rf: 302 }, wall: { lf: 37, cf: 17, rf: 5 }, built: 1912, roof: 'Open', capacity: 37755 },
  globelifefield: { name: 'Globe Life Field', dist: { lf: 329, lc: 372, cf: 407, rc: 374, rf: 326 }, wall: { lf: 8, cf: 8, rf: 8 }, built: 2020, roof: 'Retractable', capacity: 40000 },
  greatamericanballpark: { name: 'Great American Ball Park', dist: { lf: 328, lc: 379, cf: 404, rc: 370, rf: 325 }, wall: { lf: 12, cf: 8, rf: 8 }, built: 2003, roof: 'Open', capacity: 43891 },
  kauffmanstadium: { name: 'Kauffman Stadium', dist: { lf: 347, lc: 379, cf: 410, rc: 379, rf: 344 }, wall: { lf: 9, cf: 9, rf: 9 }, built: 1973, roof: 'Open', capacity: 38427 },
  loandepotpark: { name: 'loanDepot park', dist: { lf: 344, lc: 386, cf: 407, rc: 392, rf: 335 }, wall: { lf: 12, cf: 9, rf: 12 }, built: 2012, roof: 'Retractable', capacity: 37446 },
  nationalspark: { name: 'Nationals Park', dist: { lf: 336, lc: 377, cf: 402, rc: 370, rf: 335 }, wall: { lf: 8, cf: 8, rf: 14 }, built: 2008, roof: 'Open', capacity: 41376 },
  oraclepark: { name: 'Oracle Park', dist: { lf: 339, lc: 399, cf: 391, rc: 415, rf: 309 }, wall: { lf: 8, cf: 8, rf: 25 }, built: 2000, roof: 'Open', capacity: 41915 },
  orioleparkatcamdenyards: { name: 'Oriole Park at Camden Yards', dist: { lf: 333, lc: 376, cf: 410, rc: 373, rf: 318 }, wall: { lf: 8, cf: 7, rf: 21 }, built: 1992, roof: 'Open', capacity: 44970 },
  petcopark: { name: 'Petco Park', dist: { lf: 336, lc: 386, cf: 396, rc: 391, rf: 322 }, wall: { lf: 4, cf: 7, rf: 10 }, built: 2004, roof: 'Open', capacity: 40222 },
  pncpark: { name: 'PNC Park', dist: { lf: 325, lc: 410, cf: 399, rc: 375, rf: 320 }, wall: { lf: 6, cf: 10, rf: 21 }, built: 2001, roof: 'Open', capacity: 38753 },
  progressivefield: { name: 'Progressive Field', dist: { lf: 325, lc: 410, cf: 405, rc: 375, rf: 325 }, wall: { lf: 19, cf: 9, rf: 9 }, built: 1994, roof: 'Open', capacity: 34788 },
  ratefield: { name: 'Rate Field', dist: { lf: 330, lc: 377, cf: 400, rc: 372, rf: 335 }, wall: { lf: 8, cf: 8, rf: 8 }, built: 1991, roof: 'Open', capacity: 40241 },
  rogerscentre: { name: 'Rogers Centre', dist: { lf: 328, lc: 375, cf: 404, rc: 375, rf: 328 }, wall: { lf: 8, cf: 8, rf: 8 }, built: 1989, roof: 'Retractable', capacity: 49282 },
  targetfield: { name: 'Target Field', dist: { lf: 339, lc: 377, cf: 404, rc: 367, rf: 328 }, wall: { lf: 8, cf: 8, rf: 23 }, built: 2010, roof: 'Open', capacity: 38544 },
  tmobilepark: { name: 'T-Mobile Park', dist: { lf: 331, lc: 390, cf: 405, rc: 387, rf: 327 }, wall: { lf: 8, cf: 8, rf: 8 }, built: 1999, roof: 'Retractable', capacity: 47929 },
  tropicanafield: { name: 'Tropicana Field', dist: { lf: 315, lc: 410, cf: 404, rc: 404, rf: 322 }, wall: { lf: 9, cf: 9, rf: 9 }, built: 1990, roof: 'Dome', capacity: 25025 },
  truistpark: { name: 'Truist Park', dist: { lf: 335, lc: 385, cf: 400, rc: 375, rf: 325 }, wall: { lf: 6, cf: 9, rf: 16 }, built: 2017, roof: 'Open', capacity: 41149 },
  uniqlofieldatdodgerstadium: { name: 'Dodger Stadium', dist: { lf: 330, lc: 385, cf: 395, rc: 385, rf: 330 }, wall: { lf: 8, cf: 8, rf: 8 }, built: 1962, roof: 'Open', capacity: 56000 },
  wrigleyfield: { name: 'Wrigley Field', dist: { lf: 355, lc: 368, cf: 400, rc: 368, rf: 353 }, wall: { lf: 11, cf: 11, rf: 11 }, built: 1914, roof: 'Open', capacity: 41363 },
  yankeestadium: { name: 'Yankee Stadium', dist: { lf: 318, lc: 399, cf: 408, rc: 385, rf: 314 }, wall: { lf: 8, cf: 8, rf: 8 }, built: 2009, roof: 'Open', capacity: 47309 },
}

// Dimension descriptors, in the order they read on the field (LF line → RF line,
// then the three wall heights). `group` splits the two ranked families so the
// modal can render distances and wall heights as separate lists.
export const DIMENSIONS = [
  { key: 'lf', group: 'dist', label: 'Left field' },
  { key: 'lc', group: 'dist', label: 'Left-center' },
  { key: 'cf', group: 'dist', label: 'Center field' },
  { key: 'rc', group: 'dist', label: 'Right-center' },
  { key: 'rf', group: 'dist', label: 'Right field' },
  { key: 'lf', group: 'wall', label: 'LF wall' },
  { key: 'cf', group: 'wall', label: 'CF wall' },
  { key: 'rf', group: 'wall', label: 'RF wall' },
]

// The park record for a venue name, or null if we don't have it (MiLB park, the
// A's temporary home, a newly renamed venue) — callers render "not on file".
export function ballparkFor(venueName) {
  const key = normalizeVenue(venueName)
  return key in BALLPARKS ? BALLPARKS[key] : null
}

// Standard competition ("1224") rank of `value` within `values`, ranking LARGEST
// first (rank 1 = deepest fence / tallest wall). Ties share a rank. Returns the
// 1-based rank; `total` is values.length. So a park tied for the deepest center
// field is "1st"; the shallowest is "Nth of N".
function rankDescending(value, values) {
  const higher = values.reduce((n, v) => (v > value ? n + 1 : n), 0)
  return higher + 1
}

// English ordinal for a positive integer: 1 → "1st", 22 → "22nd".
export function ordinal(n) {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

// Rank every dimension of a park against the whole league (the 30 MLB parks in
// BALLPARKS). Returns the park record plus a `rows` array — one entry per
// DIMENSIONS descriptor — carrying the park's value and its league rank
// (rank 1 = biggest, total = number of parks that have that dimension). Pure and
// spoiler-free: park geometry carries no score, so this runs at render with no
// gating. Returns null when the venue isn't on file.
export function rankedDimensions(venueName) {
  const park = ballparkFor(venueName)
  if (!park) return null
  const all = Object.values(BALLPARKS)
  const rows = DIMENSIONS.map(({ key, group, label }) => {
    const value = park[group][key]
    const values = all.map((p) => p[group][key])
    const rank = rankDescending(value, values)
    return { key, group, label, value, unit: 'ft', rank, total: values.length }
  })
  return { ...park, rows }
}
