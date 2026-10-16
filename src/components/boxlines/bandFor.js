import { headerThemeFor, headerThemeStyle, themeKeyFor } from '../../lib/headerTheme.js'

// The band a Box Lines sheet wears: the club whose card the door sat on lends its colours
// and its mark, as that card's own head does (ADR-0030: a club colour may fill a head that
// names the club, and nothing else). The sheet is portalled to <body>, outside the page's
// themed root, so the colours have to be handed in. A caller with the page's resolved theme
// passes it; one with only a club id lets this resolve the club's main treatment. No club,
// or one with no curated colours, gives null and the sheet wears the house navy.
export function bandFor(teamId, theme) {
  if (!teamId) return null
  const t = theme === undefined ? headerThemeFor(teamId, themeKeyFor(teamId, 'home', 'main')) : theme
  return { teamId, style: headerThemeStyle(t) }
}
