import { contrastRatio, readableTextColor } from '../../lib/contrast.js'
import { seasonMark } from '../../lib/identity/seasonMarks.js'
import {
  hasMonoLogo, teamAbbr, teamChipColors, teamFullName, teamLocationName, teamLogoUrl,
} from '../../lib/teams.js'

// Artwork defaults, not a second club-color table. Club identity comes from
// the existing resolvers; callers can supply a period palette and knockout.
const PAPER = '#F1E7CC'
const NAVY = '#1B2A3A'
const GOLD = '#C89737'
const hex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const text = (value) => typeof value === 'string' ? value.trim() : ''

function pennantPalette(teamId, era, palette = {}) {
  const current = era ? null : teamChipColors(teamId)
  const field = hex(palette?.field) ? palette.field : era?.bar ?? current?.primary ?? NAVY
  const border = hex(palette?.border) ? palette.border : era?.accent ?? current?.secondary ?? GOLD
  const desiredInk = hex(palette?.ink) ? palette.ink : era?.onBar ?? PAPER
  let ink = contrastRatio(field, desiredInk) >= 4.5
    ? desiredInk : readableTextColor(field, PAPER, NAVY)
  // Mid-tone fields can fail with BOTH brand neutrals. Black/white always
  // provides a readable last rung for an otherwise valid custom palette.
  if (contrastRatio(field, ink) < 4.5) ink = readableTextColor(field, '#FFFFFF', '#000000')
  const desiredYear = hex(palette?.year) ? palette.year : border
  const year = contrastRatio(field, desiredYear) >= 4.5 ? desiredYear : ink
  return { field, border, ink, year }
}

/** Resolves display identity only. The caller supplies a verified league honor. */
export function pennantModel({
  teamId, season, league, teamName, clubLabel, abbreviation, logoUrl, palette,
} = {}) {
  const year = typeof season === 'number' ? season : Number(text(season))
  // The two leagues began in different years. No league title was awarded
  // in 1994. Do not manufacture a pennant for an incomplete/invalid record.
  const firstYear = league === 'AL' ? 1901 : league === 'NL' ? 1876 : Infinity
  if (!Number.isInteger(year) || year < firstYear || year > 9999 || year === 1994) return null
  const era = seasonMark(teamId, year)
  const name = text(teamName) || era?.name || teamFullName(teamId)
  if (!name) return null
  // Covered eras have no curated single-color art. Use their abbreviation
  // until the caller supplies an era-matched knockout, never today's mark.
  const mark = logoUrl === undefined
    ? !era && hasMonoLogo(teamId) ? teamLogoUrl(teamId, 'mono') : null
    : text(logoUrl) || null
  const leagueName = league === 'AL' ? 'American' : 'National'
  return {
    season: year,
    name,
    clubLabel: text(clubLabel) || (era ? era.name : teamLocationName(teamId)) || name,
    abbreviation: text(abbreviation) || era?.abbr || teamAbbr({ id: teamId, name }),
    leagueName,
    label: `${year} ${name}, ${leagueName} League champions`,
    logoUrl: mark,
    palette: pennantPalette(teamId, era, palette),
  }
}

// All coordinates are in artwork units. Change the silhouette and hierarchy
// here rather than forking a team- or player-page version of the same honor.
export const PENNANT_ART = Object.freeze({
  width: 320,
  height: 520,
  outline: 'M4 4H316V404L160 516 4 404Z',
  mark: { x: 95, y: 83, width: 130, height: 143 },
  compactMark: { x: 85, y: 87, width: 150, height: 170 },
})
