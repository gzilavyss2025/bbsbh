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
// a file's status stays checkable (the lab's Eras tab writes them).
//
// Colours follow the same rule. Club colours changed over time, so today's
// never carry back. A covered era wears NEUTRAL chrome (no club tint on its
// tile, no club bar) until someone sets the era's own triad in the lab's Eras
// tab: `bar`, `accent` and `onBar`, the same three a club header carries, with
// `onBar` held to WCAG AA against `bar` by the dev-save validator and by
// check-contrast.mjs. An era with a triad tints its tile with `bar` and wears
// it on the bars (seasonTile, seasonTheme).

import { barMarkTone } from '../headerTheme.js'
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
  return {
    url: era.file ? `${FOLDER}/${era.file}` : null,
    name: era.name,
    abbr: era.abbr ?? null,
    bar: era.bar ?? null,
    accent: era.accent ?? null,
    onBar: era.onBar ?? null,
  }
}

// The era's header triad in headerThemeFor's shape, or null when the era has
// none (a triad needs both its bar and the ink on it).
export function eraTheme(era) {
  if (!era?.bar || !era?.onBar) return null
  return { bar: era.bar, accent: era.accent ?? era.bar, onBar: era.onBar, onBarTone: barMarkTone(era.onBar) }
}

// A club tile (lib/teams.js's treatmentTile shape) for the season. `ink` is the
// era's onBar, the abbreviation's colour on a tinted tile (#1724). A covered
// era drops today's tint, pinstripe and per-club tuning: the tuning was set by
// eye for TODAY's art, and the colours are today's, not the era's.
export function seasonTile(teamId, season, tile) {
  const era = seasonMark(teamId, season)
  if (!era) return tile
  return { ...tile, tint: era.bar, ink: era.onBar, pinstripeColor: null, pinstripeBg: null, scale: 1, offsetX: 0, offsetY: 0 }
}

// The bar theme of a club in a season-covered era: the app's default chrome,
// set EXPLICITLY. lib/headerTheme.js's headerThemeStyle resets the custom
// properties for it. Plain null is not enough: TeamInfo nests the opposing
// club's cards inside the page's own themed shell, so a 1979 White Sox card
// would inherit the Tigers' colours. headerThemeFor itself stays a function of
// (teamId, treatment) only (ADR-0030); the season gate sits here, at its callers.
export const PERIOD_THEME = Object.freeze({ neutral: true })

export function seasonTheme(teamId, season, theme) {
  const era = seasonMark(teamId, season)
  return era ? (eraTheme(era) ?? PERIOD_THEME) : theme
}

// The section bars' masthead mark (headerTheme.js's mastheadMarkFor) for the
// season. A covered era draws its own mark (TeamLogo's `season`), so today's
// bar art and the scale tuned for it do not apply.
export function seasonMasthead(teamId, season, masthead) {
  return seasonMark(teamId, season) ? { url: null, scale: null } : masthead
}
