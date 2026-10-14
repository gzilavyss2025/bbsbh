import { selectGameSeason, selectTeamMeta } from '../../../../api/select.js'
import { headerThemeFor, mastheadMarkFor, themeKeyFor } from '../../../../lib/headerTheme.js'
import { seasonMasthead, seasonTheme } from '../../../../lib/identity/seasonMarks.js'

// A club's identity on one lineup page: the bar colours of the jersey it wears tonight
// and the mark its bars draw. Identity only, never game state (ADR-0030). Not memoised:
// the override tables refill in place (ADR-0050), so a memo would serve the old triad
// (the same trap as ADR-0007).
export function lineupIdentity(feed, side, treatment, oppTreatment) {
  const oppSide = side === 'away' ? 'home' : 'away'
  const meta = selectTeamMeta(feed, side)
  const oppMeta = selectTeamMeta(feed, oppSide)
  const season = selectGameSeason(feed)
  const themeOf = (m, s, t) => seasonTheme(m.id, season, headerThemeFor(m.id, themeKeyFor(m.id, s, t)))
  return {
    meta,
    oppMeta,
    oppSide,
    season,
    theme: themeOf(meta, side, treatment),
    oppTheme: themeOf(oppMeta, oppSide, oppTreatment),
    masthead: seasonMasthead(meta.id, season, mastheadMarkFor(meta.id, treatment)),
    oppMasthead: seasonMasthead(oppMeta.id, season, mastheadMarkFor(oppMeta.id, oppTreatment)),
  }
}
