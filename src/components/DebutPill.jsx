import { leagueLogoUrl } from '../lib/teams.js'

// A minimal MLB-shield pill with no rank/text — marks that a roster/lineup
// row's player has appeared in a Major League game before, so a name sitting
// among prospects/rookies reads at a glance as already-debuted. Sibling to
// ProspectPill/RookiePill/MilestonePill (same shape/weight), renders nothing
// for an undebuted player so callers can splice it in unconditionally.
// `debuted` comes from hasDebuted (src/api/rookies.js), reading the same
// rookies precompute RookiePill uses.
export function DebutPill({ debuted }) {
  if (!debuted) return null
  return (
    <span className="debutpill" title="MLB debut">
      <img src={leagueLogoUrl()} alt="MLB debut" className="debutpill__logo" />
    </span>
  )
}
