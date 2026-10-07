// The mark a club wore in a PAST season (#1591). `teamLogoUrl` keys on the
// franchise id alone, so an old game drew today's mark: the 1956 Brooklyn
// Dodgers wore the "LA" script. This module answers the season question.
//
// The table (data/season-marks.json) lists only the eras whose mark differs
// from today's. A club or season with no era is NOT covered, and the caller
// keeps drawing the current mark exactly as before. An era whose `file` is
// null is covered but has no art yet: the caller draws the era's abbreviation
// in a serif face, because today's mark would state something false
// (ADR-0078), and one letter says less than the club's own period code
// (#1626). Each era with art records its source, licence and restriction, so
// a file's status stays checkable (scripts/season-marks/fetch.mjs writes them).
//
// Colours follow the same rule. Club colours changed over time, and no cited
// source gives an era's colours as values, so a covered era wears NEUTRAL
// chrome: no club tint on its tile (seasonTile) and no club bar (seasonTheme).
// Today's colours on an old game would be false.

import SEASON_MARKS_JSON from '../data/season-marks.json' with { type: 'json' }

const FOLDER = '/logos/historical'

// The era covering (teamId, season), as { url, name, abbr }, or null for "draw
// the current mark". `url` is null for an era with no art on file. `season` is
// a year or an official date ("1956-10-08"), so a game screen passes its date.
export function seasonMark(teamId, season) {
  const year = Number(String(season ?? '').slice(0, 4))
  if (!teamId || !Number.isFinite(year)) return null
  const eras = SEASON_MARKS_JSON.clubs?.[String(teamId)]
  const era = eras?.find((e) => year >= e.from && year <= e.to)
  if (!era) return null
  return { url: era.file ? `${FOLDER}/${era.file}` : null, name: era.name, abbr: era.abbr ?? null }
}

// A club tile (lib/teams.js's treatmentTile shape) for the season. A covered
// era drops today's tint, pinstripe and per-club tuning: the tuning was set by
// eye for TODAY's art, and the colours are today's, not the era's.
export function seasonTile(teamId, season, tile) {
  if (!seasonMark(teamId, season)) return tile
  return { ...tile, tint: null, pinstripeColor: null, pinstripeBg: null, scale: 1, offsetX: 0, offsetY: 0 }
}

// The bar theme of a club in a season-covered era: the app's default chrome,
// set EXPLICITLY. lib/headerTheme.js's headerThemeStyle resets the custom
// properties for it. Plain null is not enough: TeamInfo nests the opposing
// club's cards inside the page's own themed shell, so a 1979 White Sox card
// would inherit the Tigers' colours. headerThemeFor itself stays a function of
// (teamId, treatment) only (ADR-0030); the season gate sits here, at its callers.
export const PERIOD_THEME = Object.freeze({ neutral: true })

export function seasonTheme(teamId, season, theme) {
  return seasonMark(teamId, season) ? PERIOD_THEME : theme
}

// The section bars' masthead mark (headerTheme.js's mastheadMarkFor) for the
// season. A covered era draws its own mark (TeamLogo's `season`), so today's
// bar art and the scale tuned for it do not apply.
export function seasonMasthead(teamId, season, masthead) {
  return seasonMark(teamId, season) ? { url: null, scale: null } : masthead
}
