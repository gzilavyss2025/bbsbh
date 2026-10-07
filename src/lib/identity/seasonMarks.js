// The mark a club wore in a PAST season (#1591). `teamLogoUrl` keys on the
// franchise id alone, so an old game drew today's mark: the 1956 Brooklyn
// Dodgers wore the "LA" script. This module answers the season question.
//
// The table (data/season-marks.json) lists only the eras whose mark differs
// from today's. A club or season with no era is NOT covered, and the caller
// keeps drawing the current mark exactly as before. An era whose `file` is
// null is covered but has no art yet: the caller draws the monogram, because
// today's mark would state something false (ADR-0078). Each era with art
// records its source, licence and restriction, so a file's status stays
// checkable (scripts/season-marks/fetch.mjs writes them).

import SEASON_MARKS_JSON from '../data/season-marks.json' with { type: 'json' }

const FOLDER = '/logos/historical'

// The era covering (teamId, season), as { url, name }, or null for "draw the
// current mark". `url` is null for an era with no art on file. `season` is a
// year or an official date ("1956-10-08"), so a game screen passes its date.
export function seasonMark(teamId, season) {
  const year = Number(String(season ?? '').slice(0, 4))
  if (!teamId || !Number.isFinite(year)) return null
  const eras = SEASON_MARKS_JSON.clubs?.[String(teamId)]
  const era = eras?.find((e) => year >= e.from && year <= e.to)
  if (!era) return null
  return { url: era.file ? `${FOLDER}/${era.file}` : null, name: era.name }
}
