// Ballpark orientation + wind-geometry helpers for the scorebook weather string.
//
// The MLB Stats API gives us a park's coordinates and roof type, but NOT its
// compass orientation — and orientation is what turns a raw wind bearing into a
// scorekeeper's "out to CF" / "in from LF". There is no field to read, so this
// is the one piece of static data the weather generator needs.
//
// A wrong direction gets copied onto paper as fact, so we only seed parks whose
// orientation is well established in public sources, and we degrade gracefully:
// any park not listed falls back to a plain compass bearing (see weather.js),
// which is honest rather than guessed. Extend PARK_CF_BEARING with a verified
// home-plate→center-field bearing (degrees clockwise from true north) to upgrade
// a park from compass to field-relative.

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
// direction the batter faces). Cardinal-level values corroborated across
// baseball-almanac / Hardball Times / Clem's Baseball orientation write-ups;
// the wind classifier buckets at 45°, so cardinal precision is sufficient.
// Keyed by normalized venue name (stable across sponsor renames of the club,
// though not of the park itself — re-verify a key if a park is renamed).
//
// Deliberately small and conservative: only parks with a well-documented
// orientation are listed. Everything else uses the compass fallback.
const PARK_CF_BEARING_BY_NAME = {
  wrigleyfield: 45, // NE — sun toward CF at first pitch, "further north than the rule"
  fenwaypark: 45, // NE
  orioleparkatcamdenyards: 45, // NE
  dodgerstadium: 22, // NNE
  yankeestadium: 67, // ENE — the most Rule-1.04-compliant park
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
