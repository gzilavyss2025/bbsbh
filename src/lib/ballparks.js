// Ballpark orientation + wind-geometry helpers for the scorebook weather string.
//
// The MLB Stats API gives us a park's coordinates and roof type, but NOT its
// compass orientation — and orientation is what turns a raw wind bearing into a
// scorekeeper's "out to CF" / "in from LF". There is no field to read, so this
// is the one piece of static data the weather generator needs.
//
// A wrong direction gets copied onto paper as fact, so every bearing below comes
// from published orientation data, not guesswork, and anything not listed (MiLB
// parks, a newly renamed venue) degrades gracefully to a plain compass bearing
// (see weather.js) rather than a fabricated field-relative call. All 30 current
// MLB parks are covered; extend PARK_CF_BEARING_BY_NAME with a verified
// home-plate→center-field bearing (degrees clockwise from true north) to add one.

// Normalize a venue name to a stable lookup key: lowercase, strip accents and
// any non-alphanumerics. So "Oriole Park at Camden Yards" → "orioleparkatcamdenyards".
function normalizeVenue(name) {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Home-plate→center-field bearing (degrees, clockwise from true north = the
// direction the batter faces, which is exactly "which way center field points").
// Covers all 30 current MLB parks. Values are compiled from published
// orientation data — most numerically from The Shadium's per-park shade guides
// (which state "center field points toward N°"), the rest converted from the
// documented compass orientation (baseball-almanac / Hardball Times / Clem's
// Baseball / shade guides). The wind classifier buckets at 45°, so these are
// plenty precise; treat them as approximate to a compass point, not survey-grade.
//
// Keyed by normalized venue name (see normalizeVenue), which the live feed always
// provides. Parks with more than one recent name carry a key for each. A fixed
// dome (Tropicana Field) is intentionally absent: its roof never opens, so the
// generator reports "Roof closed" and never prints a wind direction — no bearing
// needed. Any park not listed still degrades gracefully to a plain compass wind.
//
// Tag key: [N] value stated in degrees by the source; [C] converted from a
// documented compass direction; [~] best-effort where sources conflicted;
// [roof] retractable/openable (bearing applies when the roof is open).
const PARK_CF_BEARING_BY_NAME = {
  angelstadium: 65, // ENE [N]
  americanfamilyfield: 337, // NNW [C, roof]
  buschstadium: 80, // ENE–E [C]
  chasefield: 0, // N [C, roof]
  citifield: 22, // NNE [C]
  citizensbankpark: 0, // N [C]
  comericapark: 150, // SSE — MLB's most southward park [C, ~]
  coorsfield: 40, // NNE [N]
  daikinpark: 20, // NNE [N, roof] — formerly Minute Maid Park
  minutemaidpark: 20, // NNE [N, roof] — legacy name for Daikin Park
  dodgerstadium: 22, // NNE [C]
  fenwaypark: 45, // NE [C]
  globelifefield: 67, // ENE [C, roof]
  greatamericanballpark: 135, // SE, toward the Ohio River [C]
  guaranteedratefield: 120, // ESE [N] — legacy name for Rate Field
  ratefield: 120, // ESE [N]
  kauffmanstadium: 45, // NE [C]
  loandepotpark: 135, // SE [C, ~, roof]
  nationalspark: 87, // E [N]
  oraclepark: 87, // E [N]
  orioleparkatcamdenyards: 45, // NE [C]
  petcopark: 0, // N — batter faces due north [C]
  pncpark: 25, // NNE [N]
  progressivefield: 60, // NE [N]
  rogerscentre: 15, // NNE [N, roof]
  sutterhealthpark: 330, // NNW [N] — Athletics' Sacramento home
  targetfield: 90, // E [C]
  tmobilepark: 318, // NNW [N, roof]
  truistpark: 45, // NE [N]
  wrigleyfield: 45, // NE [C]
  yankeestadium: 67, // ENE — the most Rule-1.04-compliant park [C]
}

// The park's CF bearing if we have a verified value, else null (→ compass
// fallback). Accepts the raw venue name off the feed.
export function parkCfBearing(venueName) {
  const key = normalizeVenue(venueName)
  return key in PARK_CF_BEARING_BY_NAME ? PARK_CF_BEARING_BY_NAME[key] : null
}

// Eight scorekeeper wind phrases, indexed by 45° sectors of the wind's *travel*
// bearing measured relative to the CF bearing. Index i corresponds to a relative
// bearing of i×45°:
//   0   out to CF     — blowing straight to center (carries the ball)
//   45  out to RF
//   90  L to R        — pure crosswind, third-base side to first-base side
//   135 in from LF    — coming off left field toward the plate
//   180 in from CF    — straight in (knocks the ball down)
//   225 in from RF
//   270 R to L
//   315 out to LF
const FIELD_RELATIVE = [
  'out to CF',
  'out to RF',
  'L to R',
  'in from LF',
  'in from CF',
  'in from RF',
  'R to L',
  'out to LF',
]

// Turn a meteorological wind bearing (the direction the wind blows *from*, the
// Open-Meteo convention) into a field-relative phrase, given the park's CF
// bearing. Wind that blows *from* fromDeg travels toward fromDeg+180; we bucket
// that travel bearing into eighths around the CF axis.
export function windRelativeToField(fromDeg, cfBearing) {
  const travel = (fromDeg + 180) % 360
  const rel = ((travel - cfBearing) % 360 + 360) % 360
  return FIELD_RELATIVE[Math.round(rel / 45) % 8]
}

// Eight-point compass abbreviation for a bearing — the fallback when a park's
// orientation is unknown. Returns the direction the wind blows *from*, matching
// how weather reports and scorekeepers read "wind SW".
const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
export function compassFrom(fromDeg) {
  return COMPASS_8[Math.round(((fromDeg % 360) + 360) % 360 / 45) % 8]
}
