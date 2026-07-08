import { leagueLogoUrl } from '../lib/teams.js'

// A neutral "Top 100 prospect" pill (not a performance judgment) for a game's
// own pages (lineups, rosters) — the MLB Pipeline mark plus overall rank.
// Game pages only carry the app-wide Top 100 snapshot (see
// src/api/prospects.js), not the org-farm-system tree TeamPage.jsx resolves
// for its own roster, so this only ever shows the overall rank. Renders
// nothing when the player isn't ranked, so callers can splice it in
// unconditionally.
export function ProspectPill({ rank }) {
  if (!rank) return null
  return (
    <span className="prospectpill">
      <img src={leagueLogoUrl()} alt="" className="prospectpill__logo" />
      #{rank} PROSPECT
    </span>
  )
}
